// 스크랩 링크의 "본문"을 서버에서 읽는 부분. api/preview.ts(배포)와 vite.config.ts(개발 중)가 같이 쓴다.
// - 본문 글과 사진: AI 요약이 제목·메모만이 아니라 실제 글과 사진을 보고 정리하도록
// - 사이트 화면 캡처: 무료 캡처 서비스(microlink, 안 되면 WordPress mshots)로 찍는다. 키가 필요 없다
import { attr, decodeEntities, detectSource, instagramEmbedUrl, isPublicHttpUrl, naverBlogInnerUrl, parseLinkMeta, xEmbedUrl } from './link.js'
import { fetchHtml, fetchImageData, get, PreviewError, readLimited, toBase64, type Fetch } from './previewServer.js'

/** 본문 글자 수 한도 (AI에 보낼 만큼만) */
export const MAX_PAGE_TEXT = 6000
/** 본문 사진 개수 / 한 장 크기 / 합계 (Vercel 응답 4.5MB 안으로) */
const MAX_IMAGES = 4
const MAX_ONE_IMAGE = 1_200_000
const MAX_ALL_IMAGES = 3_000_000
/** 캡처 한 장 크기 */
const MAX_SHOT = 3_000_000

export interface PageContent {
  /** 본문 글 (줄바꿈 유지) */
  text: string
  /** 본문 사진 (data:image/...;base64,...), 대표 사진이 먼저 */
  images: string[]
}

/** HTML → 읽을 수 있는 글. 스크립트·메뉴·꼬리말은 뺀다 */
export function htmlToText(html: string): string {
  const body = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|form|button|select|nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|blockquote|section|article|figcaption|dd|dt)>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<[^>]+>/g, ' ')
  const seen = new Set<string>()
  const lines: string[] = []
  for (const raw of decodeEntities(body).split('\n')) {
    const line = raw.replace(/[\s​ ]+/g, ' ').trim()
    if (!line || line === '•' || seen.has(line)) continue
    seen.add(line)
    lines.push(line)
  }
  return lines.join('\n').slice(0, MAX_PAGE_TEXT)
}

/** 페이지에서 본문이 있는 부분만 (네이버 블로그 본문 → <article> → <main> → <body>) */
export function mainRegion(html: string): string {
  const between = (start: RegExp, end: RegExp) => {
    const s = html.search(start)
    if (s < 0) return null
    const rest = html.slice(s)
    const e = rest.search(end)
    return e > 0 ? rest.slice(0, e) : rest.slice(0, 400_000)
  }
  return (
    between(/<div[^>]+class=["'][^"']*se-main-container/i, /<div[^>]+class=["'][^"']*(?:post_footer|wrap_postcomment|se-viewer-footer)/i) ??
    between(/<div[^>]+id=["']postViewArea/i, /<div[^>]+class=["'][^"']*post_footer/i) ??
    between(/<article\b/i, /<\/article>(?![\s\S]*<\/article>)/i) ??
    between(/<main\b/i, /<\/main>/i) ??
    between(/<body\b/i, /<\/body>/i) ??
    html
  )
}

/** 본문 사진 주소들 (아이콘·로고·이모티콘처럼 작은 건 뺀다) */
export function contentImageUrls(region: string, pageUrl: string): string[] {
  const out: string[] = []
  for (const tag of region.match(/<img\b[^>]*>/gi) ?? []) {
    const src = attr(tag, 'data-lazy-src') ?? attr(tag, 'data-src') ?? attr(tag, 'data-original') ?? attr(tag, 'src')
    if (!src || src.startsWith('data:')) continue
    const w = Number(attr(tag, 'width') ?? 0)
    const h = Number(attr(tag, 'height') ?? 0)
    if ((w && w < 120) || (h && h < 120)) continue
    if (/\.svg(\?|$)|sprite|emoji|emoticon|icon|logo|profile|avatar|blank\.gif|spacer|static\/img/i.test(src)) continue
    try {
      const abs = new URL(decodeEntities(src), pageUrl)
      // 네이버 블로그 사진은 ?type=w80_blur 처럼 작은 판이 걸려 있다 → 큰 판으로
      if (/pstatic\.net$/.test(abs.hostname) && abs.searchParams.has('type')) abs.searchParams.set('type', 'w773')
      if (/^https?:$/.test(abs.protocol) && !out.includes(abs.href)) out.push(abs.href)
    } catch {
      // 이상한 주소는 건너뛴다
    }
    if (out.length >= 12) break
  }
  return out
}

/** 사진 주소 여러 개를 data URL로 (크기 한도 안에서) */
async function downloadImages(urls: string[], f: Fetch, signal?: AbortSignal): Promise<string[]> {
  const picked = Array.from(new Set(urls)).slice(0, MAX_IMAGES + 2)
  const got = await Promise.all(picked.map((u) => fetchImageData(u, f, signal, MAX_ONE_IMAGE)))
  const out: string[] = []
  let total = 0
  for (const d of got) {
    if (!d || out.length >= MAX_IMAGES || total + d.length > MAX_ALL_IMAGES * 1.37) continue
    out.push(d)
    total += d.length
  }
  return out
}

const tweetId = (url: string): string | null => xEmbedUrl(url)?.match(/id=(\d+)/)?.[1] ?? null

/** X(트위터) 공개 퍼가기 서버가 쓰는 토큰 (react-tweet 와 같은 계산) */
const tweetToken = (id: string) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')

interface Tweet {
  text?: string
  user?: { name?: string; screen_name?: string }
  photos?: { url?: string }[]
  mediaDetails?: { media_url_https?: string }[]
  video?: { poster?: string }
  quoted_tweet?: Tweet
  note_tweet?: { text?: string }
}

/** X 글: 로그인 없이 읽히는 공식 퍼가기 서버(syndication)에서 글과 사진을 받는다. 안 되면 oEmbed 글만 */
async function readTweet(url: string, f: Fetch, signal?: AbortSignal): Promise<PageContent | null> {
  const id = tweetId(url)
  if (!id) return null
  try {
    const res = await get(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=ko&token=${tweetToken(id)}`, f, signal, { accept: 'application/json' })
    if (res.ok) {
      const t = JSON.parse(new TextDecoder().decode(await readLimited(res, 1_000_000))) as Tweet
      const one = (x: Tweet) => [x.user?.name && `${x.user.name} (@${x.user.screen_name ?? ''})`, x.note_tweet?.text ?? x.text].filter(Boolean).join('\n')
      const text = [one(t), t.quoted_tweet && `인용한 글:\n${one(t.quoted_tweet)}`].filter(Boolean).join('\n\n')
      const photos = [...(t.photos ?? []).map((p) => p.url), ...(t.mediaDetails ?? []).map((m) => m.media_url_https), t.video?.poster, ...(t.quoted_tweet?.photos ?? []).map((p) => p.url)].filter(
        (u): u is string => !!u,
      )
      if (text.trim()) return { text: text.slice(0, MAX_PAGE_TEXT), images: await downloadImages(photos, f, signal) }
    }
  } catch {
    // oEmbed 로
  }
  try {
    const res = await get(`https://publish.twitter.com/oembed?omit_script=1&lang=ko&url=${encodeURIComponent(url)}`, f, signal, { accept: 'application/json' })
    if (!res.ok) return null
    const o = JSON.parse(new TextDecoder().decode(await readLimited(res, 500_000))) as { html?: string; author_name?: string }
    const text = htmlToText(o.html ?? '')
    return text ? { text, images: [] } : null
  } catch {
    return null
  }
}

/** 인스타그램: 공식 퍼가기(embed) 화면에 캡션 전체와 사진이 있다 */
async function readInstagram(url: string, f: Fetch, signal?: AbortSignal): Promise<PageContent | null> {
  const embed = instagramEmbedUrl(url)
  const page = await fetchHtml(url, f, signal).catch(() => null)
  const meta = page ? parseLinkMeta(page.html, page.finalUrl) : {}
  let caption = ''
  const images: string[] = meta.image ? [meta.image] : []
  if (embed) {
    const e = await fetchHtml(embed, f, signal).catch(() => null)
    if (e) {
      const cap = e.html.match(/<div[^>]+class=["']Caption["'][^>]*>([\s\S]*?)(?:<div[^>]+class=["']CaptionComments|<\/div>)/i)?.[1]
      if (cap) caption = htmlToText(cap.replace(/<a[^>]+class=["'][^"']*CaptionUsername[\s\S]*?<\/a>/i, ''))
      const img = e.html.match(/<img[^>]+class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*>/i)?.[0]
      const src = img && (attr(img, 'src') ?? '')
      if (src) images.unshift(decodeEntities(src))
    }
  }
  const text = [caption || meta.description, !caption && meta.title].filter(Boolean).join('\n')
  if (!text && !images.length) return null
  return { text: text.slice(0, MAX_PAGE_TEXT), images: await downloadImages(images, f, signal) }
}

/** 링크 하나의 본문 글과 사진 */
export async function readPageContent(url: string, f: Fetch = fetch, signal?: AbortSignal): Promise<PageContent> {
  if (!isPublicHttpUrl(url)) throw new PreviewError('열 수 없는 주소예요', 400)
  const source = detectSource(url)
  if (source === 'x') {
    const t = await readTweet(url, f, signal)
    if (t) return t
  }
  if (source === 'instagram') {
    const i = await readInstagram(url, f, signal)
    if (i) return i
  }
  let { html, finalUrl } = await fetchHtml(url, f, signal)
  // 네이버 블로그는 본문이 안쪽 페이지에 있다
  const inner = naverBlogInnerUrl(html, finalUrl)
  if (inner) {
    const page = await fetchHtml(inner, f, signal).catch(() => null)
    if (page) ({ html, finalUrl } = page)
  }
  const meta = parseLinkMeta(html, finalUrl)
  const region = mainRegion(html)
  let text = htmlToText(region)
  if (meta.description && !text.includes(meta.description.slice(0, 30))) text = `${meta.description}\n${text}`.slice(0, MAX_PAGE_TEXT)
  const images = [...(meta.image ? [meta.image] : []), ...contentImageUrls(region, finalUrl)]
  return { text, images: await downloadImages(images, f, signal) }
}

/** 캡처할 화면 주소: X·인스타그램은 로그인 화면 대신 공식 퍼가기 화면을 찍는다 */
export function shotTarget(url: string): string {
  return xEmbedUrl(url) ?? instagramEmbedUrl(url) ?? url
}

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(signal.reason)
    })
  })

async function imageFrom(url: string, f: Fetch, signal?: AbortSignal): Promise<{ type: string; bytes: Uint8Array } | null> {
  const res = await get(url, f, signal, { accept: 'image/*' })
  const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!res.ok || !/^image\/(jpeg|png|webp|gif)$/i.test(type)) return null
  const bytes = await readLimited(res, MAX_SHOT + 1)
  if (bytes.length > MAX_SHOT || bytes.length < 2000) return null
  return { type, bytes }
}

/**
 * 사이트 화면 캡처 (무료 서비스, 키 없음). data:image/...;base64,... 로 돌려준다
 * 1) microlink (하루 50번 무료) 2) WordPress mshots (처음엔 "만드는 중" 그림을 주므로 몇 번 다시 묻는다)
 */
export async function captureSite(url: string, f: Fetch = fetch, signal?: AbortSignal): Promise<string> {
  if (!isPublicHttpUrl(url)) throw new PreviewError('열 수 없는 주소예요', 400)
  const target = shotTarget(url)
  const enc = encodeURIComponent(target)
  try {
    const shot = await imageFrom(
      `https://api.microlink.io/?url=${enc}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=540&viewport.height=960&viewport.deviceScaleFactor=2&waitForTimeout=1500`,
      f,
      signal,
    )
    if (shot) return `data:${shot.type};base64,${toBase64(shot.bytes)}`
  } catch {
    if (signal?.aborted) throw new PreviewError('캡처가 너무 오래 걸려요', 504)
  }
  for (let i = 0; i < 4; i++) {
    try {
      const shot = await imageFrom(`https://s.wordpress.com/mshots/v1/${enc}?w=1080&h=1600`, f, signal)
      // 만드는 중일 때는 작은 gif 를 준다
      if (shot && shot.type !== 'image/gif') return `data:${shot.type};base64,${toBase64(shot.bytes)}`
    } catch {
      if (signal?.aborted) break
    }
    await wait(3000, signal).catch(() => undefined)
    if (signal?.aborted) break
  }
  throw new PreviewError('사이트 화면을 캡처하지 못했어요')
}

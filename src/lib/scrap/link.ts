// 링크 다루기: 어디서 온 링크인지, 공유로 들어온 글에서 주소 찾기, 미리보기(OG 태그) 읽기
// 이 파일은 앱과 서버(api/preview.ts) 둘 다 쓴다. 그래서 다른 파일을 import 하지 않는다.

export type LinkSource = 'instagram' | 'naver' | 'x' | 'youtube' | 'web'

export const SOURCE_LABEL: Record<LinkSource, string> = {
  instagram: 'Instagram',
  naver: 'NAVER',
  x: 'X',
  youtube: 'YouTube',
  web: '웹',
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\.|^m\./, '')
  } catch {
    return ''
  }
}

/** 링크가 어디 것인지 */
export function detectSource(url: string): LinkSource {
  const h = hostOf(url)
  if (h === 'instagram.com' || h.endsWith('.instagram.com') || h === 'instagr.am') return 'instagram'
  if (h === 'naver.com' || h.endsWith('.naver.com') || h === 'naver.me') return 'naver'
  if (h === 'x.com' || h === 'twitter.com' || h.endsWith('.twitter.com') || h.endsWith('.x.com') || h === 't.co') return 'x'
  if (h === 'youtube.com' || h.endsWith('.youtube.com') || h === 'youtu.be') return 'youtube'
  return 'web'
}

/**
 * 같은 게시물인지 비교하는 열쇠. 주소 모양이 달라도 같은 게시물이면 같은 값
 * (인스타 /아이디/p/코드 · ?img_index, x.com ↔ twitter.com, youtu.be ↔ watch?v=, 추적용 ?utm_ 같은 것)
 */
export function linkKey(url: string): string {
  let u: URL
  try {
    u = new URL(url.trim())
  } catch {
    return url.trim()
  }
  const h = hostOf(url)
  const src = detectSource(url)
  if (src === 'instagram') {
    const m = u.pathname.match(/\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]{5,})/i)
    if (m) return `instagram:${m[1]}`
  }
  if (src === 'x') {
    const m = u.pathname.match(/\/status(?:es)?\/(\d+)/)
    if (m) return `x:${m[1]}`
  }
  if (src === 'youtube') {
    const id = h === 'youtu.be' ? u.pathname.slice(1).split('/')[0] : (u.searchParams.get('v') ?? u.pathname.match(/\/(?:shorts|embed|live)\/([\w-]{6,})/)?.[1])
    if (id) return `youtube:${id}`
  }
  // 그 밖의 사이트: 추적용 값 · #뒤 · 끝 / 를 빼고 비교
  for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|igsh$|igshid$)/i.test(k)) u.searchParams.delete(k)
  u.searchParams.sort()
  const q = u.searchParams.toString()
  return `${h}${u.pathname.replace(/\/+$/, '')}${q ? `?${q}` : ''}`
}

const URL_RE = /https?:\/\/[^\s<>"'`]+/i

/**
 * 다른 앱에서 "공유하기"로 들어온 값에서 주소를 찾는다.
 * 인스타그램·X는 주소를 url이 아니라 text에 넣어 보내는 경우가 많다.
 */
export function extractSharedUrl(shared: { url?: string | null; text?: string | null; title?: string | null }): string | null {
  for (const v of [shared.url, shared.text, shared.title]) {
    const m = v?.match(URL_RE)
    if (m) return m[0].replace(/[).,!?…]+$/, '')
  }
  return null
}

/**
 * 공유로 들어온 주소 다듬기: X 게시물 주소 끝의 추적용 ?s=…&t=… 를 뗀다
 * 예: https://x.com/someone/status/123?s=46&t=abc → https://x.com/someone/status/123
 */
export function cleanSharedUrl(url: string): string {
  if (detectSource(url) !== 'x') return url
  try {
    const u = new URL(url)
    if (!/\/status(?:es)?\/\d+/.test(u.pathname)) return url
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`
  } catch {
    return url
  }
}

/** 공유 글에서 주소를 뺀 나머지 (제목 후보) */
export function sharedTextWithoutUrl(text: string | null | undefined): string {
  return (text ?? '').replace(new RegExp(URL_RE.source, 'gi'), '').replace(/\s+/g, ' ').trim()
}

/** 인스타그램 게시물/릴스 주소면 공식 퍼가기(embed) 주소. 아니면 null */
export function instagramEmbedUrl(url: string): string | null {
  if (detectSource(url) !== 'instagram') return null
  try {
    const m = new URL(url).pathname.match(/^\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/)
    if (!m) return null
    const kind = m[1] === 'reels' ? 'reel' : m[1]
    return `https://www.instagram.com/${kind}/${m[2]}/embed/captioned/`
  } catch {
    return null
  }
}

/**
 * X(트위터) 게시물 주소면 공식 퍼가기(embed) 주소. 아니면 null
 * 예: https://x.com/someone/status/123 → https://platform.twitter.com/embed/Tweet.html?id=123
 */
export function xEmbedUrl(url: string): string | null {
  if (detectSource(url) !== 'x') return null
  try {
    const m = new URL(url).pathname.match(/\/status(?:es)?\/(\d{1,25})/)
    return m ? `https://platform.twitter.com/embed/Tweet.html?id=${m[1]}&lang=ko&dnt=true` : null
  } catch {
    return null
  }
}

/** 유튜브 영상이면 퍼가기 주소 */
export function youtubeEmbedUrl(url: string): string | null {
  if (detectSource(url) !== 'youtube') return null
  try {
    const u = new URL(url)
    const id = u.hostname.includes('youtu.be') ? u.pathname.slice(1) : u.pathname.startsWith('/shorts/') ? u.pathname.split('/')[2] : u.searchParams.get('v')
    return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube.com/embed/${id}` : null
  } catch {
    return null
  }
}

export interface LinkMeta {
  title?: string
  description?: string
  siteName?: string
  /** 썸네일 이미지 주소 (절대 주소) */
  image?: string
  /** 동영상 게시물인가 (og:type=video 또는 og:video) */
  isVideo?: boolean
}

/**
 * 인스타그램 설명 앞에 붙는 "좋아요 1,234개, 댓글 56개 - 아이디님, 날짜: " 부분과 따옴표를 빼고 본문만
 */
/** 게시물 캡션만 남기기: "좋아요 12개 · 아이디 · 날짜:" 머리말, 끝의 t.co · pic.twitter.com 링크, 바깥 따옴표를 뗀다 */
export function cleanCaption(text: string | undefined): string {
  if (!text) return ''
  const t = (tidyDescription(text) ?? '')
    .replace(/\s*(?:https?:\/\/t\.co\/\w+|pic\.twitter\.com\/\w+)/g, '')
    .replace(/^["“]([\s\S]*)["”]$/, '$1')
  return t
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function tidyDescription(desc: string | undefined): string | undefined {
  if (!desc) return desc
  const m = desc.match(/^[\d,.\s]*(?:likes?|좋아요)[^:]{0,120}:\s*["“]?([\s\S]*?)["”]?\.?$/i)
  return (m ? m[1] : desc).trim() || undefined
}

/**
 * 인스타그램·X 미리보기 제목 앞뒤에 붙는 "Instagram의 OO님 : "…"", "OO on Instagram: "…"", "… / X" 를 떼고
 * 따옴표 안 글(게시글 본문)만 돌려준다. 그런 모양이 아니면 null
 */
export function socialCaptionFromTitle(title: string | undefined): string | null {
  if (!title) return null
  const t = title.trim().replace(/\s*\/\s*X$/, '')
  const m =
    t.match(/^(?:Instagram|X|트위터|Twitter)의\s.{0,80}?님\s*[:：]\s*["“]?([\s\S]*?)["”]?$/) ??
    t.match(/^.{0,80}?\son\s(?:Instagram|X|Twitter)\s*[:：]\s*["“]?([\s\S]*?)["”]?$/i) ??
    t.match(/^.{0,80}?님의\s(?:Instagram|인스타그램)[^:：]*[:：]\s*["“]?([\s\S]*?)["”]?$/)
  return m ? m[1].trim() : null
}

/** 사용자 이름만 있는 제목인가 ("Instagram의 OO님", "OO님의 Instagram 게시물", "OO (@id) • Instagram photos and videos") */
export function isNameOnlySocialTitle(title: string | undefined): boolean {
  if (!title) return false
  return /^(?:Instagram|X)의\s[^:：]{0,80}님$|님의\s(?:Instagram|인스타그램)|on\s(?:Instagram|X)$|•\s*Instagram|^Instagram$|^X$/i.test(title.trim())
}

/**
 * AI 없이 만드는 짧은 제목: 게시글 본문의 첫 줄(첫 문장)에서 해시태그·@아이디·주소를 빼고 40자 안으로
 * 예: "웬만한 디저트는 이제 집에서 만들어요 🍪\n재료: …  #홈베이킹" → "웬만한 디저트는 이제 집에서 만들어요 🍪"
 */
export function simpleTitle(text: string | undefined, max = 40): string {
  if (!text) return ''
  const cleaned = text
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/(^|\s)@[\w.]+/g, ' ')
  const line =
    cleaned
      .split(/\n+/)
      .map((l) => l.replace(/[\s\u200b\u00a0]+/g, ' ').replace(/^[\s.•·\-–—:"“”'|]+|[\s.•·\-–—:"“”'|]+$/g, '').trim())
      .find((l) => l.replace(/[\p{Extended_Pictographic}\s]/gu, '').length >= 2) ?? ''
  // 첫 문장이 충분히 길면 거기서 끊는다
  const sentence = line.match(/^(.{8,}?(?:[.!?。！？]|다\.|요\.|요!|요~|ㅋㅋ+|ㅎㅎ+))(\s|$)/u)?.[1] ?? line
  const one = sentence.replace(/[.。]$/, '').trim()
  if (one.length <= max) return one
  const cut = one.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trim()}…`
}

/** 미리보기 제목을 보기 좋게: 인스타그램·X는 "OO님의 …" 대신 게시글 본문으로 짧은 제목을 만든다 */
export function tidyTitle(title: string | undefined, description: string | undefined, source: LinkSource): string | undefined {
  if (source !== 'instagram' && source !== 'x') return title
  const caption = socialCaptionFromTitle(title)
  // 이름이 붙지 않은 보통 제목이면 그대로 둔다
  if (caption === null && title && !isNameOnlySocialTitle(title)) return title
  return simpleTitle(description) || simpleTitle(caption ?? undefined) || (source === 'instagram' ? 'Instagram 게시물' : 'X 게시물')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[e.toLowerCase()] ?? all
  })
}

export function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))
  return m ? (m[2] ?? m[3] ?? m[4]) : undefined
}

const clean = (s: string | undefined, max: number) => {
  const v = s ? decodeEntities(s).replace(/\s+/g, ' ').trim() : ''
  return v ? v.slice(0, max) : undefined
}

/** HTML에서 미리보기 정보(og:, twitter:, <title>)를 읽는다 */
export function parseLinkMeta(html: string, pageUrl: string): LinkMeta {
  const head = html.slice(0, 400_000)
  const meta: Record<string, string> = {}
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') ?? attr(tag, 'name') ?? attr(tag, 'itemprop'))?.toLowerCase()
    const content = attr(tag, 'content')
    if (key && content !== undefined && !(key in meta)) meta[key] = content
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  let image: string | undefined = meta['og:image:secure_url'] ?? meta['og:image'] ?? meta['og:image:url'] ?? meta['twitter:image'] ?? meta['twitter:image:src'] ?? meta['image']
  if (image) {
    try {
      image = new URL(decodeEntities(image), pageUrl).href
      if (!/^https?:/.test(image)) image = undefined
    } catch {
      image = undefined
    }
  }
  const type = meta['og:type']?.toLowerCase() ?? ''
  const rawTitle = clean(meta['og:title'] ?? meta['twitter:title'] ?? titleTag, 200)
  const description = tidyDescription(clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'], 3000))
  return {
    title: tidyTitle(rawTitle, description, detectSource(pageUrl)),
    description,
    siteName: clean(meta['og:site_name'], 60),
    image,
    isVideo: type.startsWith('video') || !!meta['og:video'] || !!meta['og:video:url'] || undefined,
  }
}

/**
 * 네이버 블로그는 본문이 iframe(PostView) 안에 있다. 바깥 페이지에 정보가 없으면 이 주소를 한 번 더 읽는다.
 */
export function naverBlogInnerUrl(html: string, pageUrl: string): string | null {
  if (!/blog\.naver\.com/.test(pageUrl)) return null
  const src = html.match(/<iframe[^>]+id=["']mainFrame["'][^>]*src=["']([^"']+)["']/i)?.[1] ?? html.match(/<iframe[^>]+src=["']([^"']*PostView[^"']*)["']/i)?.[1]
  if (!src) return null
  try {
    return new URL(decodeEntities(src), pageUrl).href
  } catch {
    return null
  }
}

/** 서버가 읽으면 안 되는 주소 (내 컴퓨터, 사설망): SSRF 막기 */
export function isPublicHttpUrl(raw: string): boolean {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return false
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
  if (u.username || u.password) return false
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || !h.includes('.') && !h.includes(':')) return false
  if (/^(127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false
  if (h.includes(':') && (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80') || h.startsWith('::ffff:'))) return false
  return true
}

/** 미리보기 API가 돌려주는 모양 */
export interface PreviewResponse extends LinkMeta {
  url: string
  source: LinkSource
  /** 썸네일을 서버가 받아서 넣어 준 것 (data:image/...;base64,...). 인스타 이미지 주소는 금방 만료돼서 바로 저장해야 한다 */
  imageData?: string
}

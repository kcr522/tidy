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
export function tidyDescription(desc: string | undefined): string | undefined {
  if (!desc) return desc
  const m = desc.match(/^[\d,.\s]*(?:likes?|좋아요)[^:]{0,120}:\s*["“]?([\s\S]*?)["”]?\.?$/i)
  return (m ? m[1] : desc).trim() || undefined
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
  return {
    title: clean(meta['og:title'] ?? meta['twitter:title'] ?? titleTag, 200),
    description: tidyDescription(clean(meta['og:description'] ?? meta['twitter:description'] ?? meta['description'], 1000)),
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

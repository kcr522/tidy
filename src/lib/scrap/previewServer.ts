// 링크 미리보기를 "서버에서" 만드는 부분. api/preview.ts(배포)와 vite.config.ts(개발 중)가 같이 쓴다.
// 브라우저는 다른 사이트의 HTML을 직접 읽을 수 없어서(CORS) 서버가 대신 읽어 준다.
import { detectSource, isPublicHttpUrl, naverBlogInnerUrl, parseLinkMeta, type PreviewResponse } from './link.js'

/** 미리보기 봇처럼 보여야 인스타그램·X가 로그인 화면 대신 og 태그를 준다 */
const BOT_UA = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1; +http://www.facebook.com/externalhit_uatext.php) TidyPreview/1.0'
const MAX_HTML = 1_500_000
const MAX_IMAGE = 3_000_000

export class PreviewError extends Error {
  status: number
  constructor(message: string, status = 502) {
    super(message)
    this.status = status
  }
}

export type Fetch = typeof fetch

export async function readLimited(res: Response, max: number): Promise<Uint8Array> {
  const reader = res.body?.getReader()
  if (!reader) return new Uint8Array(await res.arrayBuffer()).slice(0, max)
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    size += value.length
    if (size >= max) {
      await reader.cancel()
      break
    }
  }
  const out = new Uint8Array(Math.min(size, max))
  let at = 0
  for (const c of chunks) {
    const part = c.subarray(0, Math.max(0, out.length - at))
    out.set(part, at)
    at += part.length
  }
  return out
}

export async function get(url: string, f: Fetch, signal?: AbortSignal, headers: Record<string, string> = {}): Promise<Response> {
  // 리다이렉트를 직접 따라가며 매번 사설망 주소인지 확인한다
  let current = url
  for (let i = 0; i < 5; i++) {
    if (!isPublicHttpUrl(current)) throw new PreviewError('열 수 없는 주소예요', 400)
    const res = await f(current, { headers: { 'user-agent': BOT_UA, accept: 'text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5', 'accept-language': 'ko,en;q=0.8', ...headers }, redirect: 'manual', signal })
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).href
      continue
    }
    return res
  }
  throw new PreviewError('주소가 너무 여러 번 넘어가요')
}

export async function fetchHtml(url: string, f: Fetch, signal?: AbortSignal): Promise<{ html: string; finalUrl: string }> {
  const res = await get(url, f, signal)
  if (!res.ok) throw new PreviewError(`사이트가 응답하지 않아요 (${res.status})`)
  const type = res.headers.get('content-type') ?? ''
  if (type && !/html|xml/i.test(type)) return { html: '', finalUrl: res.url || url }
  const bytes = await readLimited(res, MAX_HTML)
  const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? 'utf-8'
  let html: string
  try {
    html = new TextDecoder(charset).decode(bytes)
  } catch {
    html = new TextDecoder().decode(bytes)
  }
  return { html, finalUrl: res.url || url }
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** 썸네일 이미지를 받아 data URL로. 실패해도 미리보기는 보여 준다 */
export async function fetchImageData(url: string, f: Fetch, signal?: AbortSignal, max = MAX_IMAGE): Promise<string | undefined> {
  try {
    const res = await get(url, f, signal)
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim()
    if (!res.ok || !/^image\/(jpeg|png|webp|gif|avif)$/i.test(type)) return undefined
    const len = Number(res.headers.get('content-length') ?? 0)
    if (len > max) return undefined
    const bytes = await readLimited(res, max + 1)
    if (bytes.length > max) return undefined
    return `data:${type};base64,${toBase64(bytes)}`
  } catch {
    return undefined
  }
}

/** 주소 하나의 미리보기 (제목, 설명, 사이트 이름, 썸네일) */
export async function buildPreview(url: string, f: Fetch = fetch, signal?: AbortSignal): Promise<PreviewResponse> {
  if (!isPublicHttpUrl(url)) throw new PreviewError('열 수 없는 주소예요', 400)
  const { html, finalUrl } = await fetchHtml(url, f, signal)
  let meta = parseLinkMeta(html, finalUrl)
  // 네이버 블로그: 바깥 틀에 내용이 없으면 안쪽 글을 읽는다
  const inner = naverBlogInnerUrl(html, finalUrl)
  if (inner && (!meta.image || !meta.description)) {
    try {
      const innerPage = await fetchHtml(inner, f, signal)
      const m = parseLinkMeta(innerPage.html, innerPage.finalUrl)
      // 바깥에 있는 값이 먼저, 빈 칸만 안쪽 값으로 채운다
      meta = { ...m, ...Object.fromEntries(Object.entries(meta).filter(([, v]) => v)) }
    } catch {
      // 바깥 정보만이라도
    }
  }
  const imageData = meta.image ? await fetchImageData(meta.image, f, signal) : undefined
  return { url, source: detectSource(url), ...meta, ...(imageData ? { imageData } : {}) }
}

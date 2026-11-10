import { CapacitorHttp } from '@capacitor/core'
import { isNativeApp } from '../../platform/native'
import { dataUrlToBlob, shrinkImage } from './image'
import { detectSource, parseLinkMeta, type LinkMeta, type LinkSource, type PreviewResponse } from './link'

export const PREVIEW_URL = '/api/preview'

export interface LinkPreview extends LinkMeta {
  source: LinkSource
  /** 줄여서 저장할 썸네일 */
  thumb?: Blob
}

export class PreviewUnavailableError extends Error {}

/**
 * 폰 앱(Capacitor): 앱이 직접 페이지를 읽는다 (폰 앱은 CORS 제한이 없다)
 */
async function nativePreview(url: string): Promise<PreviewResponse> {
  const ua = 'Mozilla/5.0 (compatible; facebookexternalhit/1.1) TidyPreview/1.0'
  const page = await CapacitorHttp.get({ url, headers: { 'user-agent': ua }, responseType: 'text', connectTimeout: 8000, readTimeout: 8000 })
  const meta = parseLinkMeta(typeof page.data === 'string' ? page.data : '', page.url || url)
  let imageData: string | undefined
  if (meta.image) {
    try {
      const img = await CapacitorHttp.get({ url: meta.image, headers: { 'user-agent': ua }, responseType: 'blob' })
      const type = String(img.headers['content-type'] ?? img.headers['Content-Type'] ?? 'image/jpeg').split(';')[0]
      if (typeof img.data === 'string' && type.startsWith('image/')) imageData = `data:${type};base64,${img.data}`
    } catch {
      // 썸네일 없이
    }
  }
  return { url, source: detectSource(url), ...meta, imageData }
}

/** 웹 / 컴퓨터 PWA: 브라우저는 다른 사이트를 직접 못 읽어서 Tidy 서버(api/preview)에 부탁한다 */
async function serverPreview(url: string, signal?: AbortSignal): Promise<PreviewResponse> {
  let res: Response
  try {
    res = await fetch(`${PREVIEW_URL}?url=${encodeURIComponent(url)}`, { signal })
  } catch (err) {
    if (signal?.aborted) throw err
    throw new PreviewUnavailableError('미리보기 서버에 연결하지 못했어요')
  }
  const data = (await res.json().catch(() => null)) as (PreviewResponse & { error?: string }) | null
  if (!res.ok || !data) throw new PreviewUnavailableError(data?.error ?? '미리보기를 가져오지 못했어요')
  return data
}

/** 링크 미리보기 (제목, 설명, 썸네일). 실패하면 PreviewUnavailableError */
export async function fetchLinkPreview(url: string, signal?: AbortSignal): Promise<LinkPreview> {
  const data = isNativeApp() ? await nativePreview(url) : await serverPreview(url, signal)
  let thumb: Blob | undefined
  if (data.imageData) {
    try {
      thumb = await shrinkImage(await dataUrlToBlob(data.imageData), 720)
    } catch {
      thumb = undefined
    }
  }
  return { title: data.title, description: data.description, siteName: data.siteName, image: data.image, isVideo: data.isVideo, source: data.source ?? detectSource(url), thumb }
}

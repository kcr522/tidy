// 앱 쪽: Tidy 서버(api/preview)에 링크 본문과 사이트 캡처를 부탁한다
import { appFetch } from '../../platform/nativeFetch'
import { isNativeApp } from '../../platform/native'
import { blobToBase64, dataUrlToBlob, shrinkImage } from './image'

/** 폰 앱은 웹 주소가 따로 없어서 배포한 사이트로 묻는다 */
const SITE = (import.meta.env.VITE_TIDY_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'
const base = () => `${isNativeApp() ? SITE : ''}/api/preview`

async function ask<T>(url: string, mode: 'content' | 'shot', signal?: AbortSignal, extra = ''): Promise<T> {
  const res = await appFetch()(`${base()}?mode=${mode}${extra}&url=${encodeURIComponent(url)}`, { signal })
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok || !data) throw new Error(data?.error ?? '사이트를 읽지 못했어요')
  return data
}

export interface PageForAi {
  text: string
  /** 작게 줄인 JPEG base64 (AI에 바로 보낸다) */
  images: string[]
}

/** 링크의 본문 글과 사진 (AI 요약용). 사진은 긴 변 1024로 줄인다 */
export async function fetchPageForAi(url: string, signal?: AbortSignal): Promise<PageForAi> {
  const data = await ask<{ text?: string; images?: string[] }>(url, 'content', signal)
  const images: string[] = []
  for (const d of data.images ?? []) {
    try {
      images.push(await blobToBase64(await shrinkImage(await dataUrlToBlob(d), 1024, 0.8)))
    } catch {
      // 못 읽는 사진은 건너뛴다
    }
  }
  return { text: (data.text ?? '').trim(), images }
}

/** 사이트 화면을 자동으로 캡처한 사진 (JPEG). 실패하면 에러 */
export async function fetchSiteShot(url: string, signal?: AbortSignal): Promise<Blob> {
  const data = await ask<{ imageData?: string }>(url, 'shot', signal)
  if (!data.imageData) throw new Error('사이트 화면을 캡처하지 못했어요')
  return shrinkImage(await dataUrlToBlob(data.imageData), 1600, 0.85)
}

/** 링크의 본문 글과 캡션만 (사진 없이). 저장할 때 동영상 캡션·글을 같이 남기려고 */
export async function fetchPageText(url: string, signal?: AbortSignal): Promise<{ text: string; caption: string }> {
  const data = await ask<{ text?: string; caption?: string }>(url, 'content', signal, '&images=0')
  return { text: (data.text ?? '').trim(), caption: (data.caption ?? '').trim() }
}

import { Capacitor, registerPlugin } from '@capacitor/core'
import { isWebUrl } from '../lib/validate'

interface OpenResult {
  cancelled: boolean
  /** JPEG base64 (캡처했을 때만) */
  image?: string
  mime?: string
  pageUrl?: string
}

interface ScrapCapturePlugin {
  open(options: { url: string; mode?: 'capture' | 'view' }): Promise<OpenResult>
}

/** 안드로이드 앱 안 기능 (android/.../ScrapCapturePlugin.java) */
const ScrapCapture = registerPlugin<ScrapCapturePlugin>('ScrapCapture')

/**
 * 앱 안에서 사이트를 열고 화면을 바로 캡처할 수 있는가
 * 안드로이드 앱에서만 된다. 웹·PWA에서는 다른 사이트 화면을 찍을 수 없어서 사진 올리기를 쓴다
 */
export function canCaptureInApp(): boolean {
  return Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('ScrapCapture')
}

function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

/**
 * 링크를 앱 안 화면으로 열고, 사용자가 "이 화면 캡처하기"를 누르면 그 사진을 돌려준다
 * 닫으면 null
 */
export async function openSiteInApp(url: string, mode: 'capture' | 'view' = 'capture'): Promise<Blob | null> {
  if (!isWebUrl(url) || !canCaptureInApp()) return null
  const r = await ScrapCapture.open({ url, mode })
  if (r.cancelled || !r.image) return null
  return base64ToBlob(r.image, r.mime ?? 'image/jpeg')
}

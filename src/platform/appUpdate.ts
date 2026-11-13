import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { LatestApp } from '../lib/appUpdate'
import { isNativeApp } from './native'
import { nativeFetch } from './nativeFetch'

/**
 * 앱 안에서 바로 업데이트하기 (안드로이드 앱의 AppUpdatePlugin)
 * 1) 우리 서버(/api/app-update)에 최신 버전을 묻는다
 * 2) "업데이트 하러 가기" → 폰이 새 APK 를 내려받는다 (진행률 표시)
 * 3) 안드로이드 설치 화면이 뜨고, "업데이트"를 누르면 기록은 그대로 두고 덮어 깔린다
 */
interface AppUpdatePlugin {
  info(): Promise<{ versionCode: number; versionName: string }>
  download(o: { url: string }): Promise<{ ok: boolean; error?: string }>
  install(): Promise<{ status: 'installing' | 'permission' | 'missing' }>
  addListener(event: 'progress', fn: (p: { percent: number; received: number; total: number }) => void): Promise<PluginListenerHandle>
  addListener(event: 'permissionDenied', fn: () => void): Promise<PluginListenerHandle>
}
const Native = registerPlugin<AppUpdatePlugin>('AppUpdate')

/** 폰 앱 안 화면은 주소가 https://localhost 라서, 서버 함수는 배포한 사이트 주소로 부른다 */
export const UPDATE_SERVER = (import.meta.env.VITE_UPDATE_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'
const apiBase = () => (isNativeApp() ? UPDATE_SERVER : '')
export const apkDownloadUrl = () => `${apiBase()}/api/app-update?download=1`

/** 이 앱에서 바로 업데이트할 수 있는가 (안드로이드 앱이고, 업데이트 기능이 들어간 버전) */
export const canUpdateInApp = (): boolean => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('AppUpdate')

/** 지금 깔린 앱 버전. 웹이거나 옛 버전 앱이면 null */
export async function currentAppVersion(): Promise<{ versionCode: number; versionName: string } | null> {
  if (!canUpdateInApp()) return null
  try {
    return await Native.info()
  } catch {
    return null
  }
}

/** 서버에 최신 버전을 묻는다 */
export async function fetchLatestApp(): Promise<LatestApp> {
  const f = isNativeApp() ? nativeFetch : fetch
  let res: Response
  try {
    res = await f(`${apiBase()}/api/app-update`, { headers: { accept: 'application/json' } })
  } catch {
    throw new Error('인터넷 연결을 확인해 주세요')
  }
  const data = (await res.json().catch(() => ({}))) as Partial<LatestApp> & { error?: string }
  if (!res.ok || typeof data.versionCode !== 'number') throw new Error(data.error || `확인하지 못했어요 (${res.status})`)
  return { versionCode: data.versionCode, versionName: data.versionName ?? '', notes: data.notes ?? [], publishedAt: data.publishedAt ?? '', size: data.size ?? 0 }
}

/** 새 APK 를 내려받고 설치 화면을 띄운다. onProgress: 0~100 (크기를 모르면 -1) */
export async function downloadAndInstall(onProgress: (percent: number) => void): Promise<{ status: 'installing' | 'permission' } | { error: string }> {
  const sub = await Native.addListener('progress', (p) => onProgress(p.percent))
  try {
    const r = await Native.download({ url: apkDownloadUrl() })
    if (!r.ok) return { error: r.error || '내려받지 못했어요' }
    const i = await Native.install()
    if (i.status === 'missing') return { error: '받은 파일을 찾지 못했어요' }
    return { status: i.status }
  } catch (err) {
    return { error: err instanceof Error ? err.message : '업데이트하지 못했어요' }
  } finally {
    await sub.remove()
  }
}

/** 설치 허용 화면에서 허용하지 않고 돌아왔을 때 */
export function onInstallPermissionDenied(fn: () => void): () => void {
  if (!canUpdateInApp()) return () => {}
  const p = Native.addListener('permissionDenied', fn)
  return () => void p.then((h) => h.remove())
}

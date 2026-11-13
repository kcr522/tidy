import { registerSW } from 'virtual:pwa-register'
import { isNativeApp } from './native'

/**
 * 서비스 워커(오프라인용 화면 저장본)
 * - 웹·컴퓨터 PWA: 등록하고, 새 버전이 나오면 알아서 바꾼다
 * - 폰 앱: 화면 파일이 이미 앱 안에 들어 있어서 필요 없다. 오히려 앱을 업데이트해도 예전 화면 저장본이 떠서
 *   새 기능이 안 보였다 (사용자 제보 2026-11-13, 1.0.88). 그래서 예전에 등록된 것을 지우고, 지웠으면 한 번 새로 연다
 */
export function setupServiceWorker() {
  if (isNativeApp()) void dropServiceWorkers()
  else registerSW({ immediate: true })
}

export async function dropServiceWorkers(
  sw: ServiceWorkerContainer | undefined = navigator.serviceWorker,
  store: CacheStorage | undefined = globalThis.caches,
  reload: () => void = () => location.reload(),
): Promise<boolean> {
  if (!sw) return false
  try {
    const regs = await sw.getRegistrations()
    if (regs.length === 0) return false
    const controlled = !!sw.controller
    await Promise.all(regs.map((r) => r.unregister()))
    if (store) await Promise.all((await store.keys()).map((k) => store.delete(k)))
    // 지금 화면이 저장본에서 나온 것이면 앱 안의 새 화면으로 다시 연다 (지운 뒤라 다시 반복되지 않는다)
    if (controlled) reload()
    return true
  } catch {
    return false
  }
}

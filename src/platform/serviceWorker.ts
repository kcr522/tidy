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
  else registerSW({ immediate: true, onRegisteredSW: (_url, reg) => reg && watchForUpdates(reg) })
}

/** 새 버전 확인 간격 */
const CHECK_MS = 10 * 60 * 1000

/**
 * 새 버전이 나왔는지 서버에 물어본다 (사용자 제보 2026-11-18: 합친 기능이 사이트에 안 보였다).
 * 브라우저는 페이지를 새로 열 때만 서비스 워커를 확인해서, 탭을 켜 둔 채로 쓰면 예전 화면이 계속 남았다.
 * 그래서 화면으로 돌아올 때와 10분마다 확인한다. 새 버전이 있으면 autoUpdate 가 받아서 화면을 새로 연다
 */
export function watchForUpdates(reg: Pick<ServiceWorkerRegistration, 'update'>, doc: Document = document) {
  let last = Date.now()
  const check = () => {
    last = Date.now()
    reg.update().catch(() => undefined)
  }
  window.setInterval(() => {
    if (doc.visibilityState === 'visible') check()
  }, CHECK_MS)
  doc.addEventListener('visibilitychange', () => {
    // 너무 자주 묻지 않게 1분 안에 다시 돌아온 건 넘긴다
    if (doc.visibilityState === 'visible' && Date.now() - last > 60 * 1000) check()
  })
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

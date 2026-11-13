import { lazy, type ComponentType } from 'react'

const loaders: (() => Promise<unknown>)[] = []
let prefetched = false

/** 화면 하나를 따로 떼어 두고(필요할 때 읽기), 미리 읽기 목록에 넣는다 */
export function lazyPage<T extends ComponentType<object>>(load: () => Promise<{ default: T }>) {
  let p: Promise<{ default: T }> | undefined
  const once = () =>
    (p ??= load().catch((err) => {
      p = undefined
      reloadOnceForNewVersion()
      throw err
    }))
  loaders.push(once)
  return lazy(once)
}

/** 첫 화면이 뜬 뒤 쉬는 틈에 나머지 화면을 하나씩 미리 읽어 둔다 (탭을 옮길 때 기다리지 않게) */
export function prefetchPages() {
  if (prefetched) return
  prefetched = true
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500))
  let i = 0
  const next = () => {
    const load = loaders[i++]
    if (!load) return
    void load()
      .catch(() => undefined)
      .then(() => idle(next))
  }
  idle(next)
}

/**
 * 앱을 켜 둔 사이 새 버전이 올라가면 옛 화면 조각 파일이 없어져 못 읽을 수 있다.
 * 그럴 때는 한 번만 새로 고쳐서 새 버전으로 연다 (계속 실패하면 반복하지 않는다)
 */
function reloadOnceForNewVersion() {
  const KEY = 'tidy-chunk-reload'
  try {
    if (!navigator.onLine || sessionStorage.getItem(KEY)) return
    sessionStorage.setItem(KEY, '1')
    location.reload()
  } catch {
    /* 무시 */
  }
}

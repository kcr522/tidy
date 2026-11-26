import { describe, expect, it, vi } from 'vitest'

// PWA 플러그인이 만드는 모듈이라 테스트에서는 비워 둔다
vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }))

const NOT_CONTROLLED = null

describe('폰 앱 서비스 워커 지우기', () => {
  it('등록된 것을 지우고 저장본도 비운 뒤, 저장본에서 뜬 화면이면 한 번 새로 연다', async () => {
    const { dropServiceWorkers } = await import('../../src/platform/serviceWorker')
    const unregister = vi.fn(async () => true)
    const workers = { controller: {}, getRegistrations: async () => [{ unregister }] } as unknown as ServiceWorkerContainer
    const cacheNames = ['workbox-precache-v2', 'tidy-fonts']
    const deleteCache = vi.fn(async () => true)
    const caches = { keys: async () => cacheNames, delete: deleteCache } as unknown as CacheStorage
    const reload = vi.fn()

    const dropped = await dropServiceWorkers(workers, caches, reload)

    expect(dropped).toBe(true)
    expect(unregister).toHaveBeenCalled()
    expect(deleteCache).toHaveBeenCalledTimes(cacheNames.length)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('이미 없으면 아무것도 안 하고 새로 열지도 않는다 (무한 새로고침 없음)', async () => {
    const { dropServiceWorkers } = await import('../../src/platform/serviceWorker')
    const reload = vi.fn()
    const workers = { controller: NOT_CONTROLLED, getRegistrations: async () => [] } as unknown as ServiceWorkerContainer

    const dropped = await dropServiceWorkers(workers, undefined, reload)

    expect(dropped).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

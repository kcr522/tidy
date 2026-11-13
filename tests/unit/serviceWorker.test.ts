import { describe, expect, it, vi } from 'vitest'

vi.mock('virtual:pwa-register', () => ({ registerSW: vi.fn() }))

describe('폰 앱 서비스 워커 지우기', () => {
  it('등록된 것을 지우고 저장본도 비운 뒤, 저장본에서 뜬 화면이면 한 번 새로 연다', async () => {
    const { dropServiceWorkers } = await import('../../src/platform/serviceWorker')
    const unregister = vi.fn(async () => true)
    const sw = { controller: {}, getRegistrations: async () => [{ unregister }] } as unknown as ServiceWorkerContainer
    const del = vi.fn(async () => true)
    const store = { keys: async () => ['workbox-precache-v2', 'tidy-fonts'], delete: del } as unknown as CacheStorage
    const reload = vi.fn()
    expect(await dropServiceWorkers(sw, store, reload)).toBe(true)
    expect(unregister).toHaveBeenCalled()
    expect(del).toHaveBeenCalledTimes(2)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('이미 없으면 아무것도 안 하고 새로 열지도 않는다 (무한 새로고침 없음)', async () => {
    const { dropServiceWorkers } = await import('../../src/platform/serviceWorker')
    const reload = vi.fn()
    const sw = { controller: null, getRegistrations: async () => [] } as unknown as ServiceWorkerContainer
    expect(await dropServiceWorkers(sw, undefined, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})

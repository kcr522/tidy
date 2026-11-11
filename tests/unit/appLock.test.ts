import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, isPin, loadLock, removeLock, setLockAfter, setPin, shouldRelock, verifyPin, waitAfterFails } from '../../src/lib/appLock'

// node 테스트 환경용 간단한 localStorage
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
  removeItem: (k: string) => store.delete(k),
}
;(globalThis as Record<string, unknown>).window = new EventTarget()
;(globalThis as Record<string, unknown>).CustomEvent ??= class extends Event {}

describe('앱 잠금', () => {
  beforeEach(() => store.clear())

  it('비밀번호는 숫자 4자리만', () => {
    expect(isPin('1234')).toBe(true)
    expect(isPin('123')).toBe(false)
    expect(isPin('12a4')).toBe(false)
  })

  it('정한 비밀번호만 맞고, 비밀번호 자체는 저장하지 않는다', async () => {
    await setPin('2580')
    expect(await verifyPin('2580')).toBe(true)
    expect(await verifyPin('0000')).toBe(false)
    expect(JSON.stringify([...store.values()])).not.toContain('2580')
    await expect(setPin('12')).rejects.toThrow('4자리')
  })

  it('같은 비밀번호라도 소금이 다르면 다른 값', async () => {
    expect(await hashPin('1111', 'a')).not.toBe(await hashPin('1111', 'b'))
  })

  it('잠그는 시간 바꾸기, 끄기', async () => {
    await setPin('1234')
    setLockAfter(60)
    expect(loadLock()?.after).toBe(60)
    await setPin('4321')
    expect(loadLock()?.after).toBe(60) // 비밀번호를 바꿔도 시간은 그대로
    removeLock()
    expect(loadLock()).toBeNull()
    expect(await verifyPin('9999')).toBe(true)
  })

  it('돌아왔을 때: 정한 시간이 지나야 잠근다', () => {
    expect(shouldRelock(null, 10_000, 0)).toBe(false)
    expect(shouldRelock(10_000, 10_000, 0)).toBe(true)
    expect(shouldRelock(0, 59_000, 60)).toBe(false)
    expect(shouldRelock(0, 60_000, 60)).toBe(true)
  })

  it('여러 번 틀리면 기다리게 한다', () => {
    expect(waitAfterFails(4)).toBe(0)
    expect(waitAfterFails(5)).toBe(30)
    expect(waitAfterFails(10)).toBe(60)
    expect(waitAfterFails(100)).toBe(300)
  })
})

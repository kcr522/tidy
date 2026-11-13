import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, isPassword, isPin, loadLock, removeLock, secretProblem, setBiometric, setLockAfter, setPin, setSecret, shouldRelock, verifyPin, verifySecret, waitAfterFails } from '../../src/lib/appLock'

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

describe('앱 잠금 방식: 숫자 4자리 / 8자리 이상 비밀번호, 지문', () => {
  beforeEach(() => store.clear())

  it('비밀번호 방식은 8~64자, 공백만은 안 된다', () => {
    expect(isPassword('abcd1234')).toBe(true)
    expect(isPassword('abc123')).toBe(false)
    expect(isPassword('        ')).toBe(false)
    expect(isPassword('a'.repeat(65))).toBe(false)
    expect(secretProblem('password', 'short')).toContain('8자리')
    expect(secretProblem('pin', '12345')).toContain('4자리')
    expect(secretProblem('password', '숫자랑글자섞기12')).toBeNull()
  })

  it('비밀번호 방식으로 정하고 풀기, 해시만 저장', async () => {
    await setSecret('password', 'tidy-love-2026')
    expect(loadLock()?.kind).toBe('password')
    expect(await verifySecret('tidy-love-2026')).toBe(true)
    expect(await verifySecret('tidy-love-2025')).toBe(false)
    expect(JSON.stringify([...store.values()])).not.toContain('tidy-love')
    await expect(setSecret('password', '1234')).rejects.toThrow('8자리')
  })

  it('예전에 저장한 잠금(방식 없음)은 숫자 4자리로 읽는다', async () => {
    store.set('tidy-app-lock', JSON.stringify({ hash: await hashPin('1234', 's'), salt: 's', after: 60 }))
    expect(loadLock()).toMatchObject({ kind: 'pin', after: 60, bio: false })
    expect(await verifySecret('1234')).toBe(true)
  })

  it('방식을 바꿔도 지문과 잠그는 시간은 그대로', async () => {
    await setPin('1234')
    setLockAfter(300)
    setBiometric(true)
    await setSecret('password', 'longer-password')
    expect(loadLock()).toMatchObject({ kind: 'password', after: 300, bio: true })
    setBiometric(false)
    expect(loadLock()?.bio).toBe(false)
  })
})

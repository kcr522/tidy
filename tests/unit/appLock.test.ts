import { beforeEach, describe, expect, it } from 'vitest'
import { hashPin, isPassword, isPin, loadLock, removeLock, secretProblem, setBiometric, setLockAfter, setPin, setSecret, shouldRelock, verifyPin, verifySecret, waitAfterFails } from '../../src/lib/appLock'

// node 테스트 환경용 간단한 localStorage
const store = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
}
;(globalThis as Record<string, unknown>).window = new EventTarget()
;(globalThis as Record<string, unknown>).CustomEvent ??= class extends Event {}

const savedText = () => JSON.stringify([...store.values()])

const MIN_PASSWORD = 8
const MAX_PASSWORD = 64
const ONE_MINUTE = 60
const FIVE_MINUTES = 300

describe('앱 잠금', () => {
  beforeEach(() => store.clear())

  it.each([
    ['1234', true],
    ['123', false],
    ['12a4', false],
  ])('숫자 비밀번호 "%s" 가 숫자 4자리인가: %s', (pin, isOk) => {
    expect(isPin(pin)).toBe(isOk)
  })

  it('정한 숫자 비밀번호만 맞고, 비밀번호 자체는 저장하지 않는다', async () => {
    const okPin = '2580'
    const wrongPin = '0000'

    await setPin(okPin)

    expect(await verifyPin(okPin)).toBe(true)
    expect(await verifyPin(wrongPin)).toBe(false)
    expect(savedText()).not.toContain(okPin)
  })

  it('숫자 비밀번호가 4자리가 아니면 정하지 않는다', async () => {
    const shortPin = '12'

    await expect(setPin(shortPin)).rejects.toThrow('4자리')
  })

  it('같은 비밀번호라도 소금이 다르면 다른 값이 된다', async () => {
    const samePin = '1111'

    const first = await hashPin(samePin, 'a')
    const second = await hashPin(samePin, 'b')

    expect(first).not.toBe(second)
  })

  it('비밀번호를 바꿔도 정해 둔 잠그는 시간은 그대로다', async () => {
    await setPin('1234')
    setLockAfter(ONE_MINUTE)

    await setPin('4321')

    expect(loadLock()?.after).toBe(ONE_MINUTE)
  })

  it('잠금을 끄면 저장한 잠금이 없어지고 어떤 비밀번호든 통과한다', async () => {
    await setPin('1234')
    const anyPin = '9999'

    removeLock()

    expect(loadLock()).toBeNull()
    expect(await verifyPin(anyPin)).toBe(true)
  })

  const NEVER_LEFT = null
  const LOCK_AT_ONCE = 0

  it.each([
    ['나간 적이 없으면', NEVER_LEFT, 10_000, LOCK_AT_ONCE, false],
    ['바로 잠금이면 돌아오자마자', 10_000, 10_000, LOCK_AT_ONCE, true],
    ['1분 잠금에서 59초 뒤', 0, 59_000, ONE_MINUTE, false],
    ['1분 잠금에서 딱 60초 뒤', 0, 60_000, ONE_MINUTE, true],
  ] as const)('돌아왔을 때 %s 다시 잠그는가: $4', (_case, leftAt, now, after, isLocked) => {
    expect(shouldRelock(leftAt, now, after)).toBe(isLocked)
  })

  it.each([
    [4, 0],
    [5, 30],
    [10, 60],
    [100, 300],
  ])('%i번 틀리면 %i초 기다리게 한다', (fails, seconds) => {
    expect(waitAfterFails(fails)).toBe(seconds)
  })
})

describe('앱 잠금 방식: 숫자 4자리 / 8자리 이상 비밀번호, 지문', () => {
  beforeEach(() => store.clear())

  it.each([
    ['딱 8자', 'abcd1234', true],
    ['7자', 'abc1234', false],
    ['공백만 8자', ' '.repeat(MIN_PASSWORD), false],
    ['딱 64자', 'a'.repeat(MAX_PASSWORD), true],
    ['65자', 'a'.repeat(MAX_PASSWORD + 1), false],
  ])('글자 비밀번호가 %s 이면 쓸 수 있는가: $2', (_case, password, isOk) => {
    expect(isPassword(password)).toBe(isOk)
  })

  it('방식에 맞지 않는 비밀번호는 무엇이 모자란지 알려 준다', () => {
    expect(secretProblem('password', 'short')).toContain('8자리')
    expect(secretProblem('pin', '12345')).toContain('4자리')
  })

  it('방식에 맞는 비밀번호는 문제가 없다', () => {
    const okPassword = '숫자랑글자섞기12'

    expect(secretProblem('password', okPassword)).toBeNull()
  })

  it('글자 비밀번호로 정하면 그 비밀번호로만 풀리고 해시만 저장한다', async () => {
    const okPassword = 'tidy-love-2026'

    await setSecret('password', okPassword)

    expect(loadLock()?.kind).toBe('password')
    expect(await verifySecret(okPassword)).toBe(true)
    expect(await verifySecret('tidy-love-2025')).toBe(false)
    expect(savedText()).not.toContain('tidy-love')
  })

  it('글자 비밀번호 방식에 4자리를 넣으면 정하지 않는다', async () => {
    await expect(setSecret('password', '1234')).rejects.toThrow('8자리')
  })

  it('예전에 저장한 잠금(방식 없음)은 숫자 4자리로 읽는다', async () => {
    const oldLock = { hash: await hashPin('1234', 's'), salt: 's', after: ONE_MINUTE }
    store.set('tidy-app-lock', JSON.stringify(oldLock))

    const lock = loadLock()

    expect(lock).toMatchObject({ kind: 'pin', after: ONE_MINUTE, bio: false })
    expect(await verifySecret('1234')).toBe(true)
  })

  it('방식을 바꿔도 지문과 잠그는 시간은 그대로다', async () => {
    await setPin('1234')
    setLockAfter(FIVE_MINUTES)
    setBiometric(true)

    await setSecret('password', 'longer-password')

    expect(loadLock()).toMatchObject({ kind: 'password', after: FIVE_MINUTES, bio: true })
  })

  it('지문을 끄면 저장한 잠금에도 꺼짐으로 남는다', async () => {
    await setPin('1234')
    setBiometric(true)

    setBiometric(false)

    expect(loadLock()?.bio).toBe(false)
  })
})

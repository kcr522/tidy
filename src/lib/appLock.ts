/**
 * 앱 잠금 (사용자 요청 2026-11-10)
 * 비밀번호를 정하면 앱을 켤 때, 그리고 다른 앱에 갔다가 돌아올 때 잠금 화면이 나온다.
 * 잠금 방식은 둘 중 하나 (2026-11-11): 숫자 4자리(PIN) 또는 8자리 이상 비밀번호.
 * 폰 앱에서는 지문(기기에 등록된 생체 인증)으로도 풀 수 있다. 지문이 안 되면 언제든 비밀번호로 푼다.
 * 비밀번호는 그대로 저장하지 않고 PBKDF2로 바꾼 값만 이 기기(localStorage)에 둔다.
 * 다른 사람이 폰에서 가계부·일기를 바로 못 보게 하는 잠금이고, 기기 안의 데이터를 암호화하지는 않는다.
 */

export const PIN_LENGTH = 4
export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 64
/** pin = 숫자 4자리, password = 8자리 이상 글자 */
export type LockKind = 'pin' | 'password'
/** 돌아왔을 때 잠그기까지 (초). 0 = 바로 */
export const LOCK_AFTER = [0, 60, 300] as const
export type LockAfter = (typeof LOCK_AFTER)[number]

export interface LockSettings {
  kind: LockKind
  hash: string
  salt: string
  after: LockAfter
  /** 지문으로도 풀기 (폰 앱에서만) */
  bio: boolean
}

const KEY = 'tidy-app-lock'
const EVENT = 'tidy:app-lock'
const ITERATIONS = 100_000

export const isPin = (v: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v)
/** 8~64자, 공백만으로는 안 된다 */
export const isPassword = (v: string) => v.length >= PASSWORD_MIN && v.length <= PASSWORD_MAX && v.trim().length > 0

/** 정하려는 비밀번호가 안 맞으면 이유, 맞으면 null */
export function secretProblem(kind: LockKind, v: string): string | null {
  if (kind === 'pin') return isPin(v) ? null : `숫자 ${PIN_LENGTH}자리로 정해 주세요`
  if (v.length < PASSWORD_MIN) return `${PASSWORD_MIN}자리 이상으로 정해 주세요`
  if (v.length > PASSWORD_MAX) return `${PASSWORD_MAX}자리까지 정할 수 있어요`
  if (!v.trim()) return '띄어쓰기만으로는 정할 수 없어요'
  return null
}

const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

export async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: ITERATIONS }, key, 256)
  return toHex(bits)
}

export function loadLock(): LockSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<LockSettings> | null
    if (!v || typeof v.hash !== 'string' || typeof v.salt !== 'string') return null
    return {
      // 지난 버전(PIN만 있던 때)에 저장한 잠금은 PIN
      kind: v.kind === 'password' ? 'password' : 'pin',
      hash: v.hash,
      salt: v.salt,
      after: (LOCK_AFTER as readonly number[]).includes(v.after as number) ? (v.after as LockAfter) : 0,
      bio: v.bio === true,
    }
  } catch {
    return null
  }
}

function save(v: LockSettings | null) {
  if (v) localStorage.setItem(KEY, JSON.stringify(v))
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onLockChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** 비밀번호를 정하거나 바꾼다 (방식도 함께 바꿀 수 있다). 잠그는 시간과 지문 설정은 그대로 둔다 */
export async function setSecret(kind: LockKind, secret: string, after?: LockAfter): Promise<void> {
  const problem = secretProblem(kind, secret)
  if (problem) throw new Error(problem)
  const prev = loadLock()
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  save({ kind, hash: await hashPin(secret, salt), salt, after: after ?? prev?.after ?? 0, bio: prev?.bio ?? false })
}

/** 숫자 4자리로 정한다 */
export const setPin = (pin: string, after?: LockAfter) => setSecret('pin', pin, after)

/** 지금 정한 PIN 또는 비밀번호가 맞는지 */
export async function verifySecret(secret: string): Promise<boolean> {
  const lock = loadLock()
  if (!lock) return true
  return (await hashPin(secret, lock.salt)) === lock.hash
}
export const verifyPin = verifySecret

/** 지문으로도 풀기 켜기/끄기 */
export function setBiometric(on: boolean) {
  const lock = loadLock()
  if (lock) save({ ...lock, bio: on })
}

export function setLockAfter(after: LockAfter) {
  const lock = loadLock()
  if (lock) save({ ...lock, after })
}

export function removeLock() {
  save(null)
}

/** 다른 앱에 갔다 돌아왔을 때 잠글지 */
export function shouldRelock(hiddenAt: number | null, now: number, after: LockAfter): boolean {
  return hiddenAt != null && now - hiddenAt >= after * 1000
}

/** 틀린 횟수에 따른 대기 시간 (초): 5번 틀리면 30초, 그 뒤로 5번마다 늘어난다 */
export function waitAfterFails(fails: number): number {
  if (fails < 5) return 0
  return Math.min(300, 30 * 2 ** (Math.floor(fails / 5) - 1))
}

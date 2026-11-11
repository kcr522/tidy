/**
 * 앱 잠금 (사용자 요청 2026-11-10)
 * 비밀번호 4자리를 정하면 앱을 켤 때, 그리고 다른 앱에 갔다가 돌아올 때 잠금 화면이 나온다.
 * 비밀번호는 그대로 저장하지 않고 PBKDF2로 바꾼 값만 이 기기(localStorage)에 둔다.
 * 다른 사람이 폰에서 가계부·일기를 바로 못 보게 하는 잠금이고, 기기 안의 데이터를 암호화하지는 않는다.
 */

export const PIN_LENGTH = 4
/** 돌아왔을 때 잠그기까지 (초). 0 = 바로 */
export const LOCK_AFTER = [0, 60, 300] as const
export type LockAfter = (typeof LOCK_AFTER)[number]

export interface LockSettings {
  hash: string
  salt: string
  after: LockAfter
}

const KEY = 'tidy-app-lock'
const EVENT = 'tidy:app-lock'
const ITERATIONS = 100_000

export const isPin = (v: string) => new RegExp(`^\\d{${PIN_LENGTH}}$`).test(v)

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
    return { hash: v.hash, salt: v.salt, after: (LOCK_AFTER as readonly number[]).includes(v.after as number) ? (v.after as LockAfter) : 0 }
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

/** 비밀번호를 정하거나 바꾼다 */
export async function setPin(pin: string, after?: LockAfter): Promise<void> {
  if (!isPin(pin)) throw new Error(`숫자 ${PIN_LENGTH}자리로 정해 주세요`)
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  save({ hash: await hashPin(pin, salt), salt, after: after ?? loadLock()?.after ?? 0 })
}

export async function verifyPin(pin: string): Promise<boolean> {
  const lock = loadLock()
  if (!lock) return true
  return (await hashPin(pin, lock.salt)) === lock.hash
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

/**
 * 기기 동기화 상태 (이 기기의 localStorage 에 둔다)
 * - uid: 이 기기 데이터가 이어져 있는 구글 계정. 로그아웃하면 지운다
 * - device: 계정 안에서 이 기기 번호 (1부터). 새 기록 번호(id)를 기기마다 다른 구간에서 만든다
 * - seq: 이 기기에서 만든 마지막 순번
 * - pulled: 클라우드에서 마지막으로 받은 시각 (ms)
 * - dirty: 아직 못 올린 기록 ("표|키" → 바뀐 횟수)
 */

const KEY = 'tidy-sync'
const SKIP_KEY = 'tidy-login-skipped'

export interface SyncState {
  uid: string
  email?: string
  device: number
  seq: number
  pulled: number
  dirty: Record<string, number>
}

/** 기기 하나가 만들 수 있는 기록 수. 기록 번호 = 기기 번호 × 이 값 + 순번 */
export const ID_BLOCK = 100_000
/** 기기 번호 최대 (번호가 알림 id(32비트 정수) 안에 들어가게) */
export const MAX_DEVICE = 9_999

let cache: SyncState | null | undefined

export function loadSync(): SyncState | null {
  if (cache !== undefined) return cache
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as SyncState | null
    cache = v && typeof v.uid === 'string' && typeof v.device === 'number' ? { ...v, dirty: v.dirty ?? {} } : null
  } catch {
    cache = null
  }
  return cache
}

export function saveSync(s: SyncState | null) {
  cache = s
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s))
    else localStorage.removeItem(KEY)
  } catch {
    /* 저장을 못 해도 이번 실행 동안은 메모리로 쓴다 */
  }
}

/** 테스트용 */
export function resetSyncCache() {
  cache = undefined
}

/** 다음 기록 번호. 동기화 중이 아니면 undefined (그냥 1, 2, 3… 으로 만든다) */
export function nextId(): number | undefined {
  const s = loadSync()
  if (!s) return undefined
  const seq = s.seq + 1
  if (seq >= ID_BLOCK) return undefined
  saveSync({ ...s, seq })
  return idFor(s.device, seq)
}

export const idFor = (device: number, seq: number) => device * ID_BLOCK + seq

/** 이 기기 구간에 이미 있는 가장 큰 순번 (localStorage 가 지워졌을 때 같은 번호를 또 만들지 않게) */
export function maxSeqIn(device: number, ids: number[]): number {
  let max = 0
  for (const id of ids) if (id >= device * ID_BLOCK && id < (device + 1) * ID_BLOCK) max = Math.max(max, id - device * ID_BLOCK)
  return max
}

export const dirtyKey = (table: string, key: unknown) => `${table}|${JSON.stringify(key)}`
export function parseDirtyKey(k: string): { table: string; key: unknown } {
  const i = k.indexOf('|')
  return { table: k.slice(0, i), key: JSON.parse(k.slice(i + 1)) }
}

export function markDirty(table: string, key: unknown) {
  const s = loadSync()
  if (!s) return
  const k = dirtyKey(table, key)
  saveSync({ ...s, dirty: { ...s.dirty, [k]: (s.dirty[k] ?? 0) + 1 } })
}

/** 올린 기록을 지운다. 올리는 동안 또 바뀌었으면(횟수가 다르면) 남겨 둔다 */
export function clearDirty(done: Record<string, number>) {
  const s = loadSync()
  if (!s) return
  const dirty = { ...s.dirty }
  for (const [k, n] of Object.entries(done)) if (dirty[k] === n) delete dirty[k]
  saveSync({ ...s, dirty })
}

export const isDirty = (table: string, key: unknown) => (loadSync()?.dirty[dirtyKey(table, key)] ?? 0) > 0

export function loginSkipped(): boolean {
  try {
    return localStorage.getItem(SKIP_KEY) === '1'
  } catch {
    return false
  }
}

export function setLoginSkipped(v: boolean) {
  try {
    if (v) localStorage.setItem(SKIP_KEY, '1')
    else localStorage.removeItem(SKIP_KEY)
  } catch {
    /* 무시 */
  }
}

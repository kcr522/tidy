/**
 * 이동 기록 클라우드 맞추기 (사용자 요청 2026-11-26 "이동기록이 핸드폰 앱과 사이트가 동일하게 안보이네")
 *
 * 이동 기록은 본 DB 와 따로 있어서 기기 동기화(engine.ts)에 안 들어갔다. 그래서 폰이 남긴 길이 사이트에는 안 보였다.
 * 구글로 로그인한 사람만, 하루를 문서 하나로 올리고 받는다.
 *   users/{uid}/route/{YYYY-MM-DD}  { p: [t, lat, lng, acc, src(0 폰 · 1 웹), …], c: 지운 시각(ms), u: 서버 시각 }
 * - 하루 점은 2분마다 하나라 많아야 몇 천 개 (점 하나 약 40바이트) → 문서 한도 1MB 안
 * - 합칠 때는 시각(t)으로 겹친 점을 하나로. "이 날 지우기"는 c 로 남겨서 다른 기기도 그 전 점을 지운다
 * - 30일 지난 날 문서는 지운다
 */
import type { DocumentData, Firestore, Unsubscribe } from 'firebase/firestore'
import { todayKey } from '../date'
import type { RouteSrc } from '../route'
import { onRouteChange, routeStore, type StoredPoint } from '../routeStore'

const STRIDE = 5
const CLEARED_KEY = 'tidy.route.cleared'

export interface DayDoc {
  points: StoredPoint[]
  clearedAt: number
}

/** 문서 → 점들 */
export function decodeDay(date: string, data: DocumentData | undefined): DayDoc {
  const p = Array.isArray(data?.p) ? (data!.p as number[]) : []
  const points: StoredPoint[] = []
  for (let i = 0; i + STRIDE <= p.length; i += STRIDE) {
    const [t, lat, lng, acc, src] = p.slice(i, i + STRIDE)
    if (![t, lat, lng].every(Number.isFinite)) continue
    points.push({ t, lat, lng, acc: acc || 0, date, src: (src === 1 ? 'w' : 'a') as RouteSrc })
  }
  return { points, clearedAt: Number(data?.c) || 0 }
}

/** 점들 → 문서의 p (시각 순) */
export function encodePoints(points: StoredPoint[]): number[] {
  const out: number[] = []
  for (const q of [...points].sort((a, b) => a.t - b.t)) out.push(q.t, Math.round(q.lat * 1e6) / 1e6, Math.round(q.lng * 1e6) / 1e6, Math.round(q.acc || 0), q.src === 'w' ? 1 : 0)
  return out
}

/** 두 쪽 점을 시각으로 합친다. clearedAt 이전 점은 뺀다 */
export function mergeDay(local: StoredPoint[], remote: StoredPoint[], clearedAt: number): StoredPoint[] {
  const byT = new Map<number, StoredPoint>()
  for (const q of remote) if (q.t > clearedAt) byT.set(q.t, q)
  for (const q of local) if (q.t > clearedAt) byT.set(q.t, q)
  return [...byT.values()].sort((a, b) => a.t - b.t)
}

/** 이 기기에서 지운 날과 시각 (아직 못 올렸어도 기억) */
function loadCleared(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(CLEARED_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
function saveCleared(v: Record<string, number>) {
  try {
    localStorage.setItem(CLEARED_KEY, JSON.stringify(v))
  } catch {
    // 못 남겨도 이번 실행 동안은 올린다
  }
}

let fs: { db: Firestore; uid: string } | null = null
let unsub: Unsubscribe | null = null
let offChange: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined
const dirty = new Set<string>()
let pushing: Promise<void> | null = null
/** 클라우드에 있는 날 → 그 문서의 점 시각들 (안 올린 점 찾기) */
const remoteTs = new Map<string, Set<number>>()

function schedule(delay = 3000) {
  if (!fs) return
  clearTimeout(timer)
  timer = setTimeout(() => void pushRouteNow().catch(() => undefined), delay)
}

const onOnline = () => dirty.size && schedule(500)

/** 기기 동기화가 시작될 때 같이 */
export async function startRouteSync(db: Firestore, uid: string) {
  stopRouteSync()
  fs = { db, uid }
  offChange = onRouteChange((c) => {
    if (c.kind === 'clear') {
      const cleared = loadCleared()
      for (const d of c.dates) cleared[d] = c.at
      saveCleared(cleared)
    }
    c.dates.forEach((d) => dirty.add(d))
    schedule()
  })
  window.addEventListener('online', onOnline)
  // 못 올리고 남은 지우기
  Object.keys(loadCleared()).forEach((d) => dirty.add(d))
  const { collection, onSnapshot } = await import('firebase/firestore')
  if (!fs || fs.uid !== uid) return
  let first = true
  unsub = onSnapshot(
    collection(db, 'users', uid, 'route'),
    (snap) => {
      const changes = snap.docChanges().filter((ch) => ch.type !== 'removed' && !ch.doc.metadata.hasPendingWrites)
      const wasFirst = first
      first = false
      void applySnapshot(
        changes.map((ch) => ({ date: ch.doc.id, data: ch.doc.data() })),
        wasFirst,
      ).catch(() => undefined)
    },
    () => undefined,
  )
}

export function stopRouteSync() {
  unsub?.()
  unsub = null
  offChange?.()
  offChange = null
  clearTimeout(timer)
  window.removeEventListener('online', onOnline)
  fs = null
  remoteTs.clear()
}

async function applySnapshot(docs: { date: string; data: DocumentData }[], first: boolean) {
  const cutoff = routeStore.cutoffKey(todayKey())
  const cleared = loadCleared()
  for (const { date, data } of docs) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (date < cutoff) {
      dirty.add(date) // 오래된 문서는 올릴 때 지운다
      continue
    }
    const day = decodeDay(date, data)
    remoteTs.set(date, new Set(day.points.map((q) => q.t)))
    const clearedAt = Math.max(day.clearedAt, cleared[date] ?? 0)
    await routeStore.applyRemote(date, day.points.filter((q) => q.t > clearedAt), day.clearedAt)
    // 이 기기에만 있는 점이 있으면 올린다
    const local = await routeStore.rawByDate(date)
    if (cleared[date] > day.clearedAt || local.some((q) => q.t > clearedAt && !remoteTs.get(date)!.has(q.t))) dirty.add(date)
  }
  if (first) {
    // 클라우드에 아직 없는 날 (예전에 폰에만 쌓인 기록)
    for (const d of await routeStore.dates()) if (d >= cutoff && !remoteTs.has(d)) dirty.add(d)
  }
  if (dirty.size) schedule(first ? 500 : 3000)
}

/** 바뀐 날들을 지금 올린다 */
export function pushRouteNow(): Promise<void> {
  if (!fs) return Promise.resolve()
  pushing ??= doPush().finally(() => (pushing = null))
  return pushing
}

async function doPush() {
  if (!fs || dirty.size === 0) return
  const { db, uid } = fs
  const { deleteDoc, doc, runTransaction, serverTimestamp } = await import('firebase/firestore')
  const cutoff = routeStore.cutoffKey(todayKey())
  for (const date of [...dirty]) {
    dirty.delete(date)
    const ref = doc(db, 'users', uid, 'route', date)
    try {
      if (date < cutoff) {
        await deleteDoc(ref)
        continue
      }
      const cleared = loadCleared()
      const local = await routeStore.rawByDate(date)
      const merged = await runTransaction(db, async (tx) => {
        const day = decodeDay(date, (await tx.get(ref)).data())
        const clearedAt = Math.max(day.clearedAt, cleared[date] ?? 0)
        const all = mergeDay(local, day.points, clearedAt)
        tx.set(ref, { p: encodePoints(all), c: clearedAt, u: serverTimestamp() })
        return all
      })
      remoteTs.set(date, new Set(merged.map((q) => q.t)))
      if (cleared[date]) {
        const now = loadCleared()
        delete now[date]
        saveCleared(now)
      }
    } catch {
      // 인터넷이 없거나 막히면 다음에 다시
      dirty.add(date)
    }
  }
  if (dirty.size) schedule(60_000)
}

/** 테스트용 */
export const _routeSyncDirty = dirty

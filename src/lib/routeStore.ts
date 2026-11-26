import { Capacitor } from '@capacitor/core'
import Dexie, { type Table } from 'dexie'
import { parseDateKey, toDateKey } from './date'
import { KEEP_DAYS, preferPhone, type RoutePoint, type RouteSrc } from './route'

/**
 * 이동 기록 저장소 (사용자 요청 2026-11-21)
 * 위치는 민감해서 Tidy 본 DB 와 따로 둔다: 백업 파일에는 들어가지 않는다.
 * 구글로 로그인했으면 폰 · 사이트가 같은 기록을 보도록 따로 클라우드에 맞춘다 (sync/routeSync.ts, 2026-11-26)
 */
export interface StoredPoint extends RoutePoint {
  /** YYYY-MM-DD (이 기기 시간대 기준) */
  date: string
  /** 남긴 기기 (예전 기록은 없음 = 폰) */
  src?: RouteSrc
}

class RouteDB extends Dexie {
  points!: Table<StoredPoint, number>
  constructor() {
    super('tidy-route')
    this.version(1).stores({ points: '&t, date' })
  }
}

let routeDb: RouteDB | null = null
const getDb = () => (routeDb ??= new RouteDB())

/** 이 기기에서 남긴 점의 출처 */
export const hereSrc = (): RouteSrc => (Capacitor.isNativePlatform() ? 'a' : 'w')

type Change = { kind: 'add'; dates: string[] } | { kind: 'clear'; dates: string[]; at: number }
const listeners = new Set<(c: Change) => void>()
/** 이 기기에서 바뀌면 알린다 (클라우드 동기화가 듣는다) */
export function onRouteChange(fn: (c: Change) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const emit = (c: Change) => listeners.forEach((l) => l(c))

const cutoffKey = (today: string) => {
  const d = parseDateKey(today)
  d.setDate(d.getDate() - KEEP_DAYS)
  return toDateKey(d)
}

export const routeStore = {
  async add(points: RoutePoint[], src: RouteSrc = hereSrc()): Promise<number> {
    if (points.length === 0) return 0
    const rows: StoredPoint[] = points.map((p) => ({ t: p.t, lat: p.lat, lng: p.lng, acc: p.acc ?? 0, date: toDateKey(new Date(p.t)), src }))
    await getDb().points.bulkPut(rows)
    emit({ kind: 'add', dates: [...new Set(rows.map((r) => r.date))] })
    return rows.length
  },
  /** 그 날 점 (폰 · 컴퓨터가 겹치는 시간대는 폰 것만) */
  async listByDate(date: string): Promise<StoredPoint[]> {
    return preferPhone(await getDb().points.where('date').equals(date).sortBy('t'))
  },
  /** 그 날 점 전부 (동기화용) */
  rawByDate(date: string): Promise<StoredPoint[]> {
    return getDb().points.where('date').equals(date).toArray()
  },
  /** 가장 최근에 남은 위치 (기록이 없는 날 지도를 어디에 둘지) */
  latest(): Promise<StoredPoint | undefined> {
    return getDb().points.orderBy('t').last()
  },
  /** 기록이 있는 날들 (최근 순) */
  async dates(): Promise<string[]> {
    const keys = (await getDb().points.orderBy('date').uniqueKeys()) as string[]
    return keys.reverse()
  },
  /** KEEP_DAYS 보다 오래된 기록 지우기 */
  prune(today: string): Promise<number> {
    return getDb().points.where('date').below(cutoffKey(today)).delete()
  },
  cutoffKey,
  async clearDate(date: string): Promise<number> {
    const n = await getDb().points.where('date').equals(date).delete()
    emit({ kind: 'clear', dates: [date], at: Date.now() })
    return n
  },
  async clearAll(): Promise<void> {
    const dates = await routeStore.dates()
    await getDb().points.clear()
    emit({ kind: 'clear', dates, at: Date.now() })
  },
  /** 클라우드에서 받은 것 넣기 · 지우기 (다시 알리지 않는다) */
  async applyRemote(date: string, points: StoredPoint[], clearedAt: number): Promise<void> {
    const db = getDb()
    await db.transaction('rw', db.points, async () => {
      if (clearedAt > 0) await db.points.where('date').equals(date).and((p) => p.t <= clearedAt).delete()
      if (points.length) await db.points.bulkPut(points)
    })
  },
  /** 로그아웃하며 이 기기 데이터를 지울 때 (클라우드에는 알리지 않는다) */
  async wipeLocal(): Promise<void> {
    await getDb().points.clear()
  },
}

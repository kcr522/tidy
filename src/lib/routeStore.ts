import Dexie, { type Table } from 'dexie'
import { parseDateKey, toDateKey } from './date'
import { KEEP_DAYS, type RoutePoint } from './route'

/**
 * 이동 기록 저장소 (사용자 요청 2026-11-21)
 * 위치는 민감해서 Tidy 본 DB 와 따로 둔다: 구글 동기화 · 백업 파일에 들어가지 않고 이 기기에만 있다.
 */
export interface StoredPoint extends RoutePoint {
  /** YYYY-MM-DD (이 기기 시간대 기준) */
  date: string
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

export const routeStore = {
  async add(points: RoutePoint[]): Promise<number> {
    if (points.length === 0) return 0
    const rows = points.map((p) => ({ t: p.t, lat: p.lat, lng: p.lng, acc: p.acc ?? 0, date: toDateKey(new Date(p.t)) }))
    await getDb().points.bulkPut(rows)
    return rows.length
  },
  listByDate(date: string): Promise<StoredPoint[]> {
    return getDb().points.where('date').equals(date).sortBy('t')
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
    const d = parseDateKey(today)
    d.setDate(d.getDate() - KEEP_DAYS)
    return getDb().points.where('date').below(toDateKey(d)).delete()
  },
  clearDate(date: string): Promise<number> {
    return getDb().points.where('date').equals(date).delete()
  },
  async clearAll(): Promise<void> {
    await getDb().points.clear()
  },
}

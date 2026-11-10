import { addDays, endOfMonth, getDay, startOfMonth } from 'date-fns'
import { parseDateKey, toDateKey } from './date'

/** 하루 전 날짜 */
export function prevDay(key: string): string {
  return toDateKey(addDays(parseDateKey(key), -1))
}

/**
 * 지금 연속 기록 (며칠째 이어서 했는지)
 * 오늘 아직 안 했어도 어제까지 이어졌으면 끊긴 게 아니다. 오늘 안에 하면 이어진다.
 */
export function currentStreak(done: Set<string>, today: string): number {
  let day = done.has(today) ? today : prevDay(today)
  let count = 0
  while (done.has(day)) {
    count += 1
    day = prevDay(day)
  }
  return count
}

/** 가장 길었던 연속 기록 */
export function bestStreak(done: Set<string>): number {
  let best = 0
  for (const day of done) {
    // 연속 구간의 첫날에서만 센다
    if (done.has(prevDay(day))) continue
    let len = 0
    let d = day
    while (done.has(d)) {
      len += 1
      d = toDateKey(addDays(parseDateKey(d), 1))
    }
    best = Math.max(best, len)
  }
  return best
}

/** 오늘까지 최근 n일 (오래된 날 → 오늘) */
export function lastDays(today: string, n: number): string[] {
  const base = parseDateKey(today)
  return Array.from({ length: n }, (_, i) => toDateKey(addDays(base, i - (n - 1))))
}

/** 달력 칸: 그 달 1일 앞은 빈칸(null), 일요일부터 시작 */
export function monthCells(month: string): (string | null)[] {
  const first = startOfMonth(parseDateKey(`${month}-01`))
  const last = endOfMonth(first)
  const cells: (string | null)[] = Array.from({ length: getDay(first) }, () => null)
  for (let d = 1; d <= last.getDate(); d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`)
  return cells
}

/** 이번 달에 한 날 수 / 이번 달 지난 날 수(오늘 포함, 습관 만든 날부터) */
export function monthRate(done: Set<string>, month: string, today: string, since: string): { done: number; days: number } {
  const cells = monthCells(month).filter((d): d is string => d !== null && d <= today && d >= since)
  return { done: cells.filter((d) => done.has(d)).length, days: cells.length }
}

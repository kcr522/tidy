import { format } from 'date-fns'

/** 기기 현지 시간 기준 날짜를 YYYY-MM-DD 문자열로 */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

/** 오늘 날짜 (YYYY-MM-DD) */
export function todayKey(now: Date = new Date()): string {
  return toDateKey(now)
}

/** 생성/수정 시각용 ISO 문자열 */
export function nowIso(now: Date = new Date()): string {
  return now.toISOString()
}

/** YYYY-MM-DD 문자열을 현지 시간 자정의 Date로 */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

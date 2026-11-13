import { addDays, format, getDaysInMonth } from 'date-fns'
import type { TodoRepeat } from '../db/types'
import { parseDateKey } from './date'

export const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']
/** 요일 칩 순서: 월요일부터 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const key = (d: Date) => format(d, 'yyyy-MM-dd')

/** 이 반복에서 date가 할 일이 있는 날인가 */
function matches(r: TodoRepeat, d: Date): boolean {
  if (r.every === 'day') return true
  if (r.every === 'week') return r.days.includes(d.getDay())
  return d.getDate() === Math.min(r.day, getDaysInMonth(d))
}

/**
 * 다음 마감일: dueDate 다음 날부터, 그리고 오늘 이후에서 처음 맞는 날.
 * 밀린 반복 할 일을 늦게 끝내도 지난 날짜로 또 쌓이지 않는다.
 */
export function nextDueDate(r: TodoRepeat, dueDate: string, today: string): string {
  const after = dueDate >= today ? parseDateKey(dueDate) : addDays(parseDateKey(today), -1)
  let d = addDays(after, 1)
  // 매달은 최대 31일, 매주는 7일 안에 반드시 맞는 날이 나온다
  for (let i = 0; i < 62 && !matches(r, d); i++) d = addDays(d, 1)
  return key(d)
}

/** "매일", "매주 월·수·금", "평일", "매달 15일" */
export function repeatLabel(r: TodoRepeat): string {
  if (r.every === 'day') return '매일'
  if (r.every === 'month') return `매달 ${r.day}일`
  const days = WEEK_ORDER.filter((d) => r.days.includes(d))
  if (days.length === 7) return '매일'
  if (days.length === 5 && days.every((d) => d >= 1 && d <= 5)) return '평일'
  if (days.length === 2 && days.includes(0) && days.includes(6)) return '주말'
  return `매주 ${days.map((d) => WEEKDAY_SHORT[d]).join('·')}`
}

/** 백업 파일 검사용 */
export function isTodoRepeat(v: unknown): v is TodoRepeat {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (r.every === 'day') return true
  if (r.every === 'week') return Array.isArray(r.days) && r.days.length > 0 && r.days.every((d) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6)
  if (r.every === 'month') return Number.isInteger(r.day) && (r.day as number) >= 1 && (r.day as number) <= 31
  return false
}

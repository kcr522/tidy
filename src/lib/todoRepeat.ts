import { addDays, differenceInCalendarDays, differenceInCalendarMonths, differenceInCalendarWeeks, differenceInCalendarYears, format, getDaysInMonth } from 'date-fns'
import type { TodoRepeat } from '../db/types'
import { parseDateKey } from './date'

export const WEEKDAY_SHORT = ['일', '월', '화', '수', '목', '금', '토']
/** 요일 칩 순서: 월요일부터 */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
/** 매달 말일 (day), 매달 마지막 주 (nth) */
export const LAST = -1
/** 몇 번째마다: 1 ~ 12 */
export const MAX_INTERVAL = 12
/** 남은 횟수: 2 ~ 99 */
export const MAX_LEFT = 99
const NTH_LABEL = ['', '첫째', '둘째', '셋째', '넷째']

const key = (d: Date) => format(d, 'yyyy-MM-dd')
const mod = (a: number, n: number) => ((a % n) + n) % n

/** 매달 몇째 주 무슨 요일인지 (마감일에서 '매달 셋째 화요일' 만들 때). 넷째 주를 넘으면 마지막 주 */
export function nthOf(d: Date): { nth: number; weekday: number } {
  const nth = Math.ceil(d.getDate() / 7)
  return { nth: nth > 4 ? LAST : nth, weekday: d.getDay() }
}

/** 이 날이 그 달의 마지막 주 요일인가 (다음 주 같은 요일이 다음 달) */
const isLastWeek = (d: Date) => d.getDate() + 7 > getDaysInMonth(d)

/** 반복의 모양만 맞는가 (몇 번째마다는 빼고) */
function matchesShape(r: TodoRepeat, d: Date): boolean {
  if (r.every === 'day') return true
  if (r.every === 'week') return r.days.includes(d.getDay())
  if (r.every === 'year') return d.getMonth() + 1 === r.month && d.getDate() === Math.min(r.day, getDaysInMonth(d))
  if ('nth' in r) return d.getDay() === r.weekday && (r.nth === LAST ? isLastWeek(d) : Math.ceil(d.getDate() / 7) === r.nth)
  const last = getDaysInMonth(d)
  return d.getDate() === (r.day === LAST ? last : Math.min(r.day, last))
}

/** 기준 날짜에서 몇 칸(일·주·달·해) 떨어졌는지 */
function stepsFrom(r: TodoRepeat, start: Date, d: Date): number {
  if (r.every === 'day') return differenceInCalendarDays(d, start)
  if (r.every === 'week') return differenceInCalendarWeeks(d, start, { weekStartsOn: 1 })
  if (r.every === 'month') return differenceInCalendarMonths(d, start)
  return differenceInCalendarYears(d, start)
}

/** 이 반복에서 date가 할 일이 있는 날인가 */
function matches(r: TodoRepeat, d: Date, start: Date): boolean {
  if (!matchesShape(r, d)) return false
  const n = r.interval ?? 1
  return n <= 1 || mod(stepsFrom(r, start, d), n) === 0
}

/** 가장 긴 반복(12년마다 2월 29일)도 이 안에서 맞는 날이 나온다 */
const SEARCH_DAYS = 366 * (MAX_INTERVAL + 4)

/**
 * 다음 마감일: dueDate 다음 날부터, 그리고 오늘 이후에서 처음 맞는 날.
 * 밀린 반복 할 일을 늦게 끝내도 지난 날짜로 또 쌓이지 않는다.
 * 끝나는 날짜를 넘거나 남은 횟수를 다 쓰면 null (더 만들지 않는다)
 */
export function nextDueDate(r: TodoRepeat, dueDate: string, today: string): string | null {
  if (r.left != null && r.left <= 1) return null
  const start = parseDateKey(r.start ?? dueDate)
  const after = dueDate >= today ? parseDateKey(dueDate) : addDays(parseDateKey(today), -1)
  let d = addDays(after, 1)
  for (let i = 0; i < SEARCH_DAYS && !matches(r, d, start); i++) d = addDays(d, 1)
  const next = key(d)
  if (r.until && next > r.until) return null
  return next
}

/** 다음 할 일에 넘길 반복 (남은 횟수를 하나 줄인다) */
export function nextRepeat(r: TodoRepeat): TodoRepeat {
  return r.left != null ? { ...r, left: r.left - 1 } : r
}

/** 완료를 되돌릴 때 다음 할 일의 반복을 앞으로 되돌린다 (남은 횟수를 하나 늘린다) */
export function prevRepeat(r: TodoRepeat): TodoRepeat {
  return r.left != null ? { ...r, left: r.left + 1 } : r
}

/** 이 날짜부터 반복하면 오는 날짜들 (폼의 미리보기) */
export function upcomingDates(r: TodoRepeat, dueDate: string, count: number): string[] {
  const out = [dueDate]
  let rep = r
  while (out.length < count) {
    const next = nextDueDate(rep, out[out.length - 1], out[out.length - 1])
    if (!next) break
    out.push(next)
    rep = nextRepeat(rep)
  }
  return out
}

function weekDaysLabel(days: number[]): string {
  const sorted = WEEK_ORDER.filter((d) => days.includes(d))
  if (sorted.length === 7) return '매일'
  if (sorted.length === 5 && sorted.every((d) => d >= 1 && d <= 5)) return '평일'
  if (sorted.length === 2 && sorted.includes(0) && sorted.includes(6)) return '주말'
  return sorted.map((d) => WEEKDAY_SHORT[d]).join('·')
}

/** 매달 어느 날인지: "15일", "말일", "셋째 화요일", "마지막 금요일" */
export function monthDayLabel(r: Extract<TodoRepeat, { every: 'month' }>): string {
  if ('nth' in r) return `${r.nth === LAST ? '마지막' : NTH_LABEL[r.nth]} ${WEEKDAY_SHORT[r.weekday]}요일`
  return r.day === LAST ? '말일' : `${r.day}일`
}

/** "매일", "매주 월·수·금", "평일", "격주 화", "3일마다", "매달 15일", "매달 말일", "매달 셋째 화요일", "매년 3월 5일" */
export function repeatLabel(r: TodoRepeat): string {
  const n = r.interval ?? 1
  if (r.every === 'day') return n <= 1 ? '매일' : `${n}일마다`
  if (r.every === 'week') {
    const days = weekDaysLabel(r.days)
    if (n <= 1) return days === '매일' || days === '평일' || days === '주말' ? days : `매주 ${days}`
    return `${n === 2 ? '격주' : `${n}주마다`} ${days}`
  }
  if (r.every === 'month') return n <= 1 ? `매달 ${monthDayLabel(r)}` : `${n}달마다 ${monthDayLabel(r)}`
  return `${n <= 1 ? '매년' : `${n}년마다`} ${r.month}월 ${r.day}일`
}

/** 끝나는 때: "12월 31일까지", "3번 남음". 계속이면 '' */
export function repeatEndLabel(r: TodoRepeat): string {
  if (r.left != null) return `${r.left}번 남음`
  if (r.until) {
    const d = parseDateKey(r.until)
    return `${d.getMonth() + 1}월 ${d.getDate()}일까지`
  }
  return ''
}

const isInt = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max
const isKey = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)

/** 백업 파일 검사용 */
export function isTodoRepeat(v: unknown): v is TodoRepeat {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  if (r.interval !== undefined && !isInt(r.interval, 1, MAX_INTERVAL)) return false
  if (r.left !== undefined && !isInt(r.left, 1, MAX_LEFT)) return false
  if (r.start !== undefined && !isKey(r.start)) return false
  if (r.until !== undefined && !isKey(r.until)) return false
  if (r.every === 'day') return true
  if (r.every === 'week') return Array.isArray(r.days) && r.days.length > 0 && r.days.every((d) => isInt(d, 0, 6))
  if (r.every === 'month' && r.nth !== undefined) return (r.nth === LAST || isInt(r.nth, 1, 4)) && isInt(r.weekday, 0, 6)
  if (r.every === 'month') return r.day === LAST || isInt(r.day, 1, 31)
  if (r.every === 'year') return isInt(r.month, 1, 12) && isInt(r.day, 1, 31)
  return false
}

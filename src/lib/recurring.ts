import { addMonths, differenceInCalendarDays, getDaysInMonth } from 'date-fns'
import type { Recurring } from '../db/types'
import { parseDateKey, toDateKey } from './date'

/** 그 달의 기록일: 31일 규칙은 30일까지 있는 달엔 30일 */
export function dueDateIn(year: number, month: number, day: number): string {
  const d = Math.min(day, getDaysInMonth(new Date(year, month - 1, 1)))
  return toDateKey(new Date(year, month - 1, d))
}

/** 오늘까지 아직 기록하지 않은 날짜들 (오래된 순) */
export function pendingDates(rule: Pick<Recurring, 'day' | 'startDate' | 'lastDate' | 'isActive'>, today: string): string[] {
  if (rule.isActive !== 1) return []
  const out: string[] = []
  const start = parseDateKey(rule.startDate)
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  const end = parseDateKey(today)
  // 한 번에 너무 많이 만들지 않게 최대 24개월
  for (let i = 0; i < 24 && cursor <= end; i++, cursor = addMonths(cursor, 1)) {
    const due = dueDateIn(cursor.getFullYear(), cursor.getMonth() + 1, rule.day)
    if (due < rule.startDate || due > today) continue
    if (rule.lastDate && due <= rule.lastDate) continue
    out.push(due)
  }
  return out
}

/** 다음 기록일과 그 전 기록일 */
export function nextAndPrev(day: number, today: string): { next: string; prev: string } {
  const t = parseDateKey(today)
  const thisMonth = dueDateIn(t.getFullYear(), t.getMonth() + 1, day)
  if (thisMonth > today) {
    const pm = addMonths(t, -1)
    return { next: thisMonth, prev: dueDateIn(pm.getFullYear(), pm.getMonth() + 1, day) }
  }
  const nm = addMonths(t, 1)
  return { next: dueDateIn(nm.getFullYear(), nm.getMonth() + 1, day), prev: thisMonth }
}

export interface Dday {
  /** 다음 날짜 */
  date: string
  /** 남은 날 (오늘이면 0) */
  daysLeft: number
  /** 지난 기록일부터 다음 기록일까지 얼마나 왔는지 0~100 */
  progress: number
}

/** 월급날까지 D-day와 막대 채움 */
export function ddayFor(day: number, today: string): Dday {
  const { next, prev } = nextAndPrev(day, today)
  // 오늘이 기록일이면 D-day
  const todayDue = prev === today
  const target = todayDue ? today : next
  const total = differenceInCalendarDays(parseDateKey(next), parseDateKey(prev))
  const passed = differenceInCalendarDays(parseDateKey(today), parseDateKey(prev))
  const daysLeft = todayDue ? 0 : differenceInCalendarDays(parseDateKey(next), parseDateKey(today))
  return { date: target, daysLeft, progress: todayDue ? 100 : Math.round((passed / total) * 100) }
}

export function ddayLabel(daysLeft: number): string {
  return daysLeft === 0 ? 'D-DAY' : `D-${daysLeft}`
}

export function dayLabel(day: number): string {
  return day >= 31 ? '매달 말일' : `매달 ${day}일`
}

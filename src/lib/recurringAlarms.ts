import { addDays, addMonths } from 'date-fns'
import type { Recurring } from '../db/types'
import { isSpending } from './categories'
import { parseDateKey } from './date'
import { formatWon } from './format'
import { dueDateIn } from './recurring'

/**
 * 정기 지출 · 구독 미리 알림 (사용자 요청 2026-11-27)
 * 결제일 며칠 전 아침에 "내일 넷플릭스 13,500원이 나가요" 알림을 띄운다.
 */

/** 알림이 울리는 시각 (아침 9시) */
export const REMIND_HOUR = 9

/** 고를 수 있는 미리 알림: 결제일 며칠 전 */
export const REMIND_CHOICES = [
  { days: null, label: '안 함' },
  { days: 0, label: '당일 아침' },
  { days: 1, label: '하루 전' },
  { days: 3, label: '3일 전' },
] as const

type AlarmRule = Pick<Recurring, 'id' | 'day' | 'startDate' | 'lastDate' | 'isActive' | 'remindDays'>

/** 미리 알림이 켜져 있는지 (0 = 당일도 켜진 것) */
export const hasRemind = (r: Pick<Recurring, 'remindDays'>): r is { remindDays: number } => typeof r.remindDays === 'number' && r.remindDays >= 0

/** 오늘 달부터 앞으로 months달 동안 이 규칙의 알림 시각들 (now 뒤만) */
export function alarmTimesFor(rule: AlarmRule, now: Date, months = 2): { due: string; at: Date }[] {
  if (rule.isActive !== 1 || !hasRemind(rule)) return []
  const out: { due: string; at: Date }[] = []
  const first = new Date(now.getFullYear(), now.getMonth(), 1)
  for (let i = 0; i <= months; i++) {
    const m = addMonths(first, i)
    const due = dueDateIn(m.getFullYear(), m.getMonth() + 1, rule.day)
    // 시작 전이거나 이미 가계부에 기록된 날은 알리지 않는다
    if (due < rule.startDate || (rule.lastDate && due <= rule.lastDate)) continue
    const at = addDays(parseDateKey(due), -rule.remindDays)
    at.setHours(REMIND_HOUR, 0, 0, 0)
    out.push({ due, at })
  }
  return out
}

/** 앞으로 울릴 알림 (가까운 순, 최대 max개). 폰은 예약할 수 있는 알림 수에 한도가 있다 */
export function upcomingRecurringAlarms<T extends AlarmRule>(rules: T[], now: Date, max = 40): { rule: T; due: string; at: Date }[] {
  return rules
    .filter((r) => r.id != null)
    .flatMap((rule) => alarmTimesFor(rule, now).map((a) => ({ rule, ...a })))
    .filter((a) => a.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, max)
}

/** 앱을 늦게 열었을 때 알려 줄 오늘 알림: 오늘 울릴 시각이 이미 지난 것 */
export function missedTodayRecurring<T extends AlarmRule>(rules: T[], now: Date): { rule: T; due: string }[] {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return rules.flatMap((rule) =>
    alarmTimesFor(rule, start)
      .filter((a) => a.at.toDateString() === now.toDateString() && a.at.getTime() <= now.getTime())
      .map((a) => ({ rule, due: a.due })),
  )
}

/** 결제일까지 남은 날을 말로: 오늘 / 내일 / 3일 뒤 */
function whenText(days: number): string {
  return days === 0 ? '오늘' : days === 1 ? '내일' : `${days}일 뒤`
}

type TextRule = Pick<Recurring, 'type' | 'memo' | 'amount' | 'askAmount' | 'remindDays'>

export const recurringAlarmTitle = (r: TextRule) => `${r.type === 'INCOME' ? '💰' : '💳'} ${whenText(r.remindDays ?? 0)} ${r.memo}${r.type === 'INCOME' ? '이(가) 들어와요' : ' 결제일이에요'}`

export function recurringAlarmBody(r: TextRule): string {
  if (r.askAmount === 1) return r.type === 'INCOME' ? '들어온 날 금액을 적어 주세요' : '이번 달 금액은 그날 물어볼게요'
  return r.type === 'INCOME' ? `${formatWon(r.amount)}이 가계부에 자동으로 기록돼요` : `${formatWon(r.amount)}이 나가요. 통장 잔고를 확인해 주세요`
}

type SumRule = Pick<Recurring, 'type' | 'category' | 'amount' | 'askAmount' | 'day' | 'startDate' | 'lastDate' | 'isActive'>

export interface FixedSummary {
  /** 매달 나가는 고정 지출 합 (금액이 정해진 것만, 저축 빼고) */
  monthly: number
  /** 1년이면 */
  yearly: number
  /** 이번 달 아직 안 나간 것 (오늘 기록될 것 포함) */
  leftCount: number
  leftAmount: number
  /** 금액이 매달 달라서 합에 안 넣은 개수 */
  askCount: number
}

/** 고정 지출 요약: 한 달 · 1년 합, 이번 달 남은 결제 */
export function fixedSummary(rules: SumRule[], today: string): FixedSummary {
  const t = parseDateKey(today)
  const spend = rules.filter((r) => r.isActive === 1 && r.type === 'EXPENSE' && isSpending(r))
  const fixed = spend.filter((r) => r.askAmount !== 1)
  const monthly = fixed.reduce((s, r) => s + r.amount, 0)
  const left = fixed.filter((r) => {
    const due = dueDateIn(t.getFullYear(), t.getMonth() + 1, r.day)
    return due >= today && due >= r.startDate && !(r.lastDate && due <= r.lastDate)
  })
  return {
    monthly,
    yearly: monthly * 12,
    leftCount: left.length,
    leftAmount: left.reduce((s, r) => s + r.amount, 0),
    askCount: spend.length - fixed.length,
  }
}

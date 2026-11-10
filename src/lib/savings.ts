import { addDays, differenceInCalendarDays, getDaysInMonth } from 'date-fns'
import type { InterestType, SavingsPlan, Schedule, TaxType } from '../db/types'
import { parseDateKey, toDateKey } from './date'

/** 세금 비율 (이자에만 붙는다) */
export const TAX_RATE: Record<TaxType, number> = {
  // 이자소득세 14% + 지방소득세 1.4%
  normal: 0.154,
  // 세금우대: 9% + 농어촌특별세 0.5%
  preferential: 0.095,
  free: 0,
}

export const TAX_LABEL: Record<TaxType, string> = {
  normal: '일반과세 15.4%',
  preferential: '세금우대 9.5%',
  free: '비과세 0%',
}

export const INTEREST_LABEL: Record<InterestType, string> = {
  simple: '단리',
  compound: '월복리',
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** "매일", "매주 월요일", "매달 25일", "매달 말일" */
export function scheduleLabel(s: Schedule): string {
  if (s.freq === 'daily') return '매일'
  if (s.freq === 'weekly') return `매주 ${WEEKDAYS[s.weekday ?? 0]}요일`
  return (s.day ?? 1) >= 31 ? '매달 말일' : `매달 ${s.day ?? 1}일`
}

/** 그 날이 넣는 날인지 */
export function isDueOn(s: Schedule, key: string): boolean {
  const d = parseDateKey(key)
  if (s.freq === 'daily') return true
  if (s.freq === 'weekly') return d.getDay() === (s.weekday ?? 0)
  const want = Math.min(s.day ?? 1, getDaysInMonth(d))
  return d.getDate() === want
}

/** 가입일부터 만기일 전날까지 넣는 날 (오래된 순). 한 번에 너무 많이 만들지 않게 최대 2000개 */
export function depositDates(plan: Pick<SavingsPlan, 'schedule' | 'startDate' | 'endDate'>, until?: string): string[] {
  const out: string[] = []
  const last = until && until < plan.endDate ? until : toDateKey(addDays(parseDateKey(plan.endDate), -1))
  let cur = parseDateKey(plan.startDate)
  const end = parseDateKey(last)
  for (let i = 0; cur <= end && out.length < 2000 && i < 40000; i++, cur = addDays(cur, 1)) {
    const key = toDateKey(cur)
    if (isDueOn(plan.schedule, key)) out.push(key)
  }
  return out
}

/** 두 날짜 사이 개월 수 (날짜까지 따져서 소수로). 1월 10일 → 3월 10일 = 2 */
export function monthsBetween(from: string, to: string): number {
  const a = parseDateKey(from)
  const b = parseDateKey(to)
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth())
  let anchor = new Date(a.getFullYear(), a.getMonth() + months, Math.min(a.getDate(), getDaysInMonth(new Date(a.getFullYear(), a.getMonth() + months, 1))))
  if (anchor > b) {
    months -= 1
    anchor = new Date(a.getFullYear(), a.getMonth() + months, Math.min(a.getDate(), getDaysInMonth(new Date(a.getFullYear(), a.getMonth() + months, 1))))
  }
  const rest = differenceInCalendarDays(b, anchor)
  return months + rest / 30.4375
}

export interface Maturity {
  /** 넣는 횟수 */
  count: number
  /** 원금 합계 */
  principal: number
  /** 세전 이자 */
  interest: number
  /** 세금 (10원 아래 버림) */
  tax: number
  /** 세후 이자 */
  netInterest: number
  /** 만기 때 받을 돈 (세전) */
  grossTotal: number
  /** 만기 때 받을 돈 (세후) */
  netTotal: number
}

/**
 * 만기 금액 계산
 * - 넣은 날부터 만기일까지 기간만큼 그 돈에 이자가 붙는다 (적금 계산법)
 * - 단리: 금액 × 연이율 × 기간(년)
 * - 월복리: 금액 × ((1 + 연이율/12)^개월 − 1)
 * - 매달 넣는 적금은 개월 수로, 매일·매주는 날 수 / 365로 센다
 */
export function maturity(plan: Pick<SavingsPlan, 'amount' | 'rate' | 'interestType' | 'taxType' | 'schedule' | 'startDate' | 'endDate'>): Maturity {
  const dates = depositDates(plan)
  const r = plan.rate / 100
  let interest = 0
  for (const d of dates) {
    const months = plan.schedule.freq === 'monthly' ? Math.round(monthsBetween(d, plan.endDate) * 1000) / 1000 : (differenceInCalendarDays(parseDateKey(plan.endDate), parseDateKey(d)) / 365) * 12
    interest += plan.interestType === 'simple' ? (plan.amount * r * months) / 12 : plan.amount * ((1 + r / 12) ** months - 1)
  }
  const principal = dates.length * plan.amount
  const gross = Math.floor(interest)
  const tax = Math.floor((gross * TAX_RATE[plan.taxType]) / 10) * 10
  return {
    count: dates.length,
    principal,
    interest: gross,
    tax,
    netInterest: gross - tax,
    grossTotal: principal + gross,
    netTotal: principal + gross - tax,
  }
}

export interface Progress {
  /** 오늘까지 넣었어야 할 횟수 */
  done: number
  total: number
  /** 오늘까지 넣은 돈 */
  saved: number
  /** 만기까지 남은 날 (지났으면 0) */
  daysLeft: number
  /** 다음 넣는 날 (오늘 포함, 없으면 null) */
  next: string | null
  matured: boolean
}

export function progressOf(plan: Pick<SavingsPlan, 'amount' | 'schedule' | 'startDate' | 'endDate'>, today: string): Progress {
  const all = depositDates(plan)
  const done = all.filter((d) => d <= today).length
  return {
    done,
    total: all.length,
    saved: done * plan.amount,
    daysLeft: Math.max(0, differenceInCalendarDays(parseDateKey(plan.endDate), parseDateKey(today))),
    next: all.find((d) => d >= today) ?? null,
    matured: today >= plan.endDate,
  }
}

/** 기본 넣는 날: 가입일과 같은 요일 / 같은 날짜 */
export function defaultSchedule(freq: Schedule['freq'], startDate: string): Schedule {
  const d = parseDateKey(startDate)
  if (freq === 'weekly') return { freq, weekday: d.getDay() }
  if (freq === 'monthly') return { freq, day: d.getDate() }
  return { freq }
}

/** 가입일 + n개월 (만기일 고르기 도우미) */
export function addMonthsKey(key: string, n: number): string {
  const d = parseDateKey(key)
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1)
  return toDateKey(new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), getDaysInMonth(target))))
}

/**
 * 다음 알림 시각 (지금 이후 처음 오는 넣는 날의 알림 시각). 만기가 지났으면 null
 */
export function nextAlarm(plan: Pick<SavingsPlan, 'schedule' | 'startDate' | 'endDate' | 'alarmTime'>, now: Date): Date | null {
  const [h, m] = plan.alarmTime.split(':').map(Number)
  let day = toDateKey(now) < plan.startDate ? parseDateKey(plan.startDate) : new Date(now.getFullYear(), now.getMonth(), now.getDate())
  for (let i = 0; i < 400; i++, day = addDays(day, 1)) {
    const key = toDateKey(day)
    if (key >= plan.endDate) return null
    if (!isDueOn(plan.schedule, key)) continue
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m)
    if (at > now) return at
  }
  return null
}

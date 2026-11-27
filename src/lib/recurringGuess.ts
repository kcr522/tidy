import { differenceInCalendarMonths } from 'date-fns'
import type { Recurring, Transaction } from '../db/types'
import { isSpending } from './categories'
import { parseDateKey } from './date'
import { matchMerchant, normalizeName } from './merchants'

/**
 * 정기 지출 찾기 (사용자 요청 2026-11-27)
 * 가계부에 같은 곳 · 같은 금액이 매달 비슷한 날 찍혀 있으면 "매달 나가는 것 같아요" 하고 등록을 권한다.
 */

export interface RecurringGuess {
  /** 같은 곳인지 보는 키 (브랜드 이름 또는 normalizeName 한 메모) */
  key: string
  memo: string
  amount: number
  category: string
  account?: string
  /** 마지막으로 찍힌 날의 일 (다음 달 같은 날 기록) */
  day: number
  /** 마지막으로 찍힌 날 (YYYY-MM-DD). 정기로 등록하면 그다음 날부터 기록해서 두 번 들어가지 않게 */
  lastDate: string
  /** 몇 달 연속 찍혔는지 */
  months: number
}

/** 결제일이 이 정도 흔들려도 같은 날로 본다 (주말 · 공휴일로 하루 이틀 밀림) */
const DAY_SLACK = 3
/** 최근 몇 달까지 볼지 */
const LOOKBACK_MONTHS = 4
/** 이만큼 연속으로 찍혀야 권한다 */
const MIN_MONTHS = 2

/** 정기 내역과 같은 곳인지 보는 키 */
export function placeKey(memo: string): string {
  return matchMerchant(memo)?.brand.name ?? normalizeName(memo)
}

/** 가계부에서 매달 나가는 것 같은 지출을 찾는다 (이미 정기 내역에 있는 곳, 숨긴 곳은 빼고) */
export function guessRecurring(items: Transaction[], rules: Pick<Recurring, 'memo'>[], today: string, hidden: string[] = [], max = 3): RecurringGuess[] {
  const known = new Set([...rules.map((r) => placeKey(r.memo)), ...hidden])
  const now = parseDateKey(today)
  const groups = new Map<string, Transaction[]>()
  for (const t of items) {
    if (!isSpending(t) || t.recurringId != null || !t.memo.trim() || t.date > today) continue
    if (differenceInCalendarMonths(now, parseDateKey(t.date)) > LOOKBACK_MONTHS) continue
    const key = placeKey(t.memo)
    if (!key || known.has(key)) continue
    groups.set(key, [...(groups.get(key) ?? []), t])
  }

  const out: RecurringGuess[] = []
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date))
    const last = sorted[0]
    const lastDay = Number(last.date.slice(8))
    // 최근 것부터 한 달씩 거슬러 올라가며 같은 금액 · 비슷한 날이 이어지는지 본다
    let months = 1
    let cursor = parseDateKey(last.date)
    for (;;) {
      const prev = sorted.find((t) => differenceInCalendarMonths(cursor, parseDateKey(t.date)) === 1 && t.amount === last.amount && Math.abs(Number(t.date.slice(8)) - lastDay) <= DAY_SLACK)
      if (!prev) break
      months++
      cursor = parseDateKey(prev.date)
    }
    // 지난달에 찍혔어야 다음 달에도 나갈 것 같다고 본다 (끊긴 구독은 빼기)
    if (months < MIN_MONTHS || differenceInCalendarMonths(now, parseDateKey(last.date)) > 1) continue
    out.push({ key, memo: last.memo.trim(), lastDate: last.date, amount: last.amount, category: last.category, account: last.account, day: lastDay, months })
  }
  return out.sort((a, b) => b.months - a.months || b.amount - a.amount).slice(0, max)
}

const HIDDEN_KEY = 'tidy.recurringGuessHidden'

/** "아니에요"로 숨긴 곳 (이 기기) */
export function loadHiddenGuesses(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as unknown
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function hideGuess(key: string) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...new Set([...loadHiddenGuesses(), key])].slice(-100)))
  } catch {
    /* 저장 못 해도 이번엔 숨긴다 */
  }
}

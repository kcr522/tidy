import { addDays, addMonths, addWeeks, addYears, startOfWeek } from 'date-fns'
import type { Transaction, TransactionType } from '../db/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories'
import { parseDateKey, toDateKey } from './date'

/** 차트·통계에서 묶는 단위 */
export type PeriodUnit = 'week' | 'month' | 'year'

export interface Period {
  unit: PeriodUnit
  /** 첫날 YYYY-MM-DD (포함) */
  start: string
  /** 다음 기간의 첫날 YYYY-MM-DD (포함하지 않음) */
  end: string
}

/** 날짜가 들어 있는 기간. 주는 월요일부터 */
export function periodOf(unit: PeriodUnit, dateKey: string): Period {
  const d = parseDateKey(dateKey)
  let start: Date
  let end: Date
  if (unit === 'week') {
    start = startOfWeek(d, { weekStartsOn: 1 })
    end = addDays(start, 7)
  } else if (unit === 'month') {
    start = new Date(d.getFullYear(), d.getMonth(), 1)
    end = addMonths(start, 1)
  } else {
    start = new Date(d.getFullYear(), 0, 1)
    end = addYears(start, 1)
  }
  return { unit, start: toDateKey(start), end: toDateKey(end) }
}

/** n칸 앞(음수면 뒤) 기간 */
export function shiftPeriod(p: Period, delta: number): Period {
  const s = parseDateKey(p.start)
  const moved = p.unit === 'week' ? addWeeks(s, delta) : p.unit === 'month' ? addMonths(s, delta) : addYears(s, delta)
  return periodOf(p.unit, toDateKey(moved))
}

/** 기간 이름: "11월 2주" / "2026년 11월" / "2026년" */
export function periodLabel(p: Period, short = false): string {
  const s = parseDateKey(p.start)
  if (p.unit === 'year') return `${s.getFullYear()}년`
  if (p.unit === 'month') return short ? `${s.getMonth() + 1}월` : `${s.getFullYear()}년 ${s.getMonth() + 1}월`
  const last = addDays(s, 6)
  return short ? `${s.getMonth() + 1}/${s.getDate()}` : `${s.getMonth() + 1}월 ${s.getDate()}일 ~ ${last.getMonth() + 1}월 ${last.getDate()}일`
}

export function inPeriod(t: Transaction, p: Period): boolean {
  return t.date >= p.start && t.date < p.end
}

export interface PeriodTotal {
  period: Period
  income: number
  expense: number
}

/** 마지막 기간(today가 든 기간)부터 거슬러 count칸의 수입·지출 합계, 오래된 순 */
export function totalsByPeriod(list: Transaction[], last: Period, count: number): PeriodTotal[] {
  const rows: PeriodTotal[] = []
  for (let i = count - 1; i >= 0; i--) rows.push({ period: shiftPeriod(last, -i), income: 0, expense: 0 })
  for (const t of list) {
    const row = rows.find((r) => inPeriod(t, r.period))
    if (!row) continue
    if (t.type === 'INCOME') row.income += t.amount
    else row.expense += t.amount
  }
  return rows
}

export interface CategoryShare {
  category: string
  amount: number
  count: number
  /** 이 종류(지출/수입) 합계 중 몇 % (0~100, 소수 첫째 자리) */
  percent: number
}

/** 카테고리별 합계, 많은 순. '기타'는 맨 뒤 */
export function categoryShares(list: Transaction[], type: TransactionType): CategoryShare[] {
  const map = new Map<string, CategoryShare>()
  let total = 0
  for (const t of list) {
    if (t.type !== type) continue
    total += t.amount
    const row = map.get(t.category) ?? { category: t.category, amount: 0, count: 0, percent: 0 }
    row.amount += t.amount
    row.count += 1
    map.set(t.category, row)
  }
  const rows = [...map.values()]
  for (const r of rows) r.percent = percentOf(r.amount, total)
  return rows.sort((a, b) => Number(a.category === '기타') - Number(b.category === '기타') || b.amount - a.amount)
}

/** part ÷ whole × 100, 소수 첫째 자리. whole이 0이면 0 */
export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0
  return Math.round((part / whole) * 1000) / 10
}

/** 수입이 어디서 왔나: 같은 이름(메모)끼리 묶은 상위 n개 */
export function topIncomeSources(list: Transaction[], n = 5): { name: string; amount: number; percent: number }[] {
  const map = new Map<string, number>()
  let total = 0
  for (const t of list) {
    if (t.type !== 'INCOME') continue
    total += t.amount
    const name = t.memo.trim() || t.category
    map.set(name, (map.get(name) ?? 0) + t.amount)
  }
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount, percent: percentOf(amount, total) }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n)
}

// ───────────── 색 ─────────────
// 카테고리마다 정해진 색 (순위가 바뀌어도 색은 그대로). '기타'는 회색.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948']
const OTHER = '#b0b8c1'

export function categoryColor(category: string): string {
  if (category === '기타') return OTHER
  const exp = (EXPENSE_CATEGORIES as readonly string[]).indexOf(category)
  if (exp >= 0) return SERIES[exp]
  const inc = (INCOME_CATEGORIES as readonly string[]).indexOf(category)
  if (inc >= 0) return [SERIES[0], SERIES[2], SERIES[6]][inc]
  return OTHER
}

/** 남은 돈(쓰지 않은 수입) 조각 색 */
export const REMAIN_COLOR = '#e5e8eb'

/** 금액을 짧게: 1,234,000 → "123만", 12,000 → "1.2만", 900 → "900" */
export function shortWon(n: number): string {
  if (n >= 100_000_000) return `${Math.round(n / 10_000_000) / 10}억`
  if (n >= 100_000) return `${Math.round(n / 10_000)}만`
  if (n >= 10_000) return `${Math.round(n / 1_000) / 10}만`
  return n.toLocaleString('ko-KR')
}

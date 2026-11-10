import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns'
import type { Todo, Transaction } from '../db/types'
import { parseDateKey, toDateKey } from './date'

/** 이번 달 키 (YYYY-MM) */
export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7)
}

/** 달 이동: +1 다음 달, -1 이전 달 */
export function shiftMonth(monthKey: string, delta: number): string {
  return format(addMonths(parseDateKey(`${monthKey}-01`), delta), 'yyyy-MM')
}

/** 달력 칸 날짜 목록 (일요일 시작, 앞뒤 달 날짜 포함, 7의 배수) */
export function monthGrid(monthKey: string): string[] {
  const first = startOfMonth(parseDateKey(`${monthKey}-01`))
  const start = startOfWeek(first, { weekStartsOn: 0 })
  const end = endOfWeek(endOfMonth(first), { weekStartsOn: 0 })
  const days: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(toDateKey(d))
  return days
}

/**
 * 날짜 칸 표시 (FR-103, FR-106)
 * - overdue: 지난 날짜에 못 끝낸 할 일이 있음 (빨간 점)
 * - open: 끝내지 않은 할 일이 있음 (진한 점)
 * - done: 모두 끝냄 (흐린 점)
 */
export type DayMark = 'overdue' | 'open' | 'done'

export interface DayInfo {
  mark: DayMark
  total: number
  open: number
}

export function dayMarks(todos: Todo[], today: string): Map<string, DayInfo> {
  const map = new Map<string, DayInfo>()
  for (const t of todos) {
    if (!t.dueDate) continue
    const info = map.get(t.dueDate) ?? { mark: 'done' as DayMark, total: 0, open: 0 }
    info.total += 1
    if (t.isCompleted === 0) info.open += 1
    map.set(t.dueDate, info)
  }
  for (const [date, info] of map) {
    info.mark = info.open === 0 ? 'done' : date < today ? 'overdue' : 'open'
  }
  return map
}

/** 그날 마감인 할 일 (미완료 먼저, 그다음 만든 순서) */
export function todosOn(todos: Todo[], dateKey: string): Todo[] {
  return todos
    .filter((t) => t.dueDate === dateKey)
    .sort((a, b) => a.isCompleted - b.isCompleted || a.createdAt.localeCompare(b.createdAt))
}

/** 그날 지출 합계 (FR-107) */
export function expenseOn(transactions: Transaction[], dateKey: string): number {
  return transactions.reduce((sum, t) => (t.type === 'EXPENSE' && t.date === dateKey ? sum + t.amount : sum), 0)
}

export interface DayMoney {
  income: number
  expense: number
}

/** 날짜별 수입·지출 합계 (가계부 달력) */
export function dailyTotals(transactions: Transaction[]): Map<string, DayMoney> {
  const map = new Map<string, DayMoney>()
  for (const t of transactions) {
    const d = map.get(t.date) ?? { income: 0, expense: 0 }
    if (t.type === 'INCOME') d.income += t.amount
    else d.expense += t.amount
    map.set(t.date, d)
  }
  return map
}

/** 달력 칸에 넣을 짧은 금액: 403,223 → "40.3만", 45,000 → "45,000" (폰 칸이 좁아서 10만 이상은 만 단위) */
export function shortWon(amount: number): string {
  if (amount >= 100_000) return `${Math.round(amount / 1000) / 10}만`
  return amount.toLocaleString('ko-KR')
}

/** "11월 15일 (토)" */
export function dayTitle(dateKey: string): string {
  const d = parseDateKey(dateKey)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]})`
}

/** 할 일 캘린더 칸: 그날 마감인 할 일 중 몇 개를 끝냈는지 */
export interface DayProgress {
  total: number
  done: number
}

export function dayProgress(todos: Todo[]): Map<string, DayProgress> {
  const map = new Map<string, DayProgress>()
  for (const t of todos) {
    if (!t.dueDate) continue
    const p = map.get(t.dueDate) ?? { total: 0, done: 0 }
    p.total += 1
    if (t.isCompleted === 1) p.done += 1
    map.set(t.dueDate, p)
  }
  return map
}

/**
 * 그날 할 일을 카테고리별로 묶는다.
 * 카테고리 순서대로, 없는(또는 지워진) 카테고리의 할 일은 맨 앞 '기본'(id 없음)에 모은다.
 * 비어 있는 카테고리도 넣어서 바로 + 로 추가할 수 있게 한다. '기본'은 할 일이 있거나 카테고리가 하나도 없을 때만.
 */
export function groupByCategory<C extends { id?: number }>(todos: Todo[], categories: C[]): { category: C | null; todos: Todo[] }[] {
  const known = new Set(categories.map((c) => c.id))
  const base = todos.filter((t) => t.categoryId == null || !known.has(t.categoryId))
  const groups = categories.map((c) => ({ category: c as C | null, todos: todos.filter((t) => t.categoryId === c.id) }))
  return base.length > 0 || categories.length === 0 ? [{ category: null, todos: base }, ...groups] : groups
}

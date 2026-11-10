import type { Priority, Todo, Transaction } from '../db/types'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from './categories'

export interface MonthSummary {
  income: number
  expense: number
  /** 수입 − 지출 */
  balance: number
}

/** 월 합계 (FR-015) */
export function monthSummary(list: Transaction[]): MonthSummary {
  let income = 0
  let expense = 0
  for (const t of list) {
    if (t.type === 'INCOME') income += t.amount
    else expense += t.amount
  }
  return { income, expense, balance: income - expense }
}

/**
 * 사용률 = 지출 ÷ 수입 × 100, 반올림 (FR-051)
 * 수입이 0원이면 계산할 수 없으므로 null ("-"로 표시)
 */
export function usageRate(summary: Pick<MonthSummary, 'income' | 'expense'>): number | null {
  if (summary.income <= 0) return null
  return Math.round((summary.expense / summary.income) * 100)
}

/** 오늘 지출 합계 (FR-051) */
export function todayExpense(list: Transaction[], today: string): number {
  return list.reduce((sum, t) => (t.type === 'EXPENSE' && t.date === today ? sum + t.amount : sum), 0)
}

// ───────────── 카테고리 필터 (FR-018) ─────────────

const CATEGORY_ORDER: string[] = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter((c) => c !== '기타')]

/** 이 목록에 쓰인 카테고리 (기본 카테고리 순서) */
export function categoriesUsed(list: Transaction[]): string[] {
  const used = new Set(list.map((t) => t.category))
  const rank = (c: string) => (CATEGORY_ORDER.includes(c) ? CATEGORY_ORDER.indexOf(c) : CATEGORY_ORDER.length)
  return [...used].sort((a, b) => rank(a) - rank(b))
}

/** 카테고리로 거르기. null이면 전체 */
export function filterByCategory(list: Transaction[], category: string | null): Transaction[] {
  return category === null ? list : list.filter((t) => t.category === category)
}

export interface DayGroup {
  date: string
  items: Transaction[]
  /** 그날의 지출 합계 */
  expense: number
  /** 그날의 수입 합계 */
  income: number
}

/** 정렬된 내역을 날짜별로 묶는다 (FR-014). 입력 순서를 유지한다. */
export function groupByDate(list: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  for (const t of list) {
    let group = groups.at(-1)
    if (!group || group.date !== t.date) {
      group = { date: t.date, items: [], expense: 0, income: 0 }
      groups.push(group)
    }
    group.items.push(t)
    if (t.type === 'INCOME') group.income += t.amount
    else group.expense += t.amount
  }
  return groups
}

// ───────────── 할 일 ─────────────

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 }

/** 마감일이 지났고 아직 미완료인가 */
export function isOverdue(todo: Todo, today: string): boolean {
  return todo.isCompleted === 0 && todo.dueDate !== null && todo.dueDate < today
}

/**
 * '전체' 탭 정렬 (FR-024)
 * 미완료 → 완료, 그 안에서 마감일 빠른 순(없으면 맨 뒤), 중요도 높은 순, 최근 등록 순
 */
export function sortTodos(list: Todo[]): Todo[] {
  return [...list].sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) return a.isCompleted - b.isCompleted
    if (a.dueDate !== b.dueDate) {
      if (a.dueDate === null) return 1
      if (b.dueDate === null) return -1
      return a.dueDate < b.dueDate ? -1 : 1
    }
    if (a.priority !== b.priority) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}

/**
 * '오늘' 탭 (FR-023)
 * 마감일이 오늘인 할 일 + 마감일이 지났는데 미완료인 할 일.
 * 기한 지난 미완료가 맨 위, 완료한 것은 아래.
 */
export function todayTodos(list: Todo[], today: string): Todo[] {
  return sortTodos(list.filter((t) => t.dueDate === today || isOverdue(t, today)))
}

/** 오늘 할 일 진행률: (완료 수, 전체 수) */
export function todayProgress(list: Todo[], today: string): { done: number; total: number } {
  const items = todayTodos(list, today)
  return { done: items.filter((t) => t.isCompleted === 1).length, total: items.length }
}

import type { Transaction } from '../db/types'

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

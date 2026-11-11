import { db as defaultDb, type TidyDB } from '../db/database'
import type { Budget } from '../db/types'
import { nowIso } from '../lib/date'

/** 한 달 전체 예산의 category 값 */
export const TOTAL = ''

export function createBudgetRepo(database: TidyDB = defaultDb) {
  return {
    list(): Promise<Budget[]> {
      return database.budgets.toArray()
    },
    /** 예산을 정한다. amount가 없거나 0이면 지운다 */
    async set(category: string, amount: number | null): Promise<void> {
      if (!amount || amount <= 0) await database.budgets.delete(category)
      else await database.budgets.put({ category, amount: Math.round(amount), updatedAt: nowIso() })
    },
  }
}

export const budgetRepo = createBudgetRepo()

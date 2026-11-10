import { db as defaultDb, type TidyDB } from '../db/database'
import type { Transaction, TransactionType } from '../db/types'
import { nowIso } from '../lib/date'

/** 화면에서 입력받는 값 (id, 생성/수정 시각 제외) */
export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  date: string
  memo: string
  time?: string
  account?: string
}

/** 해당 달의 [시작일, 다음 달 시작일) — YYYY-MM-DD */
export function monthRange(year: number, month: number): [string, string] {
  const pad = (n: number) => String(n).padStart(2, '0')
  const start = `${year}-${pad(month)}-01`
  const nextYear = month === 12 ? year + 1 : year
  const nextMonth = month === 12 ? 1 : month + 1
  const end = `${nextYear}-${pad(nextMonth)}-01`
  return [start, end]
}

/** 최신 날짜부터, 같은 날짜는 늦은 시각 먼저, 그다음 최근 등록 순 (FR-014) */
export function sortTransactions(list: Transaction[]): Transaction[] {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    const ta = a.time ?? ''
    const tb = b.time ?? ''
    if (ta !== tb) return ta < tb ? 1 : -1
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0
  })
}

export function createTransactionRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: TransactionInput): Promise<number> {
      const now = nowIso()
      const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as TransactionInput
      return database.transactions.add({ ...clean, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: TransactionInput): Promise<void> {
      await database.transactions.update(id, { ...input, updatedAt: nowIso() })
    },

    async remove(id: number): Promise<void> {
      await database.transactions.delete(id)
    },

    async get(id: number): Promise<Transaction | undefined> {
      return database.transactions.get(id)
    },

    /** 자주 쓴 결제 수단 (많이 쓴 순) */
    async usedAccounts(limit = 6): Promise<string[]> {
      const count = new Map<string, number>()
      await database.transactions.each((t) => {
        const a = t.account?.trim()
        if (a) count.set(a, (count.get(a) ?? 0) + 1)
      })
      return [...count.entries()].sort((x, y) => y[1] - x[1]).slice(0, limit).map(([a]) => a)
    },

    /** 선택한 달의 내역 (month: 1~12) */
    async listByMonth(year: number, month: number): Promise<Transaction[]> {
      const [start, end] = monthRange(year, month)
      const list = await database.transactions.where('date').between(start, end, true, false).toArray()
      return sortTransactions(list)
    },
  }
}

export const transactionRepo = createTransactionRepo()

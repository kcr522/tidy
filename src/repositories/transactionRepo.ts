import { db as defaultDb, type TidyDB } from '../db/database'
import type { Transaction, TransactionType } from '../db/types'
import { nowIso } from '../lib/date'
import { normalizeName } from '../lib/merchants'
import { memoFixes } from '../lib/memoCleanup'

/** 화면에서 입력받는 값 (id, 생성/수정 시각 제외) */
export interface TransactionInput {
  type: TransactionType
  amount: number
  category: string
  date: string
  memo: string
  time?: string
  account?: string
  /** 적금에 넣은 저축이면 그 적금 id */
  savingsId?: number
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
    /** 저장한다. 전에 알려 준 가게 이름이면 그 이름으로 바꿔 저장한다 */
    async add(input: TransactionInput): Promise<number> {
      const now = nowIso()
      const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as TransactionInput
      return database.transaction('rw', database.transactions, database.merchantAliases, async () => {
        const raw = normalizeName(clean.memo)
        const alias = raw ? await database.merchantAliases.get(raw) : undefined
        const named = alias ? { memo: alias.name, originalMemo: clean.memo } : {}
        return database.transactions.add({ ...clean, ...named, createdAt: now, updatedAt: now })
      })
    },

    /**
     * "KCP*결제" 같은 내역에 실제 가게를 알려 준다.
     * remember면 다음에 같은 이름으로 찍힌 내역도 이 가게로 보여 준다 (이미 있는 내역 포함)
     * @returns 이름을 바꾼 내역 개수
     */
    async resolveMerchant(id: number, name: string, remember: boolean): Promise<number> {
      return database.transaction('rw', database.transactions, database.merchantAliases, async () => {
        const t = await database.transactions.get(id)
        if (!t) return 0
        const original = t.originalMemo ?? t.memo
        const now = nowIso()
        if (!remember) {
          await database.transactions.update(id, { memo: name, originalMemo: original, updatedAt: now })
          return 1
        }
        const raw = normalizeName(original)
        await database.merchantAliases.put({ raw, original, name, createdAt: now })
        const same = await database.transactions.filter((x) => x.originalMemo === undefined && normalizeName(x.memo) === raw).toArray()
        const ids = new Set([id, ...same.map((x) => x.id as number)])
        for (const tid of ids) await database.transactions.update(tid, { memo: name, originalMemo: original, updatedAt: now })
        return ids.size
      })
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

    /** 예전에 결제 알림으로 들어간 이름의 군더더기 걷기 ("가맹점: GS25 운남점" → "GS25 운남점"). 고친 개수 */
    async cleanAutoMemos(): Promise<number> {
      const [list, aliases] = await Promise.all([database.transactions.toArray(), database.merchantAliases.toArray()])
      const fixes = memoFixes(list, new Set(aliases.map((a) => a.raw)))
      if (!fixes.length) return 0
      const now = nowIso()
      await database.transaction('rw', database.transactions, async () => {
        for (const f of fixes) await database.transactions.update(f.id, { memo: f.memo, updatedAt: now })
      })
      return fixes.length
    },

    /** 선택한 달의 내역 (month: 1~12) */
    /** 모든 내역 (차트·통계용) */
    async listAll(): Promise<Transaction[]> {
      return database.transactions.toArray()
    },

    async listByMonth(year: number, month: number): Promise<Transaction[]> {
      const [start, end] = monthRange(year, month)
      const list = await database.transactions.where('date').between(start, end, true, false).toArray()
      return sortTransactions(list)
    },
  }
}

export const transactionRepo = createTransactionRepo()

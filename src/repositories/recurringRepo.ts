import { db as defaultDb, type TidyDB } from '../db/database'
import type { Recurring } from '../db/types'
import { nowIso } from '../lib/date'
import { pendingDates } from '../lib/recurring'

export type RecurringInput = Pick<Recurring, 'type' | 'amount' | 'category' | 'memo' | 'account' | 'day' | 'startDate'>

export function createRecurringRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: RecurringInput): Promise<number> {
      const now = nowIso()
      const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) as RecurringInput
      return database.recurring.add({ ...clean, lastDate: null, isActive: 1, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: RecurringInput): Promise<void> {
      await database.recurring.update(id, { ...input, updatedAt: nowIso() })
    },

    async setActive(id: number, active: boolean): Promise<void> {
      await database.recurring.update(id, { isActive: active ? 1 : 0, updatedAt: nowIso() })
    },

    /** 규칙만 지운다. 이미 기록된 내역은 남는다 */
    async remove(id: number): Promise<void> {
      await database.recurring.delete(id)
    },

    async list(): Promise<Recurring[]> {
      const all = await database.recurring.toArray()
      return all.sort((a, b) => a.day - b.day || a.createdAt.localeCompare(b.createdAt))
    },

    /**
     * 오늘까지 기록할 정기 내역을 가계부에 넣는다. 여러 번 불러도 같은 날짜는 한 번만 기록된다.
     * @returns 새로 기록한 개수
     */
    async runDue(today: string): Promise<number> {
      return database.transaction('rw', database.recurring, database.transactions, async () => {
        let added = 0
        const rules = await database.recurring.where('isActive').equals(1).toArray()
        for (const r of rules) {
          const dates = pendingDates(r, today)
          if (dates.length === 0 || r.id == null) continue
          const now = nowIso()
          await database.transactions.bulkAdd(
            dates.map((date) => ({
              type: r.type,
              amount: r.amount,
              category: r.category,
              date,
              memo: r.memo,
              ...(r.account ? { account: r.account } : {}),
              recurringId: r.id,
              createdAt: now,
              updatedAt: now,
            })),
          )
          await database.recurring.update(r.id, { lastDate: dates[dates.length - 1] })
          added += dates.length
        }
        return added
      })
    },
  }
}

export const recurringRepo = createRecurringRepo()

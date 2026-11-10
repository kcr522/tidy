import { db as defaultDb, type TidyDB } from '../db/database'
import type { SavingsPlan } from '../db/types'
import { nowIso } from '../lib/date'
import { depositDates } from '../lib/savings'

export type SavingsInput = Pick<
  SavingsPlan,
  'name' | 'bank' | 'amount' | 'startDate' | 'endDate' | 'rate' | 'interestType' | 'taxType' | 'schedule' | 'autoDeposit' | 'alarmOn' | 'alarmTime' | 'memo'
>

/** 가계부에 적힐 이름 */
export const depositMemo = (p: Pick<SavingsPlan, 'name'>) => (/(적금|계좌|저축)$/.test(p.name) ? p.name : `${p.name} 적금`)

/** 같이 만드는 습관 */
const habitFields = (p: Pick<SavingsPlan, 'name' | 'schedule'>) => ({
  title: `${depositMemo(p)} 넣기`.slice(0, 30),
  emoji: '🐷',
  schedule: p.schedule,
})

export function createSavingsRepo(database: TidyDB = defaultDb) {
  const tables = [database.savings, database.habits, database.habitChecks, database.transactions]

  /** 그날 넣은 돈을 가계부에 적는다 (이미 있으면 그대로) */
  async function recordDeposit(plan: SavingsPlan, date: string): Promise<boolean> {
    const exists = await database.transactions.where('savingsId').equals(plan.id!).filter((t) => t.date === date).count()
    if (exists > 0) return false
    const now = nowIso()
    await database.transactions.add({
      type: 'EXPENSE',
      amount: plan.amount,
      category: '저축',
      date,
      memo: depositMemo(plan),
      ...(plan.bank ? { account: plan.bank } : {}),
      savingsId: plan.id,
      createdAt: now,
      updatedAt: now,
    })
    return true
  }

  return {
    async list(): Promise<SavingsPlan[]> {
      const all = await database.savings.toArray()
      return all.sort((a, b) => a.endDate.localeCompare(b.endDate))
    },

    async get(id: number): Promise<SavingsPlan | undefined> {
      return database.savings.get(id)
    },

    /** 적금을 만들고, 넣는 날을 알려 줄 습관도 같이 만든다 */
    async add(input: SavingsInput): Promise<number> {
      return database.transaction('rw', tables, async () => {
        const now = nowIso()
        const id = await database.savings.add({ ...input, lastDate: null, createdAt: now, updatedAt: now })
        const last = await database.habits.orderBy('order').last()
        const habitId = await database.habits.add({ ...habitFields(input), savingsId: id, order: (last?.order ?? 0) + 1, createdAt: now, updatedAt: now })
        await database.savings.update(id, { habitId })
        return id
      })
    },

    async update(id: number, input: SavingsInput): Promise<void> {
      await database.transaction('rw', tables, async () => {
        const before = await database.savings.get(id)
        await database.savings.update(id, { ...input, updatedAt: nowIso() })
        if (before?.habitId != null) await database.habits.update(before.habitId, { ...habitFields(input), updatedAt: nowIso() })
        // 이름이나 금액을 바꾸면 앞으로 기록될 내역부터 바뀐다. 이미 기록된 내역은 그대로
      })
    },

    /** 적금과 습관(체크 기록 포함)을 지운다. 가계부에 기록된 납입 내역은 남는다 */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', tables, async () => {
        const plan = await database.savings.get(id)
        if (plan?.habitId != null) {
          await database.habitChecks.where('habitId').equals(plan.habitId).delete()
          await database.habits.delete(plan.habitId)
        }
        await database.savings.delete(id)
      })
    },

    /**
     * 자동이체 적금: 오늘까지 넣는 날을 가계부에 기록하고 습관도 체크한다.
     * 여러 번 불러도 같은 날은 한 번만 기록된다.
     * @returns 새로 기록한 개수
     */
    async runDue(today: string): Promise<number> {
      return database.transaction('rw', tables, async () => {
        let added = 0
        for (const plan of await database.savings.toArray()) {
          if (plan.autoDeposit !== 1 || plan.id == null) continue
          const dates = depositDates(plan, today).filter((d) => !plan.lastDate || d > plan.lastDate)
          if (dates.length === 0) continue
          for (const d of dates) {
            if (await recordDeposit(plan, d)) added += 1
            if (plan.habitId != null && !(await database.habitChecks.get([plan.habitId, d]))) {
              await database.habitChecks.add({ habitId: plan.habitId, date: d, createdAt: nowIso() })
            }
          }
          await database.savings.update(plan.id, { lastDate: dates[dates.length - 1] })
        }
        return added
      })
    },

    /** 직접 넣는 적금: 습관을 체크하면 그날 납입을 기록하고, 체크를 풀면 지운다 */
    async onHabitToggle(savingsId: number, date: string, done: boolean): Promise<void> {
      const plan = await database.savings.get(savingsId)
      if (!plan || plan.autoDeposit === 1) return
      if (done) await recordDeposit(plan, date)
      else await database.transactions.where('savingsId').equals(savingsId).filter((t) => t.date === date).delete()
    },

    /** 적금별로 가계부에 기록된 납입 (적금 id → 횟수, 합계) */
    async depositedTotals(): Promise<Map<number, { count: number; amount: number }>> {
      const map = new Map<number, { count: number; amount: number }>()
      for (const t of await database.transactions.where('savingsId').above(0).toArray()) {
        const cur = map.get(t.savingsId!) ?? { count: 0, amount: 0 }
        map.set(t.savingsId!, { count: cur.count + 1, amount: cur.amount + t.amount })
      }
      return map
    },

    /** 이 적금으로 가계부에 기록된 돈 */
    async depositedTotal(id: number): Promise<{ count: number; amount: number }> {
      const rows = await database.transactions.where('savingsId').equals(id).toArray()
      return { count: rows.length, amount: rows.reduce((s, t) => s + t.amount, 0) }
    },
  }
}

export const savingsRepo = createSavingsRepo()

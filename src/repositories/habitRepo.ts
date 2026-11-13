import { db as defaultDb, type TidyDB } from '../db/database'
import type { Habit, HabitCheck } from '../db/types'
import { nowIso } from '../lib/date'
import { createSavingsRepo } from './savingsRepo'

export interface HabitInput {
  title: string
  emoji: string
}

export function createHabitRepo(database: TidyDB = defaultDb) {
  return {
    async list(): Promise<Habit[]> {
      return database.habits.orderBy('order').toArray()
    },

    async add(input: HabitInput): Promise<number> {
      const now = nowIso()
      const last = await database.habits.orderBy('order').last()
      return database.habits.add({ ...input, order: (last?.order ?? 0) + 1, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: HabitInput): Promise<void> {
      await database.habits.update(id, { ...input, updatedAt: nowIso() })
    },

    /** 습관과 그 체크 기록을 함께 지운다 */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', database.habits, database.habitChecks, database.savings, async () => {
        await database.habitChecks.where('habitId').equals(id).delete()
        const habit = await database.habits.get(id)
        // 적금 습관을 지우면 적금은 남고 습관 연결만 끊긴다
        if (habit?.savingsId != null) await database.savings.update(habit.savingsId, { habitId: undefined })
        await database.habits.delete(id)
      })
    },

    /**
     * 그날 했음 ↔ 안 했음. 바뀐 뒤 상태(true: 했음)를 돌려준다
     * 직접 넣는 적금의 습관이면 가계부 납입 기록도 같이 넣고 뺀다
     */
    async toggle(habitId: number, date: string): Promise<boolean> {
      return database.transaction('rw', [database.habits, database.habitChecks, database.savings, database.transactions], async () => {
        const key: [number, string] = [habitId, date]
        const done = !(await database.habitChecks.get(key))
        if (done) await database.habitChecks.add({ habitId, date, createdAt: nowIso() })
        else await database.habitChecks.delete(key)
        const habit = await database.habits.get(habitId)
        if (habit?.savingsId != null) await createSavingsRepo(database).onHabitToggle(habit.savingsId, date, done)
        return done
      })
    },

    async allChecks(): Promise<HabitCheck[]> {
      return database.habitChecks.toArray()
    },
  }
}

export const habitRepo = createHabitRepo()

/** 체크 기록을 습관별 날짜 묶음으로 */
export function groupChecks(checks: HabitCheck[]): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>()
  for (const c of checks) {
    let set = map.get(c.habitId)
    if (!set) map.set(c.habitId, (set = new Set()))
    set.add(c.date)
  }
  return map
}

import { db as defaultDb, type TidyDB } from '../db/database'
import type { Habit, HabitCheck } from '../db/types'
import { nowIso } from '../lib/date'

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
      await database.transaction('rw', database.habits, database.habitChecks, async () => {
        await database.habitChecks.where('habitId').equals(id).delete()
        await database.habits.delete(id)
      })
    },

    /** 그날 했음 ↔ 안 했음. 바뀐 뒤 상태(true: 했음)를 돌려준다 */
    async toggle(habitId: number, date: string): Promise<boolean> {
      return database.transaction('rw', database.habitChecks, async () => {
        const key: [number, string] = [habitId, date]
        if (await database.habitChecks.get(key)) {
          await database.habitChecks.delete(key)
          return false
        }
        await database.habitChecks.add({ habitId, date, createdAt: nowIso() })
        return true
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

import { db as defaultDb, type TidyDB } from '../db/database'
import type { Diary } from '../db/types'
import { nowIso } from '../lib/date'
import { randomDiaryColor } from '../lib/eventLayout'

export interface DiaryInput {
  text: string
  photo?: string
}

export function createDiaryRepo(database: TidyDB = defaultDb, random: () => number = Math.random) {
  return {
    async get(date: string): Promise<Diary | undefined> {
      return database.diaries.get(date)
    },

    /** 그날 일기를 쓰거나 고친다. 색은 처음 쓸 때 한 번 정하고 그대로 둔다 */
    async save(date: string, input: DiaryInput): Promise<void> {
      const now = nowIso()
      const old = await database.diaries.get(date)
      const entry: Diary = {
        date,
        text: input.text,
        color: old?.color ?? randomDiaryColor(random),
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      }
      if (input.photo) entry.photo = input.photo
      await database.diaries.put(entry)
    },

    async remove(date: string): Promise<void> {
      await database.diaries.delete(date)
    },

    async listBetween(from: string, to: string): Promise<Diary[]> {
      return database.diaries.where('date').between(from, to, true, true).toArray()
    },

    /** 최근 일기부터 */
    async recent(limit = 30): Promise<Diary[]> {
      return database.diaries.orderBy('date').reverse().limit(limit).toArray()
    },
  }
}

export const diaryRepo = createDiaryRepo()

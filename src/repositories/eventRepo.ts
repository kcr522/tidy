import { db as defaultDb, type TidyDB } from '../db/database'
import type { CalendarEvent } from '../db/types'
import { cleanAttachments } from '../lib/attachments'
import { nowIso } from '../lib/date'

export type EventInput = Pick<CalendarEvent, 'title' | 'startDate' | 'endDate' | 'color' | 'memo' | 'attachments'>

/** 끝 날짜가 시작보다 앞이면 서로 바꿔 둔다. 첨부는 다듬고, 없으면 칸을 비운다 */
function normalize(input: EventInput): EventInput {
  const swapped = input.endDate < input.startDate ? { ...input, startDate: input.endDate, endDate: input.startDate } : input
  const attachments = cleanAttachments(input.attachments)
  return { ...swapped, attachments: attachments.length ? attachments : undefined }
}

export function createEventRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: EventInput): Promise<number> {
      const now = nowIso()
      return database.events.add({ ...normalize(input), createdAt: now, updatedAt: now })
    },

    async update(id: number, input: EventInput): Promise<void> {
      await database.events.update(id, { ...normalize(input), updatedAt: nowIso() })
    },

    async remove(id: number): Promise<void> {
      await database.events.delete(id)
    },

    /** from~to 기간과 하루라도 겹치는 일정 (달력 한 화면 분량) */
    async listBetween(from: string, to: string): Promise<CalendarEvent[]> {
      return database.events.where('startDate').belowOrEqual(to).filter((e) => e.endDate >= from).toArray()
    },
  }
}

export const eventRepo = createEventRepo()

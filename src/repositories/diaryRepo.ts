import { db as defaultDb, type TidyDB } from '../db/database'
import type { Attachment, Diary, DiaryPhoto } from '../db/types'
import { cleanAttachments } from '../lib/attachments'
import { cleanPhotos, diaryPhotos } from '../lib/diaryPhotos'
import { nowIso } from '../lib/date'
import { randomDiaryColor } from '../lib/eventLayout'

export interface DiaryInput {
  text: string
  /** 사진 한 장만 넣을 때 (AI 대화창 등) */
  photo?: string
  /** 사진 여러 장 (있으면 photo 대신 이걸 쓴다) */
  photos?: DiaryPhoto[]
  /** 붙인 파일 (PDF, 문서 등) */
  attachments?: Attachment[]
  /** 대표 사진 (photos 중 하나의 src). 없으면 예전 대표 사진을 지키고, 그것도 없으면 첫 장 */
  cover?: string
}

export function createDiaryRepo(database: TidyDB = defaultDb, random: () => number = Math.random) {
  return {
    async get(date: string): Promise<Diary | undefined> {
      return database.diaries.get(date)
    },

    /** 그날 일기를 쓰거나 고친다. 색은 처음 쓸 때 한 번 정하고 그대로 둔다. 저장한 시각(updatedAt)을 돌려준다 */
    async save(date: string, input: DiaryInput): Promise<string> {
      const now = nowIso()
      const old = await database.diaries.get(date)
      const entry: Diary = {
        date,
        text: input.text,
        color: old?.color ?? randomDiaryColor(random),
        createdAt: old?.createdAt ?? now,
        updatedAt: now,
      }
      const photos = cleanPhotos(input.photos ?? (input.photo ? [{ src: input.photo }] : []))
      if (photos.length) {
        // 대표 사진: 고른 사진이 아직 있으면 그대로, 없으면 첫 장 (사용자 요청 2026-11-12)
        const cover = input.cover ?? old?.photo
        entry.photo = photos.find((p) => p.src === cover)?.src ?? photos[0].src
        entry.photos = photos
      }
      const files = cleanAttachments(input.attachments)
      if (files.length) entry.attachments = files
      await database.diaries.put(entry)
      return now
    },

    /** 일기 달력에 크게 보일 대표 사진을 바꾼다. 그 일기에 있는 사진만 고를 수 있다 */
    async setCover(date: string, src: string): Promise<void> {
      const old = await database.diaries.get(date)
      if (!old || !diaryPhotos(old).some((p) => p.src === src)) return
      await database.diaries.update(date, { photo: src, updatedAt: nowIso() })
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

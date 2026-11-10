import { db as defaultDb, type TidyDB } from '../db/database'
import type { ScrapMedia } from '../db/types'
import { nowIso } from '../lib/date'

/** 스크랩에 붙은 썸네일과 캡처(사진·화면 녹화) */
export function createScrapMediaRepo(database: TidyDB = defaultDb) {
  return {
    /** 썸네일은 스크랩 하나에 하나: 새로 받으면 바꾼다 */
    async setThumb(bookmarkId: number, blob: Blob): Promise<void> {
      await database.transaction('rw', database.scrapMedia, async () => {
        await database.scrapMedia.where('[bookmarkId+kind]').equals([bookmarkId, 'thumb']).delete()
        const now = nowIso()
        await database.scrapMedia.add({ bookmarkId, kind: 'thumb', blob, createdAt: now, updatedAt: now })
      })
    },

    async addCapture(bookmarkId: number, blob: Blob): Promise<number> {
      const now = nowIso()
      return database.scrapMedia.add({ bookmarkId, kind: 'capture', blob, createdAt: now, updatedAt: now })
    },

    /** 편집한 사진 저장. 처음 편집할 때만 원본을 따로 남긴다 */
    async saveEdited(id: number, blob: Blob): Promise<void> {
      await database.transaction('rw', database.scrapMedia, async () => {
        const m = await database.scrapMedia.get(id)
        if (!m) return
        await database.scrapMedia.update(id, { blob, original: m.original ?? m.blob, updatedAt: nowIso() })
      })
    },

    /** 원본으로 되돌리기 */
    async restoreOriginal(id: number): Promise<void> {
      await database.transaction('rw', database.scrapMedia, async () => {
        const m = await database.scrapMedia.get(id)
        if (!m?.original) return
        await database.scrapMedia.update(id, { blob: m.original, original: undefined, updatedAt: nowIso() })
      })
    },

    async remove(id: number): Promise<void> {
      await database.scrapMedia.delete(id)
    },

    async get(id: number): Promise<ScrapMedia | undefined> {
      return database.scrapMedia.get(id)
    },

    async captures(bookmarkId: number): Promise<ScrapMedia[]> {
      return database.scrapMedia.where('[bookmarkId+kind]').equals([bookmarkId, 'capture']).sortBy('createdAt')
    },

    /**
     * 카드에 보여 줄 대표 사진: 스크랩마다 썸네일(없으면 첫 캡처 사진)과 캡처 개수
     * 영상은 대표 사진으로 쓰지 않는다
     */
    async covers(): Promise<Map<number, { cover?: Blob; captures: number; videos: number }>> {
      const all = await database.scrapMedia.toArray()
      const map = new Map<number, { cover?: Blob; captures: number; videos: number }>()
      for (const m of all.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
        const e = map.get(m.bookmarkId) ?? { captures: 0, videos: 0 }
        const isVideo = m.blob.type.startsWith('video/')
        if (m.kind === 'thumb') e.cover = m.blob
        else {
          e.captures++
          if (isVideo) e.videos++
          else if (!e.cover) e.cover = m.blob
        }
        map.set(m.bookmarkId, e)
      }
      return map
    },
  }
}

export const scrapMediaRepo = createScrapMediaRepo()

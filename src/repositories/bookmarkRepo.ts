import { db as defaultDb, type TidyDB } from '../db/database'
import type { Bookmark } from '../db/types'
import { nowIso } from '../lib/date'

/** 화면에서 입력받는 값 (url은 normalizeUrl을 거친 값, title은 비어 있지 않은 값) */
export interface BookmarkInput {
  url: string
  title: string
  memo: string
}

export type BookmarkFilter = 'all' | 'unread'

export function createBookmarkRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: BookmarkInput): Promise<number> {
      const now = nowIso()
      return database.bookmarks.add({ ...input, isRead: 0, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: BookmarkInput): Promise<void> {
      await database.bookmarks.update(id, { ...input, updatedAt: nowIso() })
    },

    /** 삭제. 이 스크랩에서 전환된 할 일은 남기고 연결만 끊는다 (FR-044) */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', database.bookmarks, database.todos, async () => {
        await database.todos
          .where('bookmarkId')
          .equals(id)
          .modify((todo) => {
            delete todo.bookmarkId
            todo.updatedAt = nowIso()
          })
        await database.bookmarks.delete(id)
      })
    },

    async get(id: number): Promise<Bookmark | undefined> {
      return database.bookmarks.get(id)
    },

    /** 읽음 ↔ 안 읽음 (FR-036) */
    async toggleRead(id: number): Promise<void> {
      await database.transaction('rw', database.bookmarks, async () => {
        const b = await database.bookmarks.get(id)
        if (!b) return
        await database.bookmarks.update(id, { isRead: b.isRead === 1 ? 0 : 1, updatedAt: nowIso() })
      })
    },

    /** 읽음으로 (링크를 열 때, FR-035) */
    async markRead(id: number): Promise<void> {
      await database.bookmarks.update(id, { isRead: 1, updatedAt: nowIso() })
    },

    /** 같은 URL이 이미 있는지 (FR-033). 수정 중인 자기 자신은 제외 */
    async findByUrl(url: string, exceptId?: number): Promise<Bookmark | undefined> {
      const list = await database.bookmarks.where('url').equals(url).toArray()
      return list.find((b) => b.id !== exceptId)
    },

    /** 최근 저장 순 (FR-034), 필터 (FR-037) */
    async list(filter: BookmarkFilter = 'all'): Promise<Bookmark[]> {
      const list = filter === 'unread' ? await database.bookmarks.where('isRead').equals(0).toArray() : await database.bookmarks.toArray()
      return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : (b.id ?? 0) - (a.id ?? 0)))
    },
  }
}

export const bookmarkRepo = createBookmarkRepo()

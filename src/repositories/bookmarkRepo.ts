import { db as defaultDb, type TidyDB } from '../db/database'
import type { Bookmark } from '../db/types'
import { instagramPost, type SavedPost } from '../lib/scrap/instagramSaved'
import { nowIso } from '../lib/date'

/** 화면에서 입력받는 값 (url은 normalizeUrl을 거친 값, title은 비어 있지 않은 값) */
export interface BookmarkInput {
  url: string
  title: string
  memo: string
  /** 아래는 2차(스크랩 카테고리·미리보기)부터. 없으면 그대로 둔다 */
  categoryId?: number | null
  source?: string
  description?: string
  siteName?: string
  isVideo?: boolean
}

/** 화면 값 → 저장할 값 (categoryId: null이면 미분류로) */
function toRecord(input: BookmarkInput): Partial<Bookmark> {
  const { categoryId, isVideo, ...rest } = input
  const out: Partial<Bookmark> = { ...rest }
  if (categoryId !== undefined) out.categoryId = categoryId ?? undefined
  if (isVideo !== undefined) out.isVideo = isVideo ? 1 : 0
  return out
}

export type BookmarkFilter = 'all' | 'unread'

export function createBookmarkRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: BookmarkInput): Promise<number> {
      const now = nowIso()
      return database.bookmarks.add({ ...(toRecord(input) as Bookmark), isRead: 0, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: BookmarkInput): Promise<void> {
      const rec = toRecord(input)
      // categoryId가 undefined로 들어 있으면 Dexie가 그 칸을 지운다 (= 미분류)
      await database.bookmarks.update(id, { ...rec, updatedAt: nowIso() })
    },

    /** 서버에서 읽어 온 본문(설명)이나 다듬은 제목만 바꾸기 */
    async patch(id: number, fields: { title?: string; description?: string }): Promise<void> {
      const out: Partial<Bookmark> = {}
      if (fields.title) out.title = fields.title
      if (fields.description) out.description = fields.description
      if (Object.keys(out).length) await database.bookmarks.update(id, { ...out, updatedAt: nowIso() })
    },

    /** AI(또는 기본) 요약 저장 */
    async setSummary(id: number, summary: string): Promise<void> {
      await database.bookmarks.update(id, { summary, summaryAt: nowIso() })
    },

    /** 삭제. 이 스크랩에서 전환된 할 일은 남기고 연결만 끊는다 (FR-044). 붙은 사진·영상도 지운다 */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', database.bookmarks, database.todos, database.scrapMedia, async () => {
        await database.scrapMedia.where('bookmarkId').equals(id).delete()
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

    /**
     * 인스타 "저장됨" 목록 한꺼번에 넣기. 이미 있는 게시물은 건너뛴다.
     * withCollections 면 인스타 컬렉션 이름과 같은 스크랩 카테고리에 넣는다 (없으면 만든다, 12자까지)
     */
    async importInstagram(posts: SavedPost[], withCollections = true): Promise<{ added: number[]; skipped: number }> {
      return database.transaction('rw', database.bookmarks, database.scrapCategories, async () => {
        const have = new Set<string>()
        for (const b of await database.bookmarks.toArray()) {
          const p = instagramPost(b.url)
          if (p) have.add(p.code)
        }
        const cats = new Map((await database.scrapCategories.toArray()).map((c) => [c.name, c.id as number]))
        let order = ((await database.scrapCategories.orderBy('order').last())?.order ?? -1) + 1
        const categoryFor = async (raw?: string): Promise<number | undefined> => {
          const name = raw?.trim().replace(/\s+/g, ' ').slice(0, 12)
          if (!withCollections || !name || name === '전체' || name === '미분류') return undefined
          const found = cats.get(name)
          if (found != null) return found
          const id = (await database.scrapCategories.add({ name, order: order++, createdAt: nowIso() })) as number
          cats.set(name, id)
          return id
        }
        const added: number[] = []
        let skipped = 0
        // 오래된 것부터 넣어서 최근 저장한 게시물이 목록 위로
        for (const p of [...posts].reverse()) {
          if (have.has(p.code)) {
            skipped++
            continue
          }
          have.add(p.code)
          const at = p.savedAt ?? nowIso()
          const rec: Bookmark = {
            url: p.url,
            title: p.author ? `@${p.author}의 게시물` : 'Instagram 게시물',
            memo: '',
            isRead: 0,
            createdAt: at,
            updatedAt: nowIso(),
            source: 'instagram',
            siteName: 'Instagram',
            isVideo: p.url.includes('/reel/') ? 1 : 0,
          }
          const categoryId = await categoryFor(p.collection)
          if (categoryId != null) rec.categoryId = categoryId
          added.push((await database.bookmarks.add(rec)) as number)
        }
        return { added, skipped }
      })
    },

    /** 최근 저장 순 (FR-034), 필터 (FR-037) */
    async list(filter: BookmarkFilter = 'all'): Promise<Bookmark[]> {
      const list = filter === 'unread' ? await database.bookmarks.where('isRead').equals(0).toArray() : await database.bookmarks.toArray()
      return list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : (b.id ?? 0) - (a.id ?? 0)))
    },
  }
}

export const bookmarkRepo = createBookmarkRepo()

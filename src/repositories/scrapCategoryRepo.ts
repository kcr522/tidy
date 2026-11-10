import { db as defaultDb, type TidyDB } from '../db/database'
import type { ScrapCategory } from '../db/types'
import { nowIso } from '../lib/date'

export const MAX_CATEGORY_NAME = 12

export class CategoryNameError extends Error {}

function checkName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new CategoryNameError('이름을 입력해 주세요')
  if (name.length > MAX_CATEGORY_NAME) throw new CategoryNameError(`${MAX_CATEGORY_NAME}자까지 쓸 수 있어요`)
  if (name === '전체' || name === '미분류') throw new CategoryNameError('이 이름은 쓸 수 없어요')
  return name
}

/** 스크랩 카테고리 (맛집·카페, 여행 …) */
export function createScrapCategoryRepo(database: TidyDB = defaultDb) {
  async function ensureUnique(name: string, exceptId?: number) {
    const same = await database.scrapCategories.where('name').equals(name).first()
    if (same && same.id !== exceptId) throw new CategoryNameError('이미 있는 카테고리예요')
  }

  return {
    async list(): Promise<ScrapCategory[]> {
      return database.scrapCategories.orderBy('order').toArray()
    },

    async add(rawName: string): Promise<number> {
      const name = checkName(rawName)
      await ensureUnique(name)
      const last = await database.scrapCategories.orderBy('order').last()
      return database.scrapCategories.add({ name, order: (last?.order ?? -1) + 1, createdAt: nowIso() })
    },

    async rename(id: number, rawName: string): Promise<void> {
      const name = checkName(rawName)
      await ensureUnique(name, id)
      await database.scrapCategories.update(id, { name })
    },

    /** 순서 바꾸기: 위(-1) / 아래(+1) */
    async move(id: number, dir: -1 | 1): Promise<void> {
      await database.transaction('rw', database.scrapCategories, async () => {
        const list = await database.scrapCategories.orderBy('order').toArray()
        const i = list.findIndex((c) => c.id === id)
        const j = i + dir
        if (i < 0 || j < 0 || j >= list.length) return
        ;[list[i], list[j]] = [list[j], list[i]]
        await Promise.all(list.map((c, order) => database.scrapCategories.update(c.id!, { order })))
      })
    },

    /** 지우면 그 카테고리의 스크랩은 '미분류'로 (스크랩은 지우지 않는다) */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', database.scrapCategories, database.bookmarks, async () => {
        await database.bookmarks
          .where('categoryId')
          .equals(id)
          .modify((b) => {
            delete b.categoryId
          })
        await database.scrapCategories.delete(id)
      })
    },
  }
}

export const scrapCategoryRepo = createScrapCategoryRepo()

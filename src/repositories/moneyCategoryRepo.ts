import { liveQuery } from 'dexie'
import { db as defaultDb, type TidyDB } from '../db/database'
import type { MoneyCategory, TransactionType } from '../db/types'
import { buildCategories, defaultKey, MAX_CATEGORY_NAME, OTHER_CATEGORY, setCategoryRows, type CategoryItem } from '../lib/categories'
import { nowIso } from '../lib/date'

export class CategoryError extends Error {}

export interface CategoryInput {
  name: string
  icon: string
}

function cleanName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new CategoryError('이름을 입력해 주세요')
  if (name.length > MAX_CATEGORY_NAME) throw new CategoryError(`${MAX_CATEGORY_NAME}자까지 쓸 수 있어요`)
  return name
}

/** 저장할 모양 (값이 없는 칸은 아예 뺀다: 동기화할 때 undefined 를 못 보낸다) */
function rowOf(c: CategoryItem, createdAt: string, now: string): MoneyCategory {
  return { key: c.key, type: c.type, name: c.name, icon: c.icon, order: c.order, createdAt, updatedAt: now }
}

/**
 * 가계부 카테고리 만들기 · 고치기 · 지우기.
 * 내역은 이름(Transaction.category)으로 이어지므로 이름을 바꾸면 그 이름으로 쓴 내역 · 고정 금액 · 예산도 같이 바꾸고,
 * 지우면 그 내역은 '기타'로 옮긴다
 */
export function createMoneyCategoryRepo(database: TidyDB = defaultDb) {
  const table = database.moneyCategories

  async function items(type: TransactionType): Promise<CategoryItem[]> {
    return buildCategories(type, await table.toArray())
  }

  async function itemOf(key: string): Promise<CategoryItem> {
    const type: TransactionType = key.startsWith('INCOME:') ? 'INCOME' : 'EXPENSE'
    const item = (await items(type)).find((c) => c.key === key)
    if (!item) throw new CategoryError('없는 카테고리예요')
    return item
  }

  async function ensureUnique(type: TransactionType, name: string, exceptKey?: string) {
    if ((await items(type)).some((c) => c.name === name && c.key !== exceptKey)) throw new CategoryError('이미 있는 이름이에요')
  }

  /** 바뀐 것만 다시 쓴다 (처음 바꾸는 기본 카테고리는 이때 줄이 생긴다) */
  async function save(c: CategoryItem) {
    const now = nowIso()
    const before = await table.get(c.key)
    await table.put(rowOf(c, before?.createdAt ?? now, now))
  }

  /** 그 이름으로 쓴 내역 · 고정 금액을 다른 이름으로 (몇 개 바꿨는지 돌려준다) */
  async function moveRecords(type: TransactionType, from: string, to: string): Promise<number> {
    const now = nowIso()
    const n = await database.transactions.filter((t) => t.type === type && t.category === from).modify({ category: to, updatedAt: now })
    await database.recurring.filter((r) => r.type === type && r.category === from).modify({ category: to })
    return n
  }

  return {
    async list(): Promise<MoneyCategory[]> {
      return table.toArray()
    },

    items,

    /** 이 카테고리로 적은 내역 수 (지우기 전에 보여 준다) */
    async countUsed(type: TransactionType, name: string): Promise<number> {
      return database.transactions.filter((t) => t.type === type && t.category === name).count()
    },

    /** 새 카테고리. 예전에 지운 기본 카테고리와 이름이 같으면 그것을 다시 살린다 */
    async add(type: TransactionType, input: CategoryInput): Promise<string> {
      const name = cleanName(input.name)
      await ensureUnique(type, name)
      const list = await items(type)
      const order = list.reduce((m, c) => Math.max(m, c.order), -1) + 1
      const now = nowIso()
      const gone = (await table.where('type').equals(type).toArray()).find((r) => r.hidden && (r.name === name || r.key === defaultKey(type, name)))
      if (gone) {
        await table.put({ key: gone.key, type, name, icon: input.icon, order, createdAt: gone.createdAt, updatedAt: now })
        return gone.key
      }
      const key = `${type}:+${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
      await table.add({ key, type, name, icon: input.icon, order, createdAt: now, updatedAt: now })
      return key
    },

    /** 이름 · 아이콘 바꾸기. 이름이 바뀌면 그 이름으로 쓴 내역 수를 돌려준다 (기타 · 저축은 아이콘만) */
    async update(key: string, input: CategoryInput): Promise<number> {
      const item = await itemOf(key)
      const name = item.fixed ? item.name : cleanName(input.name)
      await ensureUnique(item.type, name, key)
      return database.transaction('rw', [table, database.transactions, database.recurring, database.budgets], async () => {
        await save({ ...item, name, icon: input.icon })
        if (name === item.name) return 0
        if (item.type === 'EXPENSE') {
          const budget = await database.budgets.get(item.name)
          if (budget) {
            await database.budgets.delete(item.name)
            await database.budgets.put({ ...budget, category: name, updatedAt: nowIso() })
          }
        }
        return moveRecords(item.type, item.name, name)
      })
    },

    /** 지우기: 그 내역 · 고정 금액은 '기타'로 옮기고 예산은 지운다 (옮긴 내역 수를 돌려준다) */
    async remove(key: string): Promise<number> {
      const item = await itemOf(key)
      if (item.fixed) throw new CategoryError(`${item.name}은(는) 지울 수 없어요`)
      return database.transaction('rw', [table, database.transactions, database.recurring, database.budgets], async () => {
        if (item.builtIn) {
          const now = nowIso()
          const before = await table.get(key)
          await table.put({ ...rowOf(item, before?.createdAt ?? now, now), hidden: 1 })
        } else {
          await table.delete(key)
        }
        if (item.type === 'EXPENSE') await database.budgets.delete(item.name)
        return moveRecords(item.type, item.name, OTHER_CATEGORY)
      })
    },

    /** 두 카테고리의 순서를 맞바꾼다 (위 · 아래로) */
    async swap(a: string, b: string): Promise<void> {
      await database.transaction('rw', table, async () => {
        const [x, y] = await Promise.all([itemOf(a), itemOf(b)])
        const ox = x.order === y.order ? y.order + 1 : y.order
        await save({ ...x, order: ox })
        await save({ ...y, order: x.order })
      })
    },

    /** DB 가 바뀔 때마다 앱 전체 목록(lib/categories)을 새로 맞춘다. 앱을 켤 때 한 번 */
    watch(): () => void {
      const sub = liveQuery(() => table.toArray()).subscribe({ next: setCategoryRows, error: () => undefined })
      return () => sub.unsubscribe()
    },
  }
}

export const moneyCategoryRepo = createMoneyCategoryRepo()

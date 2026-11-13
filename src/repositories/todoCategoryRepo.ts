import { db as defaultDb, type TidyDB } from '../db/database'
import type { TodoCategory, TodoCategoryColor } from '../db/types'
import { nowIso } from '../lib/date'

export const MAX_TODO_CATEGORY_NAME = 12

export class TodoCategoryNameError extends Error {}

/** 카테고리 색 순서 (새로 만들 때 차례대로 돌아가며 고른다) */
export const TODO_CATEGORY_COLORS: TodoCategoryColor[] = ['peach', 'sky', 'mint', 'lilac', 'lemon', 'rose']

function checkName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new TodoCategoryNameError('이름을 입력해 주세요')
  if (name.length > MAX_TODO_CATEGORY_NAME) throw new TodoCategoryNameError(`${MAX_TODO_CATEGORY_NAME}자까지 쓸 수 있어요`)
  if (name === '기본') throw new TodoCategoryNameError('이 이름은 쓸 수 없어요')
  return name
}

/** 할 일 카테고리 (공부, 운동 …). 카테고리 없는 할 일은 '기본'에 모인다 */
export function createTodoCategoryRepo(database: TidyDB = defaultDb) {
  async function ensureUnique(name: string, exceptId?: number) {
    const all = await database.todoCategories.toArray()
    if (all.some((c) => c.name === name && c.id !== exceptId)) throw new TodoCategoryNameError('이미 있는 카테고리예요')
  }

  return {
    async list(): Promise<TodoCategory[]> {
      return database.todoCategories.orderBy('order').toArray()
    },

    async add(rawName: string, color?: TodoCategoryColor): Promise<number> {
      const name = checkName(rawName)
      await ensureUnique(name)
      const all = await database.todoCategories.orderBy('order').toArray()
      const last = all[all.length - 1]
      return database.todoCategories.add({
        name,
        color: color ?? TODO_CATEGORY_COLORS[all.length % TODO_CATEGORY_COLORS.length],
        order: (last?.order ?? -1) + 1,
        createdAt: nowIso(),
      })
    },

    async update(id: number, rawName: string, color: TodoCategoryColor): Promise<void> {
      const name = checkName(rawName)
      await ensureUnique(name, id)
      await database.todoCategories.update(id, { name, color })
    },

    /** 지우면 그 카테고리의 할 일은 '기본'으로 옮긴다 (할 일은 지우지 않는다) */
    async remove(id: number): Promise<void> {
      await database.transaction('rw', database.todoCategories, database.todos, async () => {
        await database.todos
          .where('categoryId')
          .equals(id)
          .modify((t) => {
            delete t.categoryId
          })
        await database.todoCategories.delete(id)
      })
    },
  }
}

export const todoCategoryRepo = createTodoCategoryRepo()

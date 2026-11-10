import { db as defaultDb, type TidyDB } from '../db/database'
import type { Priority, Todo } from '../db/types'
import { nowIso } from '../lib/date'

/** 화면에서 입력받는 값 */
export interface TodoInput {
  title: string
  dueDate: string | null
  priority: Priority
}

export function createTodoRepo(database: TidyDB = defaultDb) {
  return {
    async add(input: TodoInput): Promise<number> {
      const now = nowIso()
      return database.todos.add({ ...input, isCompleted: 0, completedAt: null, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: TodoInput): Promise<void> {
      await database.todos.update(id, { ...input, updatedAt: nowIso() })
    },

    async remove(id: number): Promise<void> {
      await database.todos.delete(id)
    },

    async get(id: number): Promise<Todo | undefined> {
      return database.todos.get(id)
    },

    /** 완료 ↔ 미완료 (FR-021). 완료 시각을 기록한다. */
    async toggleComplete(id: number): Promise<void> {
      await database.transaction('rw', database.todos, async () => {
        const todo = await database.todos.get(id)
        if (!todo) return
        const now = nowIso()
        const completing = todo.isCompleted === 0
        await database.todos.update(id, {
          isCompleted: completing ? 1 : 0,
          completedAt: completing ? now : null,
          updatedAt: now,
        })
      })
    },

    async listAll(): Promise<Todo[]> {
      return database.todos.toArray()
    },
  }
}

export const todoRepo = createTodoRepo()

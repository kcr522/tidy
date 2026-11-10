import { db as defaultDb, type TidyDB } from '../db/database'
import type { Priority, Todo } from '../db/types'
import { nowIso } from '../lib/date'
import { MAX_TITLE_LENGTH } from '../lib/validate'

/** 화면에서 입력받는 값 */
export interface TodoInput {
  title: string
  dueDate: string | null
  priority: Priority
}

/** 이미 할 일로 전환한 스크랩을 다시 전환하려 할 때 (FR-041) */
export class AlreadyConvertedError extends Error {
  readonly todoId: number
  constructor(todoId: number) {
    super('이미 할 일로 등록된 스크랩이에요')
    this.todoId = todoId
    this.name = 'AlreadyConvertedError'
  }
}

/** 스크랩 제목으로 할 일 제목 만들기: "읽기: {제목}" (100자 넘으면 자른다) */
export function titleFromBookmark(bookmarkTitle: string): string {
  const title = `읽기: ${bookmarkTitle}`
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title
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

    /**
     * 완료 ↔ 미완료 (FR-021). 완료 시각을 기록한다.
     * 스크랩에서 만든 할 일을 완료하면 그 스크랩도 읽음으로 바꾼다 (FR-042).
     */
    async toggleComplete(id: number): Promise<void> {
      await database.transaction('rw', database.todos, database.bookmarks, async () => {
        const todo = await database.todos.get(id)
        if (!todo) return
        const now = nowIso()
        const completing = todo.isCompleted === 0
        await database.todos.update(id, {
          isCompleted: completing ? 1 : 0,
          completedAt: completing ? now : null,
          updatedAt: now,
        })
        if (completing && todo.bookmarkId != null) {
          await database.bookmarks.update(todo.bookmarkId, { isRead: 1, updatedAt: now })
        }
      })
    },

    /**
     * 스크랩 → 할 일 전환 (FR-040, FR-041)
     * 제목 "읽기: {스크랩 제목}", 중요도 보통. 스크랩 하나당 할 일 하나만.
     */
    async createFromBookmark(bookmarkId: number, dueDate: string | null): Promise<number> {
      return database.transaction('rw', database.todos, database.bookmarks, async () => {
        const bookmark = await database.bookmarks.get(bookmarkId)
        if (!bookmark) throw new Error('스크랩을 찾을 수 없어요')
        const existing = await database.todos.where('bookmarkId').equals(bookmarkId).first()
        if (existing?.id != null) throw new AlreadyConvertedError(existing.id)
        const now = nowIso()
        return database.todos.add({
          title: titleFromBookmark(bookmark.title),
          dueDate,
          priority: 'MEDIUM',
          isCompleted: 0,
          completedAt: null,
          bookmarkId,
          createdAt: now,
          updatedAt: now,
        })
      })
    },

    /** 스크랩 id → 연결된 할 일 id (스크랩 카드에 "할 일 등록됨" 표시용) */
    async linkedBookmarks(): Promise<Map<number, number>> {
      const linked = await database.todos.where('bookmarkId').above(0).toArray()
      return new Map(linked.map((t) => [t.bookmarkId as number, t.id as number]))
    },

    async listAll(): Promise<Todo[]> {
      return database.todos.toArray()
    },
  }
}

export const todoRepo = createTodoRepo()

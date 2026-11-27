import { db as defaultDb, type TidyDB } from '../db/database'
import type { Attachment, Priority, Todo, TodoRepeat } from '../db/types'
import { cleanAttachments } from '../lib/attachments'
import { nowIso, todayKey } from '../lib/date'
import { nextDueDate, nextRepeat, prevRepeat } from '../lib/todoRepeat'
import { MAX_TITLE_LENGTH, MAX_TODO_MEMO_LENGTH } from '../lib/validate'

/** 화면에서 입력받는 값 */
export interface TodoInput {
  title: string
  dueDate: string | null
  priority: Priority
  /** 할 일 카테고리 (없으면 '기본') */
  categoryId?: number
  /** 알림 시각 HH:mm (마감일이 있을 때만) */
  remindAt?: string
  /** 반복 (마감일이 있을 때만) */
  repeat?: TodoRepeat
  /** 메모·참고 글 */
  memo?: string
  /** 참고 사진·파일 */
  attachments?: Attachment[]
}

/** 메모·첨부 정리: 비어 있으면 값을 지운다 */
function cleanExtras(input: TodoInput): TodoInput {
  const memo = input.memo?.trim().slice(0, MAX_TODO_MEMO_LENGTH) || undefined
  const files = cleanAttachments(input.attachments)
  return { ...input, memo, attachments: files.length ? files : undefined }
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
      return database.todos.add({ ...cleanExtras(input), isCompleted: 0, completedAt: null, createdAt: now, updatedAt: now })
    },

    async update(id: number, input: TodoInput): Promise<void> {
      // 카테고리를 '기본'으로 돌리면 값을 지운다 (undefined는 update에서 무시되므로)
      const v = cleanExtras(input)
      await database.todos.update(id, { ...v, categoryId: v.categoryId, remindAt: v.remindAt, repeat: v.repeat, memo: v.memo, attachments: v.attachments, updatedAt: nowIso() })
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
     * 반복 할 일을 완료하면 다음 날짜로 새 할 일을 만든다. 완료를 되돌리면 그 새 할 일을 지운다 (아직 안 끝냈을 때). 끝나는 날짜를 넘거나 남은 횟수를 다 쓰면 더 만들지 않는다.
     * @returns 반복으로 새로 생긴 할 일의 마감일
     */
    async toggleComplete(id: number, today: string = todayKey()): Promise<string | undefined> {
      return database.transaction('rw', database.todos, database.bookmarks, async () => {
        const todo = await database.todos.get(id)
        if (!todo) return
        const now = nowIso()
        const completing = todo.isCompleted === 0
        let nextId: number | undefined
        let nextDue: string | undefined
        if (completing && todo.repeat && todo.dueDate) {
          nextDue = nextDueDate(todo.repeat, todo.dueDate, today) ?? undefined
        }
        if (completing && todo.repeat && nextDue) {
          nextId = await database.todos.add({
            title: todo.title,
            dueDate: nextDue,
            priority: todo.priority,
            ...(todo.categoryId != null && { categoryId: todo.categoryId }),
            ...(todo.remindAt && { remindAt: todo.remindAt }),
            repeat: nextRepeat(todo.repeat),
            ...(todo.memo && { memo: todo.memo }),
            ...(todo.attachments?.length && { attachments: todo.attachments }),
            isCompleted: 0,
            completedAt: null,
            createdAt: now,
            updatedAt: now,
          })
        }
        // 완료를 되돌리면: 아직 안 끝낸 다음 할 일을 지우고 반복을 이 할 일로 되돌린다
        let repeat = completing && nextId != null ? undefined : todo.repeat
        if (!completing && todo.repeatNextId != null) {
          const next = await database.todos.get(todo.repeatNextId)
          if (next && next.isCompleted === 0) {
            repeat = next.repeat && prevRepeat(next.repeat)
            await database.todos.delete(todo.repeatNextId)
          }
        }
        await database.todos.update(id, {
          isCompleted: completing ? 1 : 0,
          completedAt: completing ? now : null,
          // 반복은 다음 할 일로 넘긴다 (끝낸 할 일은 기록으로만 남는다)
          repeat,
          repeatNextId: nextId,
          updatedAt: now,
        })
        if (completing && todo.bookmarkId != null) {
          await database.bookmarks.update(todo.bookmarkId, { isRead: 1, updatedAt: now })
        }
        return nextDue
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

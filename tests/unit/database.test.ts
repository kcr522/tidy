import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'

const now = '2026-11-10T00:00:00.000Z'
let db: TidyDB

afterEach(async () => {
  await db?.delete()
})

const NOT_DONE = 0 as const
const UNREAD = 0
const BOOKMARK_ID = 1

describe('TidyDB', () => {
  it('내역 · 할 일 · 스크랩 테이블 3개에 저장하고 색인으로 다시 찾는다', async () => {
    db = new TidyDB('tidy-test-1')

    await db.transactions.add({ type: 'EXPENSE', amount: 15000, category: '식비', date: '2026-11-10', memo: '점심', createdAt: now, updatedAt: now })
    await db.todos.add({ title: '장보기', isCompleted: NOT_DONE, completedAt: null, dueDate: '2026-11-10', priority: 'MEDIUM', createdAt: now, updatedAt: now })
    await db.bookmarks.add({ url: 'https://react.dev/', title: 'React', memo: '', isRead: UNREAD, createdAt: now, updatedAt: now })

    expect(await db.transactions.where('date').equals('2026-11-10').count()).toBe(1)
    expect(await db.todos.where('isCompleted').equals(NOT_DONE).count()).toBe(1)
    expect(await db.bookmarks.where('isRead').equals(UNREAD).count()).toBe(1)
  })

  const okTodo = { isCompleted: NOT_DONE, completedAt: null, dueDate: null, priority: 'MEDIUM' as const, createdAt: now, updatedAt: now }

  it('스크랩 하나에서 할 일을 두 번 만들면 DB 가 거절한다 (FR-041)', async () => {
    db = new TidyDB('tidy-test-2')
    await db.todos.add({ ...okTodo, title: '읽기: A', bookmarkId: BOOKMARK_ID })

    await expect(db.todos.add({ ...okTodo, title: '읽기: A 또', bookmarkId: BOOKMARK_ID })).rejects.toThrow()
  })

  it('스크랩과 잇지 않은 할 일은 여러 개 저장된다', async () => {
    db = new TidyDB('tidy-test-3')

    await db.todos.add({ ...okTodo, title: '일반 1' })
    await db.todos.add({ ...okTodo, title: '일반 2' })

    expect(await db.todos.count()).toBe(2)
  })
})

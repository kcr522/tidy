import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'

const now = '2026-11-10T00:00:00.000Z'
let db: TidyDB

afterEach(async () => {
  await db?.delete()
})

describe('TidyDB', () => {
  it('테이블 3개에 저장하고 읽을 수 있다', async () => {
    db = new TidyDB('tidy-test-1')
    await db.transactions.add({ type: 'EXPENSE', amount: 15000, category: '식비', date: '2026-11-10', memo: '점심', createdAt: now, updatedAt: now })
    await db.todos.add({ title: '장보기', isCompleted: 0, completedAt: null, dueDate: '2026-11-10', priority: 'MEDIUM', createdAt: now, updatedAt: now })
    await db.bookmarks.add({ url: 'https://react.dev/', title: 'React', memo: '', isRead: 0, createdAt: now, updatedAt: now })

    expect(await db.transactions.where('date').equals('2026-11-10').count()).toBe(1)
    expect(await db.todos.where('isCompleted').equals(0).count()).toBe(1)
    expect(await db.bookmarks.where('isRead').equals(0).count()).toBe(1)
  })

  it('스크랩 하나는 할 일 하나로만 전환된다 (FR-041)', async () => {
    db = new TidyDB('tidy-test-2')
    const base = { isCompleted: 0 as const, completedAt: null, dueDate: null, priority: 'MEDIUM' as const, createdAt: now, updatedAt: now }
    await db.todos.add({ ...base, title: '읽기: A', bookmarkId: 1 })
    await expect(db.todos.add({ ...base, title: '읽기: A 또', bookmarkId: 1 })).rejects.toThrow()
    // 스크랩과 연결되지 않은 할 일은 여러 개 저장된다
    await db.todos.add({ ...base, title: '일반 1' })
    await db.todos.add({ ...base, title: '일반 2' })
    expect(await db.todos.count()).toBe(3)
  })
})

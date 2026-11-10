import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Transaction } from '../../src/db/types'
import { todayExpense, usageRate } from '../../src/lib/summary'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { AlreadyConvertedError, createTodoRepo, titleFromBookmark } from '../../src/repositories/todoRepo'

const TODAY = '2026-11-10'
function tx(type: Transaction['type'], amount: number, date: string): Transaction {
  return { type, amount, date, category: '기타', memo: '', createdAt: '', updatedAt: '' }
}

describe('대시보드 계산 (FR-051)', () => {
  it('사용률은 지출 ÷ 수입 × 100 반올림, 수입 0원이면 null', () => {
    expect(usageRate({ income: 2_500_000, expense: 1_234_000 })).toBe(49)
    expect(usageRate({ income: 300_000, expense: 450_000 })).toBe(150)
    expect(usageRate({ income: 0, expense: 10_000 })).toBeNull()
  })

  it('오늘 지출은 오늘 날짜의 지출만 더한다', () => {
    const list = [tx('EXPENSE', 9000, TODAY), tx('EXPENSE', 4500, TODAY), tx('INCOME', 50000, TODAY), tx('EXPENSE', 7000, '2026-11-09')]
    expect(todayExpense(list, TODAY)).toBe(13500)
  })
})

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

describe('스크랩 → 할 일 (US5)', () => {
  it('"읽기: 제목", 중요도 보통, 고른 마감일로 만든다 (FR-040)', async () => {
    db = new TidyDB('convert-1')
    const bookmarks = createBookmarkRepo(db)
    const todos = createTodoRepo(db)
    const bId = await bookmarks.add({ url: 'https://react.dev/', title: 'React 공식 문서', memo: '' })

    const tId = await todos.createFromBookmark(bId, TODAY)
    const todo = await todos.get(tId)
    expect(todo).toMatchObject({ title: '읽기: React 공식 문서', priority: 'MEDIUM', dueDate: TODAY, bookmarkId: bId, isCompleted: 0 })
    expect((await todos.linkedBookmarks()).get(bId)).toBe(tId)
  })

  it('같은 스크랩은 한 번만 전환된다 (FR-041)', async () => {
    db = new TidyDB('convert-2')
    const bookmarks = createBookmarkRepo(db)
    const todos = createTodoRepo(db)
    const bId = await bookmarks.add({ url: 'https://a.com/', title: 'A', memo: '' })
    const first = await todos.createFromBookmark(bId, null)

    await expect(todos.createFromBookmark(bId, TODAY)).rejects.toBeInstanceOf(AlreadyConvertedError)
    expect(await todos.listAll()).toHaveLength(1)
    expect((await todos.listAll())[0].id).toBe(first)
  })

  it('전환한 할 일을 완료하면 스크랩이 읽음이 된다 (FR-042)', async () => {
    db = new TidyDB('convert-3')
    const bookmarks = createBookmarkRepo(db)
    const todos = createTodoRepo(db)
    const bId = await bookmarks.add({ url: 'https://b.com/', title: 'B', memo: '' })
    const tId = await todos.createFromBookmark(bId, TODAY)

    await todos.toggleComplete(tId)
    expect((await bookmarks.get(bId))?.isRead).toBe(1)

    // 완료를 취소해도 스크랩 읽음은 그대로 둔다
    await todos.toggleComplete(tId)
    expect((await todos.get(tId))?.isCompleted).toBe(0)
    expect((await bookmarks.get(bId))?.isRead).toBe(1)
  })

  it('스크랩을 지우면 할 일은 남고 연결만 끊긴다', async () => {
    db = new TidyDB('convert-4')
    const bookmarks = createBookmarkRepo(db)
    const todos = createTodoRepo(db)
    const bId = await bookmarks.add({ url: 'https://c.com/', title: 'C', memo: '' })
    const tId = await todos.createFromBookmark(bId, null)

    await bookmarks.remove(bId)
    const todo = await todos.get(tId)
    expect(todo?.title).toBe('읽기: C')
    expect(todo?.bookmarkId).toBeUndefined()
  })

  it('긴 제목은 100자로 자른다', () => {
    const t = titleFromBookmark('가'.repeat(120))
    expect(t.length).toBe(100)
    expect(t.endsWith('…')).toBe(true)
  })
})

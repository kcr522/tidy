import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Transaction } from '../../src/db/types'
import { todayExpense, usageRate } from '../../src/lib/summary'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { AlreadyConvertedError, createTodoRepo, titleFromBookmark } from '../../src/repositories/todoRepo'

const TODAY = '2026-11-10'
const NO_DUE = null
const NOT_DONE = 0 as const
const READ = 1 as const
const MAX_TITLE = 100

function row(type: Transaction['type'], amount: number, date: string): Transaction {
  return { type, amount, date, category: '기타', memo: '', createdAt: '', updatedAt: '' }
}

describe('대시보드 계산 (FR-051)', () => {
  it.each([
    [2_500_000, 1_234_000, 49],
    [300_000, 450_000, 150],
  ])('수입 %i원 · 지출 %i원이면 사용률은 %i% 다 (반올림)', (income, expense, rate) => {
    expect(usageRate({ income, expense })).toBe(rate)
  })

  it('수입이 0원이면 사용률을 셀 수 없어 null 이다', () => {
    expect(usageRate({ income: 0, expense: 10_000 })).toBeNull()
  })

  it('오늘 지출은 오늘 날짜의 지출만 더한다 (수입 · 어제는 빼고)', () => {
    const list = [row('EXPENSE', 9000, TODAY), row('EXPENSE', 4500, TODAY), row('INCOME', 50000, TODAY), row('EXPENSE', 7000, '2026-11-09')]

    expect(todayExpense(list, TODAY)).toBe(13500)
  })
})

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

/** 새 DB 에 스크랩 하나를 넣고 저장소들을 준다 */
async function withBookmark(name: string, title: string, url: string) {
  db = new TidyDB(name)
  const bookmarks = createBookmarkRepo(db)
  const todos = createTodoRepo(db)
  const bookmarkId = await bookmarks.add({ url, title, memo: '' })
  return { bookmarks, todos, bookmarkId }
}

describe('스크랩 → 할 일 (US5)', () => {
  it('"읽기: 제목", 중요도 보통, 고른 마감일로 할 일을 만들고 스크랩과 잇는다 (FR-040)', async () => {
    const { todos, bookmarkId } = await withBookmark('convert-1', 'React 공식 문서', 'https://react.dev/')

    const todoId = await todos.createFromBookmark(bookmarkId, TODAY)

    expect(await todos.get(todoId)).toMatchObject({ title: '읽기: React 공식 문서', priority: 'MEDIUM', dueDate: TODAY, bookmarkId, isCompleted: NOT_DONE })
    expect((await todos.linkedBookmarks()).get(bookmarkId)).toBe(todoId)
  })

  it('같은 스크랩을 두 번 전환하면 거절하고 할 일은 하나만 남는다 (FR-041)', async () => {
    const { todos, bookmarkId } = await withBookmark('convert-2', 'A', 'https://a.com/')
    const first = await todos.createFromBookmark(bookmarkId, NO_DUE)

    await expect(todos.createFromBookmark(bookmarkId, TODAY)).rejects.toBeInstanceOf(AlreadyConvertedError)

    const all = await todos.listAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(first)
  })

  it('전환한 할 일을 완료하면 스크랩이 읽음이 된다 (FR-042)', async () => {
    const { bookmarks, todos, bookmarkId } = await withBookmark('convert-3', 'B', 'https://b.com/')
    const todoId = await todos.createFromBookmark(bookmarkId, TODAY)

    await todos.toggleComplete(todoId)

    expect((await bookmarks.get(bookmarkId))?.isRead).toBe(READ)
  })

  it('완료를 취소해도 스크랩 읽음은 그대로 둔다', async () => {
    const { bookmarks, todos, bookmarkId } = await withBookmark('convert-3b', 'B', 'https://b.com/')
    const todoId = await todos.createFromBookmark(bookmarkId, TODAY)
    await todos.toggleComplete(todoId)

    await todos.toggleComplete(todoId)

    expect((await todos.get(todoId))?.isCompleted).toBe(NOT_DONE)
    expect((await bookmarks.get(bookmarkId))?.isRead).toBe(READ)
  })

  it('스크랩을 지우면 할 일은 남고 연결만 끊긴다', async () => {
    const { bookmarks, todos, bookmarkId } = await withBookmark('convert-4', 'C', 'https://c.com/')
    const todoId = await todos.createFromBookmark(bookmarkId, NO_DUE)

    await bookmarks.remove(bookmarkId)

    const todo = await todos.get(todoId)
    expect(todo?.title).toBe('읽기: C')
    expect(todo?.bookmarkId).toBeUndefined()
  })

  it('120자 제목은 100자로 자르고 끝에 … 을 붙인다', () => {
    const title = titleFromBookmark('가'.repeat(120))

    expect(title.length).toBe(MAX_TITLE)
    expect(title.endsWith('…')).toBe(true)
  })
})

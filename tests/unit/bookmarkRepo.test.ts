import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

describe('bookmarkRepo', () => {
  it('저장하면 안 읽음, 토글/열기로 읽음 처리 (US3 시나리오 1, 4, 5)', async () => {
    db = new TidyDB('bm-test-1')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://react.dev/learn', title: 'React 성능 최적화 팁', memo: '' })
    expect((await repo.get(id))?.isRead).toBe(0)
    await repo.markRead(id)
    expect((await repo.get(id))?.isRead).toBe(1)
    await repo.toggleRead(id)
    expect((await repo.get(id))?.isRead).toBe(0)
  })

  it('최근 저장 순, 안 읽음 필터 (FR-034, FR-037)', async () => {
    db = new TidyDB('bm-test-2')
    const repo = createBookmarkRepo(db)
    const a = await repo.add({ url: 'https://a.com/', title: 'A', memo: '' })
    await new Promise((r) => setTimeout(r, 5))
    await repo.add({ url: 'https://b.com/', title: 'B', memo: '' })
    await repo.markRead(a)
    expect((await repo.list()).map((b) => b.title)).toEqual(['B', 'A'])
    expect((await repo.list('unread')).map((b) => b.title)).toEqual(['B'])
  })

  it('같은 URL 찾기, 수정 중인 자신은 제외 (FR-033)', async () => {
    db = new TidyDB('bm-test-3')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://react.dev/', title: 'React', memo: '' })
    expect((await repo.findByUrl('https://react.dev/'))?.id).toBe(id)
    expect(await repo.findByUrl('https://react.dev/', id)).toBeUndefined()
    expect(await repo.findByUrl('https://vite.dev/')).toBeUndefined()
  })

  it('삭제해도 전환된 할 일은 남고 연결만 끊긴다 (FR-044)', async () => {
    db = new TidyDB('bm-test-4')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://react.dev/', title: 'React', memo: '' })
    const now = new Date().toISOString()
    const todoId = await db.todos.add({
      title: '읽기: React', isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM', bookmarkId: id, createdAt: now, updatedAt: now,
    })
    await repo.remove(id)
    expect(await repo.get(id)).toBeUndefined()
    const todo = await db.todos.get(todoId)
    expect(todo?.title).toBe('읽기: React')
    expect(todo?.bookmarkId).toBeUndefined()
  })
})

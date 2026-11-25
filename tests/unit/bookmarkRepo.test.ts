import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const UNREAD = 0
const READ = 1
const reactPage = { url: 'https://react.dev/', title: 'React', memo: '' }

describe('bookmarkRepo', () => {
  it('저장하면 안 읽음이고, 열면 읽음, 다시 토글하면 안 읽음이 된다 (US3 시나리오 1, 4, 5)', async () => {
    db = new TidyDB('bm-test-1')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://react.dev/learn', title: 'React 성능 최적화 팁', memo: '' })
    expect((await repo.get(id))?.isRead).toBe(UNREAD)

    await repo.markRead(id)
    expect((await repo.get(id))?.isRead).toBe(READ)

    await repo.toggleRead(id)
    expect((await repo.get(id))?.isRead).toBe(UNREAD)
  })

  it('목록은 최근 저장 순이고, 안 읽음 필터는 읽은 것을 뺀다 (FR-034, FR-037)', async () => {
    db = new TidyDB('bm-test-2')
    const repo = createBookmarkRepo(db)
    const older = await repo.add({ url: 'https://a.com/', title: 'A', memo: '' })
    await new Promise((resolve) => setTimeout(resolve, 5)) // 저장 시각이 달라지게 5ms 띄운다
    await repo.add({ url: 'https://b.com/', title: 'B', memo: '' })

    await repo.markRead(older)

    expect((await repo.list()).map((bookmark) => bookmark.title)).toEqual(['B', 'A'])
    expect((await repo.list('unread')).map((bookmark) => bookmark.title)).toEqual(['B'])
  })

  it('같은 URL 을 찾고, 수정 중인 자기 자신은 빼고 찾는다 (FR-033)', async () => {
    db = new TidyDB('bm-test-3')
    const repo = createBookmarkRepo(db)
    const id = await repo.add(reactPage)

    expect((await repo.findByUrl(reactPage.url))?.id).toBe(id)
    expect(await repo.findByUrl(reactPage.url, id)).toBeUndefined()
    expect(await repo.findByUrl('https://vite.dev/')).toBeUndefined()
  })

  it('스크랩을 지워도 거기서 만든 할 일은 남고 연결만 끊긴다 (FR-044)', async () => {
    db = new TidyDB('bm-test-4')
    const repo = createBookmarkRepo(db)
    const id = await repo.add(reactPage)
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

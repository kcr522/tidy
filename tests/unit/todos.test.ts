import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Todo } from '../../src/db/types'
import { isOverdue, sortTodos, todayProgress, todayTodos } from '../../src/lib/summary'
import { createTodoRepo } from '../../src/repositories/todoRepo'

const TODAY = '2026-11-10'
const YESTERDAY = '2026-11-09'
const NOT_DONE = 0 as const
const DONE = 1 as const

let seq = 0
/** 마감 없는 안 끝낸 보통 할 일 하나에서 필요한 칸만 바꾼다 (만든 순서대로 createdAt 이 늘어난다) */
function okTodo(over: Partial<Todo>): Todo {
  seq += 1
  return {
    id: seq,
    title: `할 일 ${seq}`,
    isCompleted: NOT_DONE,
    completedAt: null,
    dueDate: null,
    priority: 'MEDIUM',
    createdAt: `2026-11-10T00:00:${String(seq).padStart(2, '0')}.000Z`,
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...over,
  }
}
const titlesOf = (list: Todo[]) => list.map((todo) => todo.title)

describe('오늘 할 일 (todayTodos, FR-023)', () => {
  it('오늘 마감 + 기한 지난 미완료만 보이고, 기한 지난 것이 맨 위', () => {
    const list = [
      okTodo({ title: '오늘', dueDate: TODAY }),
      okTodo({ title: '마감 없음' }),
      okTodo({ title: '내일', dueDate: '2026-11-11' }),
      okTodo({ title: '오늘 완료', dueDate: TODAY, isCompleted: DONE }),
      okTodo({ title: '어제 완료', dueDate: YESTERDAY, isCompleted: DONE }),
      okTodo({ title: '어제 미완료', dueDate: YESTERDAY }),
    ]

    expect(titlesOf(todayTodos(list, TODAY))).toEqual(['어제 미완료', '오늘', '오늘 완료'])
  })

  it.each([
    ['어제 마감인데 안 끝낸 일', NOT_DONE, true],
    ['어제 마감이고 끝낸 일', DONE, false],
  ])('%s 은 기한이 지났는가: $2', (_case, isCompleted, overdue) => {
    expect(isOverdue(okTodo({ dueDate: YESTERDAY, isCompleted }), TODAY)).toBe(overdue)
  })

  it('진행률은 오늘 탭에 보이는 것 기준으로 끝낸 수 / 전체 수', () => {
    const list = [
      okTodo({ dueDate: TODAY, isCompleted: DONE }),
      okTodo({ dueDate: TODAY, isCompleted: DONE }),
      okTodo({ dueDate: TODAY, isCompleted: DONE }),
      okTodo({ dueDate: TODAY }),
      okTodo({ dueDate: '2026-11-01' }),
      okTodo({ dueDate: null }),
    ]

    expect(todayProgress(list, TODAY)).toEqual({ done: 3, total: 5 })
  })
})

describe('할 일 정렬 (sortTodos, FR-024)', () => {
  it('미완료 → 완료, 마감일 빠른 순(없으면 뒤), 중요도 높은 순', () => {
    const list = [
      okTodo({ title: '완료', dueDate: '2026-11-01', isCompleted: DONE }),
      okTodo({ title: '마감 없음' }),
      okTodo({ title: '12일 보통', dueDate: '2026-11-12' }),
      okTodo({ title: '12일 높음', dueDate: '2026-11-12', priority: 'HIGH' }),
      okTodo({ title: '11일 낮음', dueDate: '2026-11-11', priority: 'LOW' }),
    ]

    expect(titlesOf(sortTodos(list))).toEqual(['11일 낮음', '12일 높음', '12일 보통', '마감 없음', '완료'])
  })
})

describe('todoRepo', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })
  const okReport = { title: '발표 준비', dueDate: TODAY, priority: 'MEDIUM' as const }
  const okPicture = { name: 'ref.png', type: 'image/png', size: 3, src: 'data:image/png;base64,AAAA' }

  it('메모는 앞뒤 공백을 빼고, 참고 사진과 함께 저장한다', async () => {
    db = new TidyDB('todo-memo-test')
    const repo = createTodoRepo(db)

    const id = await repo.add({ ...okReport, memo: '  3쪽 표 먼저  ', attachments: [okPicture] })

    expect(await repo.get(id)).toMatchObject({ memo: '3쪽 표 먼저', attachments: [okPicture] })
  })

  it('반복 할 일을 끝내면 메모 · 참고 사진이 다음 할 일에도 따라간다', async () => {
    db = new TidyDB('todo-memo-repeat')
    const repo = createTodoRepo(db)
    const id = await repo.add({ ...okReport, memo: '3쪽 표 먼저', attachments: [okPicture], repeat: { every: 'day' } })

    await repo.toggleComplete(id, TODAY)

    const next = (await db.todos.toArray()).find((todo) => todo.id !== id)
    expect(next).toMatchObject({ memo: '3쪽 표 먼저', attachments: [okPicture] })
  })

  it('메모를 공백만 남기고 사진을 다 빼면 둘 다 지운다', async () => {
    db = new TidyDB('todo-memo-clear')
    const repo = createTodoRepo(db)
    const id = await repo.add({ ...okReport, memo: '3쪽 표 먼저', attachments: [okPicture] })

    await repo.update(id, { ...okReport, memo: '   ', attachments: [] })

    const saved = await repo.get(id)
    expect(saved?.memo).toBeUndefined()
    expect(saved?.attachments).toBeUndefined()
  })

  it('완료를 체크하면 끝낸 시각을 남기고, 해제하면 지운다 (US2)', async () => {
    db = new TidyDB('todo-toggle-test')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '주간 업무 보고서 작성', dueDate: TODAY, priority: 'HIGH' })
    expect((await repo.get(id))?.isCompleted).toBe(NOT_DONE)

    await repo.toggleComplete(id)
    expect(await repo.get(id)).toMatchObject({ isCompleted: DONE, completedAt: expect.any(String) })

    await repo.toggleComplete(id)
    expect(await repo.get(id)).toMatchObject({ isCompleted: NOT_DONE, completedAt: null })
  })

  it('수정하면 제목 · 마감일 · 중요도가 바뀌고, 삭제하면 없어진다 (US2)', async () => {
    db = new TidyDB('todo-repo-test')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '주간 업무 보고서 작성', dueDate: TODAY, priority: 'HIGH' })

    await repo.update(id, { title: '보고서', dueDate: null, priority: 'LOW' })
    const updated = await repo.get(id)
    expect([updated?.title, updated?.dueDate, updated?.priority]).toEqual(['보고서', null, 'LOW'])

    await repo.remove(id)
    expect(await repo.get(id)).toBeUndefined()
  })
})

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Todo } from '../../src/db/types'
import { isOverdue, sortTodos, todayProgress, todayTodos } from '../../src/lib/summary'
import { createTodoRepo } from '../../src/repositories/todoRepo'

const TODAY = '2026-11-10'
let seq = 0
function todo(p: Partial<Todo>): Todo {
  seq += 1
  return {
    id: seq,
    title: `할 일 ${seq}`,
    isCompleted: 0,
    completedAt: null,
    dueDate: null,
    priority: 'MEDIUM',
    createdAt: `2026-11-10T00:00:${String(seq).padStart(2, '0')}.000Z`,
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...p,
  }
}

describe('todayTodos (FR-023)', () => {
  it('오늘 마감 + 기한 지난 미완료만, 기한 지난 것이 맨 위', () => {
    const overdue = todo({ title: '어제 미완료', dueDate: '2026-11-09' })
    const overdueDone = todo({ title: '어제 완료', dueDate: '2026-11-09', isCompleted: 1 })
    const today = todo({ title: '오늘', dueDate: TODAY })
    const todayDone = todo({ title: '오늘 완료', dueDate: TODAY, isCompleted: 1 })
    const noDue = todo({ title: '마감 없음' })
    const tomorrow = todo({ title: '내일', dueDate: '2026-11-11' })

    const result = todayTodos([today, noDue, tomorrow, todayDone, overdueDone, overdue], TODAY)
    expect(result.map((t) => t.title)).toEqual(['어제 미완료', '오늘', '오늘 완료'])
    expect(isOverdue(overdue, TODAY)).toBe(true)
    expect(isOverdue(overdueDone, TODAY)).toBe(false)
  })

  it('진행률은 오늘 탭 기준 (완료/전체)', () => {
    const list = [
      todo({ dueDate: TODAY, isCompleted: 1 }),
      todo({ dueDate: TODAY, isCompleted: 1 }),
      todo({ dueDate: TODAY, isCompleted: 1 }),
      todo({ dueDate: TODAY }),
      todo({ dueDate: '2026-11-01' }),
      todo({ dueDate: null }),
    ]
    expect(todayProgress(list, TODAY)).toEqual({ done: 3, total: 5 })
  })
})

describe('sortTodos (FR-024)', () => {
  it('미완료 → 완료, 마감일 빠른 순(없으면 뒤), 중요도 높은 순', () => {
    const list = [
      todo({ title: '완료', dueDate: '2026-11-01', isCompleted: 1 }),
      todo({ title: '마감 없음' }),
      todo({ title: '12일 보통', dueDate: '2026-11-12' }),
      todo({ title: '12일 높음', dueDate: '2026-11-12', priority: 'HIGH' }),
      todo({ title: '11일 낮음', dueDate: '2026-11-11', priority: 'LOW' }),
    ]
    expect(sortTodos(list).map((t) => t.title)).toEqual(['11일 낮음', '12일 높음', '12일 보통', '마감 없음', '완료'])
  })
})

describe('todoRepo', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })

  it('추가, 완료 체크/해제, 수정, 삭제 (US2)', async () => {
    db = new TidyDB('todo-repo-test')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '주간 업무 보고서 작성', dueDate: TODAY, priority: 'HIGH' })
    let t = await repo.get(id)
    expect(t?.isCompleted).toBe(0)

    await repo.toggleComplete(id)
    t = await repo.get(id)
    expect(t?.isCompleted).toBe(1)
    expect(t?.completedAt).not.toBeNull()

    await repo.toggleComplete(id)
    t = await repo.get(id)
    expect(t?.isCompleted).toBe(0)
    expect(t?.completedAt).toBeNull()

    await repo.update(id, { title: '보고서', dueDate: null, priority: 'LOW' })
    t = await repo.get(id)
    expect([t?.title, t?.dueDate, t?.priority]).toEqual(['보고서', null, 'LOW'])

    await repo.remove(id)
    expect(await repo.get(id)).toBeUndefined()
  })
})

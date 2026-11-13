import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Todo } from '../../src/db/types'
import { dayProgress, groupByCategory } from '../../src/lib/calendar'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createTodoCategoryRepo } from '../../src/repositories/todoCategoryRepo'
import { createTodoRepo } from '../../src/repositories/todoRepo'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const d = new TidyDB(name)
  dbs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

let seq = 0
function todo(p: Partial<Todo>): Todo {
  seq += 1
  return { id: seq, title: `할 일 ${seq}`, isCompleted: 0, completedAt: null, dueDate: '2026-11-10', priority: 'MEDIUM', createdAt: '', updatedAt: '', ...p }
}

describe('할 일 캘린더', () => {
  it('날짜마다 할 일 수와 끝낸 수를 센다 (날짜 없는 일은 빼고)', () => {
    const map = dayProgress([todo({}), todo({ isCompleted: 1 }), todo({ dueDate: '2026-11-11', isCompleted: 1 }), todo({ dueDate: null })])
    expect(map.get('2026-11-10')).toEqual({ total: 2, done: 1 })
    expect(map.get('2026-11-11')).toEqual({ total: 1, done: 1 })
    expect(map.size).toBe(2)
  })

  it('카테고리별로 묶고, 카테고리 없는 일은 맨 앞 기본에', () => {
    const cats = [{ id: 1, name: '공부' }, { id: 2, name: '운동' }]
    const a = todo({ categoryId: 1 })
    const b = todo({})
    const c = todo({ categoryId: 99 }) // 지워진 카테고리
    const groups = groupByCategory([a, b, c], cats)
    expect(groups.map((g) => g.category?.name ?? '기본')).toEqual(['기본', '공부', '운동'])
    expect(groups[0].todos).toEqual([b, c])
    expect(groups[1].todos).toEqual([a])
    expect(groups[2].todos).toEqual([])
    // 기본에 할 일이 없으면 기본 묶음은 숨긴다
    expect(groupByCategory([a], cats).map((g) => g.category?.name)).toEqual(['공부', '운동'])
    // 카테고리가 하나도 없으면 기본만
    expect(groupByCategory([], [])).toEqual([{ category: null, todos: [] }])
  })

  it('카테고리를 지우면 그 할 일은 기본으로 (할 일은 남는다)', async () => {
    const d = freshDb('todo-cat-a')
    const cats = createTodoCategoryRepo(d)
    const todos = createTodoRepo(d)
    const id = await cats.add('공부')
    await expect(cats.add(' 공부 ')).rejects.toThrow('이미 있는')
    await expect(cats.add('기본')).rejects.toThrow('쓸 수 없')
    const tId = await todos.add({ title: '단어 외우기', dueDate: '2026-11-10', priority: 'MEDIUM', categoryId: id })
    await cats.remove(id)
    expect(await cats.list()).toEqual([])
    expect((await todos.get(tId))?.categoryId).toBeUndefined()
  })

  it('할 일을 수정해서 기본으로 돌리면 카테고리가 빠진다', async () => {
    const d = freshDb('todo-cat-b')
    const id = await createTodoCategoryRepo(d).add('운동', 'mint')
    const todos = createTodoRepo(d)
    const tId = await todos.add({ title: '달리기', dueDate: null, priority: 'LOW', categoryId: id })
    expect((await todos.get(tId))?.categoryId).toBe(id)
    await todos.update(tId, { title: '달리기', dueDate: null, priority: 'LOW', categoryId: undefined })
    expect((await todos.get(tId))?.categoryId).toBeUndefined()
  })

  it('백업에 카테고리도 들어가고 그대로 돌아온다', async () => {
    const a = freshDb('todo-cat-c')
    const id = await createTodoCategoryRepo(a).add('집안일', 'lemon')
    await createTodoRepo(a).add({ title: '빨래', dueDate: '2026-11-10', priority: 'MEDIUM', categoryId: id })
    const backup = await createBackupRepo(a, '0.1.0').exportAll()
    expect(backup.todoCategories).toHaveLength(1)
    const b = freshDb('todo-cat-d')
    await createBackupRepo(b).importAll(JSON.stringify(backup))
    expect((await createTodoCategoryRepo(b).list())[0]).toMatchObject({ name: '집안일', color: 'lemon' })
    expect((await createTodoRepo(b).listAll())[0].categoryId).toBe(id)
  })
})

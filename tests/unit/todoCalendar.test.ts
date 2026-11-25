import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Todo } from '../../src/db/types'
import { dayProgress, groupByCategory } from '../../src/lib/calendar'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createTodoCategoryRepo } from '../../src/repositories/todoCategoryRepo'
import { createTodoRepo } from '../../src/repositories/todoRepo'

const NOT_DONE = 0 as const
const DONE = 1 as const
const BASIC = '기본'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const db = new TidyDB(name)
  dbs.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

let seq = 0
/** 11월 10일 마감인 안 끝낸 할 일 하나에서 필요한 칸만 바꾼다 */
function okTodo(over: Partial<Todo>): Todo {
  seq += 1
  return { id: seq, title: `할 일 ${seq}`, isCompleted: NOT_DONE, completedAt: null, dueDate: '2026-11-10', priority: 'MEDIUM', createdAt: '', updatedAt: '', ...over }
}

describe('할 일 캘린더', () => {
  it('날짜마다 할 일 수와 끝낸 수를 세고, 날짜 없는 일은 뺀다', () => {
    const list = [okTodo({}), okTodo({ isCompleted: DONE }), okTodo({ dueDate: '2026-11-11', isCompleted: DONE }), okTodo({ dueDate: null })]

    const byDay = dayProgress(list)

    expect(byDay.get('2026-11-10')).toEqual({ total: 2, done: 1 })
    expect(byDay.get('2026-11-11')).toEqual({ total: 1, done: 1 })
    expect(byDay.size).toBe(2)
  })

  it('카테고리별로 묶고, 카테고리 없는 일 · 지워진 카테고리의 일은 맨 앞 기본에 둔다', () => {
    const categories = [{ id: 1, name: '공부' }, { id: 2, name: '운동' }]
    const study = okTodo({ categoryId: 1 })
    const plain = okTodo({})
    const deletedCategory = okTodo({ categoryId: 99 })

    const groups = groupByCategory([study, plain, deletedCategory], categories)

    expect(groups.map((group) => group.category?.name ?? BASIC)).toEqual([BASIC, '공부', '운동'])
    expect(groups.map((group) => group.todos)).toEqual([[plain, deletedCategory], [study], []])
  })

  it('기본에 할 일이 없으면 기본 묶음은 숨긴다', () => {
    const categories = [{ id: 1, name: '공부' }, { id: 2, name: '운동' }]

    expect(groupByCategory([okTodo({ categoryId: 1 })], categories).map((group) => group.category?.name)).toEqual(['공부', '운동'])
  })

  it('카테고리가 하나도 없으면 빈 기본 묶음만 둔다', () => {
    expect(groupByCategory([], [])).toEqual([{ category: null, todos: [] }])
  })

  it.each([
    ['앞뒤 공백만 다른 같은 이름', ' 공부 ', '이미 있는'],
    ['기본', BASIC, '쓸 수 없'],
  ])('%s 으로는 카테고리를 만들지 않는다', async (_case, name, message) => {
    const categories = createTodoCategoryRepo(freshDb('todo-cat-name'))
    await categories.add('공부')

    await expect(categories.add(name)).rejects.toThrow(message)
  })

  it('카테고리를 지우면 그 할 일은 지우지 않고 기본으로 옮긴다', async () => {
    const db = freshDb('todo-cat-a')
    const categories = createTodoCategoryRepo(db)
    const todos = createTodoRepo(db)
    const categoryId = await categories.add('공부')
    const todoId = await todos.add({ title: '단어 외우기', dueDate: '2026-11-10', priority: 'MEDIUM', categoryId })

    await categories.remove(categoryId)

    expect(await categories.list()).toEqual([])
    expect((await todos.get(todoId))?.categoryId).toBeUndefined()
  })

  it('할 일을 수정해서 기본으로 돌리면 카테고리가 빠진다', async () => {
    const db = freshDb('todo-cat-b')
    const categoryId = await createTodoCategoryRepo(db).add('운동', 'mint')
    const todos = createTodoRepo(db)
    const okRun = { title: '달리기', dueDate: null, priority: 'LOW' as const }
    const todoId = await todos.add({ ...okRun, categoryId })
    expect((await todos.get(todoId))?.categoryId).toBe(categoryId)

    await todos.update(todoId, { ...okRun, categoryId: undefined })

    expect((await todos.get(todoId))?.categoryId).toBeUndefined()
  })

  it('백업에 할 일 카테고리도 들어가고 다른 기기에서 그대로 돌아온다', async () => {
    const from = freshDb('todo-cat-c')
    const categoryId = await createTodoCategoryRepo(from).add('집안일', 'lemon')
    await createTodoRepo(from).add({ title: '빨래', dueDate: '2026-11-10', priority: 'MEDIUM', categoryId })
    const backup = await createBackupRepo(from, '0.1.0').exportAll()
    expect(backup.todoCategories).toHaveLength(1)

    const to = freshDb('todo-cat-d')
    await createBackupRepo(to).importAll(JSON.stringify(backup))

    expect((await createTodoCategoryRepo(to).list())[0]).toMatchObject({ name: '집안일', color: 'lemon' })
    expect((await createTodoRepo(to).listAll())[0].categoryId).toBe(categoryId)
  })
})

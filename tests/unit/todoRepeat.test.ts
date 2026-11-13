import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { isTodoRepeat, nextDueDate, repeatLabel } from '../../src/lib/todoRepeat'
import { createBackupRepo } from '../../src/repositories/backupRepo'
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

describe('nextDueDate', () => {
  it('매일: 다음 날', () => {
    expect(nextDueDate({ every: 'day' }, '2026-11-11', '2026-11-11')).toBe('2026-11-12')
  })
  it('매주 월·수·금 (2026-11-11은 수요일)', () => {
    const r = { every: 'week' as const, days: [1, 3, 5] }
    expect(nextDueDate(r, '2026-11-11', '2026-11-11')).toBe('2026-11-13')
    expect(nextDueDate(r, '2026-11-13', '2026-11-11')).toBe('2026-11-16')
  })
  it('매달 31일은 짧은 달에 말일', () => {
    const r = { every: 'month' as const, day: 31 }
    expect(nextDueDate(r, '2026-10-31', '2026-10-31')).toBe('2026-11-30')
    expect(nextDueDate(r, '2026-11-30', '2026-11-30')).toBe('2026-12-31')
    expect(nextDueDate(r, '2027-01-31', '2027-01-31')).toBe('2027-02-28')
  })
  it('밀린 걸 늦게 끝내면 지난 날짜가 아니라 오늘부터', () => {
    expect(nextDueDate({ every: 'day' }, '2026-11-01', '2026-11-11')).toBe('2026-11-11')
    expect(nextDueDate({ every: 'week', days: [1] }, '2026-11-02', '2026-11-11')).toBe('2026-11-16')
  })
  it('미리 끝내면 그다음 날짜', () => {
    expect(nextDueDate({ every: 'day' }, '2026-11-15', '2026-11-11')).toBe('2026-11-16')
  })
})

describe('repeatLabel', () => {
  it('보기 좋은 이름', () => {
    expect(repeatLabel({ every: 'day' })).toBe('매일')
    expect(repeatLabel({ every: 'week', days: [5, 1, 3] })).toBe('매주 월·수·금')
    expect(repeatLabel({ every: 'week', days: [1, 2, 3, 4, 5] })).toBe('평일')
    expect(repeatLabel({ every: 'week', days: [0, 6] })).toBe('주말')
    expect(repeatLabel({ every: 'month', day: 25 })).toBe('매달 25일')
  })
  it('백업 검사', () => {
    expect(isTodoRepeat({ every: 'week', days: [1] })).toBe(true)
    expect(isTodoRepeat({ every: 'week', days: [] })).toBe(false)
    expect(isTodoRepeat({ every: 'month', day: 32 })).toBe(false)
    expect(isTodoRepeat('매일')).toBe(false)
  })
})

describe('반복 할 일 완료', () => {
  it('끝내면 다음 할 일이 생기고, 반복은 새 할 일로 넘어간다', async () => {
    const db = freshDb('repeat-1')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '물 2L', dueDate: '2026-11-11', priority: 'HIGH', remindAt: '09:00', repeat: { every: 'day' } })
    expect(await repo.toggleComplete(id, '2026-11-11')).toBe('2026-11-12')
    const all = await repo.listAll()
    expect(all).toHaveLength(2)
    const [done, next] = all
    expect(done).toMatchObject({ isCompleted: 1, repeatNextId: next.id })
    expect(done.repeat).toBeUndefined()
    expect(next).toMatchObject({ title: '물 2L', dueDate: '2026-11-12', priority: 'HIGH', remindAt: '09:00', repeat: { every: 'day' }, isCompleted: 0 })
  })

  it('완료를 되돌리면 새로 생긴 할 일을 지우고 반복을 되돌린다', async () => {
    const db = freshDb('repeat-2')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '운동', dueDate: '2026-11-11', priority: 'MEDIUM', repeat: { every: 'week', days: [3] } })
    await repo.toggleComplete(id, '2026-11-11')
    expect(await repo.toggleComplete(id, '2026-11-11')).toBeUndefined()
    const all = await repo.listAll()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ isCompleted: 0, repeat: { every: 'week', days: [3] } })
    expect(all[0].repeatNextId).toBeUndefined()
  })

  it('다음 할 일까지 끝냈으면 되돌려도 그대로 둔다', async () => {
    const db = freshDb('repeat-3')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '일기', dueDate: '2026-11-11', priority: 'LOW', repeat: { every: 'day' } })
    await repo.toggleComplete(id, '2026-11-11')
    const nextId = (await repo.get(id))!.repeatNextId!
    await repo.toggleComplete(nextId, '2026-11-12')
    await repo.toggleComplete(id, '2026-11-12')
    const all = await repo.listAll()
    expect(all).toHaveLength(3)
    expect((await repo.get(id))!.repeat).toBeUndefined()
  })

  it('마감일이 없으면 반복하지 않는다', async () => {
    const db = freshDb('repeat-4')
    const repo = createTodoRepo(db)
    const id = await repo.add({ title: '언젠가', dueDate: null, priority: 'LOW', repeat: { every: 'day' } })
    expect(await repo.toggleComplete(id)).toBeUndefined()
    expect(await repo.listAll()).toHaveLength(1)
  })

  it('백업에 넣고 다시 가져와도 반복이 남는다', async () => {
    const db = freshDb('repeat-5')
    const repo = createTodoRepo(db)
    await repo.add({ title: '월세', dueDate: '2026-11-25', priority: 'HIGH', repeat: { every: 'month', day: 25 } })
    const backup = createBackupRepo(db)
    const json = JSON.stringify(await backup.exportAll())
    await backup.importAll(json)
    expect((await repo.listAll())[0].repeat).toEqual({ every: 'month', day: 25 })
  })
})

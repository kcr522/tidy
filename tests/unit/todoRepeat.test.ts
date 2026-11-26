import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { isTodoRepeat, nextDueDate, repeatLabel } from '../../src/lib/todoRepeat'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createTodoRepo } from '../../src/repositories/todoRepo'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const db = new TidyDB(name)
  dbs.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

const NOT_DONE = 0 as const
const DONE = 1 as const
const NO_NEXT = undefined
// 2026-11-11 은 수요일
const WEDNESDAY = '2026-11-11'
const [SUN, MON, TUE, WED, THU, FRI, SAT] = [0, 1, 2, 3, 4, 5, 6]

describe('다음 마감일 (nextDueDate)', () => {
  const monWedFri = { every: 'week' as const, days: [MON, WED, FRI] }
  const on31st = { every: 'month' as const, day: 31 }

  it.each([
    ['매일: 다음 날', { every: 'day' as const }, WEDNESDAY, WEDNESDAY, '2026-11-12'],
    ['매주 월·수·금: 수요일 다음은 금요일', monWedFri, WEDNESDAY, WEDNESDAY, '2026-11-13'],
    ['매주 월·수·금: 금요일 다음은 월요일', monWedFri, '2026-11-13', WEDNESDAY, '2026-11-16'],
    ['매달 31일: 30일까지인 달은 말일', on31st, '2026-10-31', '2026-10-31', '2026-11-30'],
    ['매달 31일: 31일이 있는 달은 31일', on31st, '2026-11-30', '2026-11-30', '2026-12-31'],
    ['매달 31일: 2월은 28일', on31st, '2027-01-31', '2027-01-31', '2027-02-28'],
    ['밀린 매일 할 일을 늦게 끝내면 지난 날짜가 아니라 오늘', { every: 'day' as const }, '2026-11-01', WEDNESDAY, WEDNESDAY],
    ['밀린 매주 월요일 할 일을 늦게 끝내면 오늘 뒤 첫 월요일', { every: 'week' as const, days: [MON] }, '2026-11-02', WEDNESDAY, '2026-11-16'],
    ['미리 끝내면 마감일 그다음 날', { every: 'day' as const }, '2026-11-15', WEDNESDAY, '2026-11-16'],
  ])('%s', (_case, repeat, dueDate, today, next) => {
    expect(nextDueDate(repeat, dueDate, today)).toBe(next)
  })
})

describe('반복 이름 · 검사', () => {
  it.each([
    [{ every: 'day' as const }, '매일'],
    [{ every: 'week' as const, days: [FRI, MON, WED] }, '매주 월·수·금'],
    [{ every: 'week' as const, days: [MON, TUE, WED, THU, FRI] }, '평일'],
    [{ every: 'week' as const, days: [SUN, SAT] }, '주말'],
    [{ every: 'month' as const, day: 25 }, '매달 25일'],
  ])('반복 %j 은 "%s" 로 보여 준다', (repeat, label) => {
    expect(repeatLabel(repeat)).toBe(label)
  })

  it.each([
    ['요일이 하나라도 있는 매주', { every: 'week', days: [MON] }, true],
    ['요일이 없는 매주', { every: 'week', days: [] }, false],
    ['32일인 매달', { every: 'month', day: 32 }, false],
    ['글자', '매일', false],
  ])('백업의 반복 값이 %s 이면 올바른가: $2', (_case, value, isOk) => {
    expect(isTodoRepeat(value)).toBe(isOk)
  })
})

describe('반복 할 일 완료', () => {
  it('끝내면 같은 내용의 다음 할 일이 생기고, 반복은 새 할 일로 넘어간다', async () => {
    const repo = createTodoRepo(freshDb('repeat-1'))
    const id = await repo.add({ title: '물 2L', dueDate: WEDNESDAY, priority: 'HIGH', remindAt: '09:00', repeat: { every: 'day' } })

    const nextDue = await repo.toggleComplete(id, WEDNESDAY)

    expect(nextDue).toBe('2026-11-12')
    const [done, next, ...rest] = await repo.listAll()
    expect(rest).toEqual([])
    expect(done).toMatchObject({ isCompleted: DONE, repeatNextId: next.id })
    expect(done.repeat).toBeUndefined()
    expect(next).toMatchObject({ title: '물 2L', dueDate: '2026-11-12', priority: 'HIGH', remindAt: '09:00', repeat: { every: 'day' }, isCompleted: NOT_DONE })
  })

  it('완료를 되돌리면 새로 생긴 할 일을 지우고 반복을 되돌린다', async () => {
    const repo = createTodoRepo(freshDb('repeat-2'))
    const everyWednesday = { every: 'week' as const, days: [WED] }
    const id = await repo.add({ title: '운동', dueDate: WEDNESDAY, priority: 'MEDIUM', repeat: everyWednesday })
    await repo.toggleComplete(id, WEDNESDAY)

    const nextDue = await repo.toggleComplete(id, WEDNESDAY)

    expect(nextDue).toBe(NO_NEXT)
    const all = await repo.listAll()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ isCompleted: NOT_DONE, repeat: everyWednesday })
    expect(all[0].repeatNextId).toBeUndefined()
  })

  it('다음 할 일까지 끝냈으면 앞 할 일의 완료를 되돌려도 다음 할 일들은 그대로 둔다', async () => {
    const repo = createTodoRepo(freshDb('repeat-3'))
    const id = await repo.add({ title: '일기', dueDate: WEDNESDAY, priority: 'LOW', repeat: { every: 'day' } })
    await repo.toggleComplete(id, WEDNESDAY)
    const nextId = (await repo.get(id))!.repeatNextId!
    await repo.toggleComplete(nextId, '2026-11-12')

    await repo.toggleComplete(id, '2026-11-12')

    expect(await repo.listAll()).toHaveLength(3)
    expect((await repo.get(id))!.repeat).toBeUndefined()
  })

  it('마감일이 없으면 끝내도 반복하지 않는다', async () => {
    const repo = createTodoRepo(freshDb('repeat-4'))
    const id = await repo.add({ title: '언젠가', dueDate: null, priority: 'LOW', repeat: { every: 'day' } })

    const nextDue = await repo.toggleComplete(id)

    expect(nextDue).toBe(NO_NEXT)
    expect(await repo.listAll()).toHaveLength(1)
  })

  it('백업에 넣고 다시 가져와도 반복이 남는다', async () => {
    const db = freshDb('repeat-5')
    const repo = createTodoRepo(db)
    const on25th = { every: 'month' as const, day: 25 }
    await repo.add({ title: '월세', dueDate: '2026-11-25', priority: 'HIGH', repeat: on25th })
    const backup = createBackupRepo(db)

    await backup.importAll(JSON.stringify(await backup.exportAll()))

    expect((await repo.listAll())[0].repeat).toEqual(on25th)
  })
})

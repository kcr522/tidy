import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { CalendarEvent, EventColor, Todo } from '../../src/db/types'
import { monthGrid } from '../../src/lib/calendar'
import { eventDays, layoutWeeks } from '../../src/lib/eventLayout'
import { laterTodos, todayTodos } from '../../src/lib/summary'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'
import { createEventRepo } from '../../src/repositories/eventRepo'

const event = (id: number, startDate: string, endDate: string, title = `일정${id}`): CalendarEvent => ({
  id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '',
})
const okTodo = (over: Partial<Todo>): Todo => ({
  id: 1, title: '장보기', isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...over,
})
const MAX_LANES = 3

describe('캘린더 일정 막대', () => {
  const grid = monthGrid('2026-11') // 11/1(일) ~ 12/5(토), 5주

  it('여러 주에 걸친 일정은 주마다 잘라서 이어 그린다', () => {
    const weeks = layoutWeeks(grid, [event(1, '2026-11-05', '2026-11-17')], [], MAX_LANES)

    const bars = weeks.map((week) => week.bars.find((bar) => bar.event?.id === 1))

    expect(bars[0]).toMatchObject({ col: 4, span: 3, fromPrev: false, toNext: true })
    expect(bars[1]).toMatchObject({ col: 0, span: 7, fromPrev: true, toNext: true })
    expect(bars[2]).toMatchObject({ col: 0, span: 3, fromPrev: true, toNext: false })
    expect(bars[3]).toBeUndefined()
  })

  it('긴 일정이 위 줄, 겹치면 다음 줄에 놓고, 줄이 모자라면 넘친 수를 센다', () => {
    const events = [event(1, '2026-11-02', '2026-11-02'), event(2, '2026-11-01', '2026-11-07'), event(3, '2026-11-02', '2026-11-03'), event(4, '2026-11-02', '2026-11-02')]

    const [week] = layoutWeeks(grid, events, [okTodo({ dueDate: '2026-11-02' })], MAX_LANES)

    const laneOf = (id: number) => week.bars.find((bar) => bar.event?.id === id)?.lane
    expect(laneOf(2)).toBe(0)
    expect(laneOf(3)).toBe(1)
    expect(week.bars).toHaveLength(MAX_LANES)
    expect(week.hidden[1]).toBe(2) // 하루짜리 일정 1개 + 할 일 1개가 넘침
  })

  it('할 일은 마감일 칸에 하루짜리 막대로 들어간다', () => {
    const [week] = layoutWeeks(grid, [], [okTodo({ dueDate: '2026-11-04', title: '열차 예매' })], MAX_LANES)

    expect(week.bars[0]).toMatchObject({ kind: 'todo', col: 3, span: 1, title: '열차 예매' })
  })

  it('달을 넘는 기간도 시작 · 끝 날을 넣어 일수를 센다', () => {
    expect(eventDays({ startDate: '2026-11-28', endDate: '2026-12-02' })).toBe(5)
  })
})

describe('할 일 오늘 / 나중', () => {
  const today = '2026-11-10'
  const list = [
    okTodo({ id: 1, dueDate: today }),
    okTodo({ id: 2, dueDate: '2026-11-20' }),
    okTodo({ id: 3, dueDate: null }),
    okTodo({ id: 4, dueDate: '2026-11-01' }),
  ]

  it('오늘 할 일에는 오늘 마감과 밀린 할 일이 밀린 것부터 들어간다', () => {
    expect(todayTodos(list, today).map((todo) => todo.id)).toEqual([4, 1])
  })

  it('나중 할 일에는 내일 이후와 날짜 없는 할 일이 들어간다', () => {
    expect(laterTodos(list, today).map((todo) => todo.id)).toEqual([2, 3])
  })
})

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

function freshDb(name: string) {
  const db = new TidyDB(name)
  dbs.push(db)
  return db
}

describe('일정과 일기 저장', () => {
  it('보이는 기간과 겹치는 일정만 가져온다', async () => {
    const repo = createEventRepo(freshDb('events-a'))
    await repo.add({ title: '등록금', startDate: '2026-11-24', endDate: '2026-11-28', color: 'red', memo: '' })
    await repo.add({ title: '지난달', startDate: '2026-10-01', endDate: '2026-10-03', color: 'blue', memo: '' })

    const visible = await repo.listBetween('2026-11-01', '2026-12-05')

    expect(visible.map((item) => item.title)).toEqual(['등록금'])
  })

  it('끝 날짜가 시작보다 앞이면 둘을 바꿔 저장한다', async () => {
    const repo = createEventRepo(freshDb('events-b'))

    await repo.add({ title: '거꾸로', startDate: '2026-12-03', endDate: '2026-11-30', color: 'green', memo: '' })

    const [saved] = await repo.listBetween('2026-11-01', '2026-12-05')
    expect(saved).toMatchObject({ startDate: '2026-11-30', endDate: '2026-12-03' })
  })

  it('일기는 하루 하나이고, 고쳐도 색은 처음 정한 그대로다', async () => {
    const db = freshDb('diary-a')
    const repo = createDiaryRepo(db, () => 0)
    await repo.save('2026-11-10', { text: '첫 일기' })
    const first = await repo.get('2026-11-10')
    const otherColorPick = () => 0.99

    await createDiaryRepo(db, otherColorPick).save('2026-11-10', { text: '고친 일기', photo: 'data:image/jpeg;base64,AA' })

    expect(await repo.get('2026-11-10')).toMatchObject({ text: '고친 일기', photo: 'data:image/jpeg;base64,AA', color: first!.color })
  })

  it('일기와 일정은 백업에 들어가 다시 가져올 수 있다', async () => {
    const source = freshDb('diary-b')
    const target = freshDb('diary-c')
    await createDiaryRepo(source, () => 0).save('2026-11-10', { text: '고친 일기' })
    await createEventRepo(source).add({ title: '여행', startDate: '2026-11-11', endDate: '2026-11-12', color: 'blue', memo: '' })

    const backup = await createBackupRepo(source, '0.1.0').exportAll()
    await createBackupRepo(target, '0.1.0').importAll(JSON.stringify(backup))

    expect(backup.diaries).toHaveLength(1)
    expect(backup.events).toHaveLength(1)
    expect(await createDiaryRepo(target).get('2026-11-10')).toMatchObject({ text: '고친 일기' })
  })
})

describe('가계부 달력', () => {
  it('날짜별 수입 · 지출 합계를 낸다', async () => {
    const { dailyTotals } = await import('../../src/lib/calendar')
    const row = (type: 'INCOME' | 'EXPENSE', amount: number, date: string) => ({ type, amount, date, category: '', memo: '', createdAt: '', updatedAt: '' })

    const totals = dailyTotals([row('EXPENSE', 9000, '2026-11-10'), row('EXPENSE', 1000, '2026-11-10'), row('INCOME', 2500000, '2026-11-10'), row('EXPENSE', 5000, '2026-11-11')])

    expect(totals.get('2026-11-10')).toEqual({ income: 2500000, expense: 10000, saving: 0 })
    expect(totals.get('2026-11-11')).toEqual({ income: 0, expense: 5000, saving: 0 })
  })

  it.each([
    [45000, '45,000'],
    [2500000, '250만'],
    [1449053, '144.9만'],
    [403223, '40.3만'],
  ])('%i원은 짧게 "%s" 로 보여 준다', async (won, label) => {
    const { shortWon } = await import('../../src/lib/calendar')

    expect(shortWon(won)).toBe(label)
  })

  it.each([
    [9800, '9,800'],
    [26987, '2.7만'],
    [30000, '3만'],
    [265720, '27만'],
    [1449053, '145만'],
    [12_345_678, '1235만'],
    [150_000_000, '1.5억'],
  ])('달력 칸에는 %i원을 "%s" 로 보여 준다', async (won, label) => {
    const { cellWon } = await import('../../src/lib/calendar')

    expect(cellWon(won)).toBe(label)
  })

  const MAX_CELL_CHARS = 5
  it.each([1, 9999, 99999, 999999, 9_999_999, 99_999_999, 999_999_999])('달력 칸 금액 %i원은 5글자를 넘지 않는다 (칸을 넘지 않게)', async (won) => {
    const { cellWon } = await import('../../src/lib/calendar')

    expect(cellWon(won).length).toBeLessThanOrEqual(MAX_CELL_CHARS)
  })
})

describe('공휴일과 색', () => {
  it('공휴일은 그날 맨 위 줄에 들어가고, 일정은 그 아래 줄로 간다', async () => {
    const { holidaysBetween } = await import('../../src/lib/holidays')
    const october = monthGrid('2026-10')
    const holidays = holidaysBetween(october[0], october[october.length - 1])

    const weeks = layoutWeeks(october, [event(1, '2026-10-03', '2026-10-04')], [], 4, holidays)

    const bars = weeks[0].bars
    expect(bars.find((bar) => bar.kind === 'holiday')).toMatchObject({ title: '개천절', lane: 0, col: 6 })
    expect(bars.find((bar) => bar.kind === 'event')).toMatchObject({ lane: 1 })
    expect(weeks[0].lanes).toBe(2)
  })

  it.each([
    ['이름 있는 색', 'mint', true],
    ['#rrggbb 색', '#12ab34', true],
    ['한 자리 모자란 색', '#12ab3', false],
  ])('일정 색으로 %s(%s)을 쓸 수 있는가: %s', async (_case, color, isOk) => {
    const { isEventColor } = await import('../../src/lib/eventLayout')

    expect(isEventColor(color)).toBe(isOk)
  })

  it('직접 고른 색은 바탕색으로 그대로 쓴다', async () => {
    const { eventBg } = await import('../../src/lib/eventLayout')

    expect(eventBg('#12ab34')).toBe('#12ab34')
  })

  it.each([
    ['yellow', '#191f28'],
    ['navy', '#ffffff'],
  ])('%s 바탕에는 읽히는 %s 글씨를 쓴다 (밝은 색은 진한 글씨)', async (color, textColor) => {
    const { eventFg } = await import('../../src/lib/eventLayout')

    expect(eventFg(color as EventColor)).toBe(textColor)
  })
})

describe('스티커', () => {
  it('스티커는 하루에 하나라서 다시 붙이면 바뀌고, null 이면 떼어진다', async () => {
    const { createStickerRepo } = await import('../../src/repositories/stickerRepo')
    const repo = createStickerRepo(freshDb('sticker-a'))
    await repo.set('2026-10-14', '🔥')
    await repo.set('2026-10-20', '🎂')

    await repo.set('2026-10-14', '⭐')
    await repo.set('2026-10-20', null)

    expect((await repo.listBetween('2026-10-01', '2026-10-31')).map((sticker) => sticker.emoji)).toEqual(['⭐'])
  })

  it('스티커는 백업에 들어가 다시 가져올 수 있다', async () => {
    const { createStickerRepo } = await import('../../src/repositories/stickerRepo')
    const source = freshDb('sticker-b')
    const target = freshDb('sticker-c')
    await createStickerRepo(source).set('2026-10-14', '⭐')

    const backup = await createBackupRepo(source, '0.1.0').exportAll()
    await createBackupRepo(target, '0.1.0').importAll(JSON.stringify(backup))

    expect(await target.stickers.toArray()).toMatchObject([{ date: '2026-10-14', emoji: '⭐' }])
  })
})

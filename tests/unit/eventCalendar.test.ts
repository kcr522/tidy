import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { CalendarEvent, Todo } from '../../src/db/types'
import { monthGrid } from '../../src/lib/calendar'
import { eventDays, layoutWeeks } from '../../src/lib/eventLayout'
import { laterTodos, todayTodos } from '../../src/lib/summary'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createDiaryRepo } from '../../src/repositories/diaryRepo'
import { createEventRepo } from '../../src/repositories/eventRepo'

const ev = (id: number, startDate: string, endDate: string, title = `e${id}`): CalendarEvent => ({
  id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '',
})
const todo = (over: Partial<Todo>): Todo => ({
  id: 1, title: 't', isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...over,
})

describe('캘린더 일정 막대', () => {
  const grid = monthGrid('2026-11') // 11/1(일) ~ 12/5(토), 5주

  it('여러 주에 걸친 일정은 주마다 잘라서 이어 그린다', () => {
    const weeks = layoutWeeks(grid, [ev(1, '2026-11-05', '2026-11-17')], [], 3)
    const bars = weeks.map((w) => w.bars.find((b) => b.event?.id === 1))
    expect(bars[0]).toMatchObject({ col: 4, span: 3, fromPrev: false, toNext: true })
    expect(bars[1]).toMatchObject({ col: 0, span: 7, fromPrev: true, toNext: true })
    expect(bars[2]).toMatchObject({ col: 0, span: 3, fromPrev: true, toNext: false })
    expect(bars[3]).toBeUndefined()
  })

  it('긴 일정이 위 줄, 겹치면 다음 줄, 넘치면 +n으로 센다', () => {
    const events = [ev(1, '2026-11-02', '2026-11-02'), ev(2, '2026-11-01', '2026-11-07'), ev(3, '2026-11-02', '2026-11-03'), ev(4, '2026-11-02', '2026-11-02')]
    const [w] = layoutWeeks(grid, events, [todo({ dueDate: '2026-11-02' })], 3)
    const lane = (id: number) => w.bars.find((b) => b.event?.id === id)?.lane
    expect(lane(2)).toBe(0)
    expect(lane(3)).toBe(1)
    expect(w.bars).toHaveLength(3)
    expect(w.hidden[1]).toBe(2) // 하루짜리 일정 1개 + 할 일 1개가 넘침
  })

  it('할 일은 마감일 칸에 하루짜리로 들어간다', () => {
    const [w] = layoutWeeks(grid, [], [todo({ dueDate: '2026-11-04', title: '열차 예매' })], 3)
    expect(w.bars[0]).toMatchObject({ kind: 'todo', col: 3, span: 1, title: '열차 예매' })
  })

  it('기간 일수', () => {
    expect(eventDays({ startDate: '2026-11-28', endDate: '2026-12-02' })).toBe(5)
  })
})

describe('할 일 오늘 / 나중', () => {
  const today = '2026-11-10'
  const list = [
    todo({ id: 1, dueDate: today }),
    todo({ id: 2, dueDate: '2026-11-20' }),
    todo({ id: 3, dueDate: null }),
    todo({ id: 4, dueDate: '2026-11-01' }),
  ]
  it('오늘 날짜(+밀린 것)는 오늘, 내일 이후·날짜 없음은 나중', () => {
    expect(todayTodos(list, today).map((t) => t.id)).toEqual([4, 1])
    expect(laterTodos(list, today).map((t) => t.id)).toEqual([2, 3])
  })
})

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('일정과 일기 저장', () => {
  it('보이는 기간과 겹치는 일정만 가져오고, 끝이 앞이면 바꿔 저장', async () => {
    const d = new TidyDB('events-a')
    dbs.push(d)
    const repo = createEventRepo(d)
    await repo.add({ title: '등록금', startDate: '2026-11-24', endDate: '2026-11-28', color: 'red', memo: '' })
    await repo.add({ title: '지난달', startDate: '2026-10-01', endDate: '2026-10-03', color: 'blue', memo: '' })
    await repo.add({ title: '거꾸로', startDate: '2026-12-03', endDate: '2026-11-30', color: 'green', memo: '' })
    const got = await repo.listBetween('2026-11-01', '2026-12-05')
    expect(got.map((e) => e.title).sort()).toEqual(['거꾸로', '등록금'])
    expect(got.find((e) => e.title === '거꾸로')).toMatchObject({ startDate: '2026-11-30', endDate: '2026-12-03' })
  })

  it('일기는 하루 하나, 색은 처음 정한 그대로, 백업에도 들어간다', async () => {
    const d = new TidyDB('diary-a')
    dbs.push(d)
    const repo = createDiaryRepo(d, () => 0)
    await repo.save('2026-11-10', { text: '첫 일기' })
    const first = await repo.get('2026-11-10')
    await createDiaryRepo(d, () => 0.99).save('2026-11-10', { text: '고친 일기', photo: 'data:image/jpeg;base64,AA' })
    const after = await repo.get('2026-11-10')
    expect(after).toMatchObject({ text: '고친 일기', photo: 'data:image/jpeg;base64,AA', color: first!.color })

    await createEventRepo(d).add({ title: '여행', startDate: '2026-11-11', endDate: '2026-11-12', color: 'blue', memo: '' })
    const backup = await createBackupRepo(d, '0.1.0').exportAll()
    expect(backup.diaries).toHaveLength(1)
    expect(backup.events).toHaveLength(1)

    const b = new TidyDB('diary-b')
    dbs.push(b)
    await createBackupRepo(b, '0.1.0').importAll(JSON.stringify(backup))
    expect(await createDiaryRepo(b).get('2026-11-10')).toMatchObject({ text: '고친 일기' })
  })
})

describe('가계부 달력', () => {
  it('날짜별 수입·지출 합계와 짧은 금액', async () => {
    const { dailyTotals, shortWon } = await import('../../src/lib/calendar')
    const tx = (type: 'INCOME' | 'EXPENSE', amount: number, date: string) => ({ type, amount, date, category: '', memo: '', createdAt: '', updatedAt: '' })
    const m = dailyTotals([tx('EXPENSE', 9000, '2026-11-10'), tx('EXPENSE', 1000, '2026-11-10'), tx('INCOME', 2500000, '2026-11-10'), tx('EXPENSE', 5000, '2026-11-11')])
    expect(m.get('2026-11-10')).toEqual({ income: 2500000, expense: 10000, saving: 0 })
    expect(m.get('2026-11-11')).toEqual({ income: 0, expense: 5000, saving: 0 })
    expect(shortWon(45000)).toBe('45,000')
    expect(shortWon(2500000)).toBe('250만')
    expect(shortWon(1449053)).toBe('144.9만')
    expect(shortWon(403223)).toBe('40.3만')
  })

  it('달력 칸 금액은 짧게 (칸을 넘지 않게)', async () => {
    const { cellWon } = await import('../../src/lib/calendar')
    expect(cellWon(9800)).toBe('9,800')
    expect(cellWon(26987)).toBe('2.7만')
    expect(cellWon(30000)).toBe('3만')
    expect(cellWon(265720)).toBe('27만')
    expect(cellWon(1449053)).toBe('145만')
    expect(cellWon(12_345_678)).toBe('1235만')
    expect(cellWon(150_000_000)).toBe('1.5억')
    for (const n of [1, 9999, 99999, 999999, 9_999_999, 99_999_999, 999_999_999]) expect(cellWon(n).length).toBeLessThanOrEqual(5)
  })
})

describe('공휴일과 색', () => {
  it('공휴일은 그날 맨 위 줄에 들어가고, 일정은 그 아래로', async () => {
    const { holidaysBetween } = await import('../../src/lib/holidays')
    const g = monthGrid('2026-10')
    const weeks = layoutWeeks(g, [ev(1, '2026-10-03', '2026-10-04')], [], 4, holidaysBetween(g[0], g[g.length - 1]))
    const first = weeks[0].bars
    expect(first.find((b) => b.kind === 'holiday')).toMatchObject({ title: '개천절', lane: 0, col: 6 })
    expect(first.find((b) => b.kind === 'event')).toMatchObject({ lane: 1 })
    expect(weeks[0].lanes).toBe(2)
  })

  it('색: 이름 있는 색과 직접 고른 색, 밝은 색은 진한 글씨', async () => {
    const { eventBg, eventFg, isEventColor } = await import('../../src/lib/eventLayout')
    expect(isEventColor('mint')).toBe(true)
    expect(isEventColor('#12ab34')).toBe(true)
    expect(isEventColor('#12ab3')).toBe(false)
    expect(eventBg('#12ab34')).toBe('#12ab34')
    expect(eventFg('yellow')).toBe('#191f28')
    expect(eventFg('navy')).toBe('#ffffff')
  })
})

describe('스티커', () => {
  it('하루에 하나, 바꾸고 떼고, 백업에도 들어간다', async () => {
    const { createStickerRepo } = await import('../../src/repositories/stickerRepo')
    const d = new TidyDB('sticker-a')
    dbs.push(d)
    const repo = createStickerRepo(d)
    await repo.set('2026-10-14', '🔥')
    await repo.set('2026-10-14', '⭐')
    await repo.set('2026-10-20', '🎂')
    expect((await repo.listBetween('2026-10-01', '2026-10-31')).map((s) => s.emoji)).toEqual(['⭐', '🎂'])
    await repo.set('2026-10-20', null)
    const backup = await createBackupRepo(d, '0.1.0').exportAll()
    const b = new TidyDB('sticker-b')
    dbs.push(b)
    await createBackupRepo(b, '0.1.0').importAll(JSON.stringify(backup))
    expect(await b.stickers.toArray()).toMatchObject([{ date: '2026-10-14', emoji: '⭐' }])
  })
})

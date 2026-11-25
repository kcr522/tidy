import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { bestStreak, currentStreak, lastDays, monthCells, monthRate } from '../../src/lib/habits'
import { createHabitRepo, groupChecks } from '../../src/repositories/habitRepo'

const TODAY = '2026-11-10'
const days = (...dates: string[]) => new Set(dates)

describe('습관 연속 기록', () => {
  it.each([
    ['오늘까지 사흘 이어서 했으면 3', days('2026-11-08', '2026-11-09', '2026-11-10'), TODAY, 3],
    ['오늘 아직 안 했어도 어제까지 이어졌으면 끊기지 않아 2', days('2026-11-08', '2026-11-09'), TODAY, 2],
    ['어제도 안 했으면 0', days('2026-11-07', '2026-11-08'), TODAY, 0],
    ['달이 바뀌어도 이어져서 2', days('2026-10-31', '2026-11-01'), '2026-11-01', 2],
  ])('지금 연속 기록: %s', (_case, done, today, streak) => {
    expect(currentStreak(done, today)).toBe(streak)
  })

  it('최고 기록은 가장 긴 연속 구간의 날 수다', () => {
    const done = days('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06')

    expect(bestStreak(done)).toBe(3)
  })

  it('한 번도 안 했으면 최고 기록은 0 이다', () => {
    expect(bestStreak(days())).toBe(0)
  })
})

describe('습관 달력', () => {
  it('2026년 11월은 일요일에 시작해 빈칸 없이 30칸이다', () => {
    const cells = monthCells('2026-11')

    expect(cells[0]).toBe('2026-11-01')
    expect(cells.length).toBe(30)
  })

  it('2026년 12월은 화요일 시작이라 앞에 빈칸이 2개 있다', () => {
    const cells = monthCells('2026-12')

    expect(cells.slice(0, 3)).toEqual([null, null, '2026-12-01'])
  })

  it('최근 며칠은 오래된 날부터 오늘까지 차례로 준다', () => {
    expect(lastDays(TODAY, 3)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10'])
  })

  it('이번 달 달성률은 만든 날부터 오늘까지 중 한 날을 센다 (지난달 기록은 빼고)', () => {
    const createdOn = '2026-11-06'
    const done = days('2026-11-09', '2026-11-10', '2026-10-30')

    expect(monthRate(done, '2026-11', TODAY, createdOn)).toEqual({ done: 2, days: 5 }) // 6일 ~ 10일
  })
})

describe('habitRepo', () => {
  const freshRepo = () => createHabitRepo(new TidyDB(`habit-${Math.random()}`))

  it('습관은 넣은 순서대로 나온다', async () => {
    const repo = freshRepo()

    const water = await repo.add({ title: '물 마시기', emoji: '💧' })
    const exercise = await repo.add({ title: '운동', emoji: '🏃' })

    expect((await repo.list()).map((habit) => habit.id)).toEqual([water, exercise])
  })

  it('체크를 켜면 그날 기록이 생기고, 다시 누르면 꺼져 기록이 사라진다', async () => {
    const repo = freshRepo()
    const water = await repo.add({ title: '물 마시기', emoji: '💧' })

    expect(await repo.toggle(water, TODAY)).toBe(true)
    expect(groupChecks(await repo.allChecks()).get(water)?.has(TODAY)).toBe(true)

    expect(await repo.toggle(water, TODAY)).toBe(false)
    expect(groupChecks(await repo.allChecks()).get(water)).toBeUndefined()
  })

  it('습관을 지우면 그 습관의 체크 기록만 지운다', async () => {
    const repo = freshRepo()
    const water = await repo.add({ title: '물 마시기', emoji: '💧' })
    const exercise = await repo.add({ title: '운동', emoji: '🏃' })
    await repo.toggle(water, TODAY)
    await repo.toggle(exercise, TODAY)

    await repo.remove(water)

    expect((await repo.allChecks()).map((check) => check.habitId)).toEqual([exercise])
  })
})

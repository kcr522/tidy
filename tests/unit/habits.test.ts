import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { bestStreak, currentStreak, lastDays, monthCells, monthRate } from '../../src/lib/habits'
import { createHabitRepo, groupChecks } from '../../src/repositories/habitRepo'

const TODAY = '2026-11-10'
const set = (...d: string[]) => new Set(d)

describe('습관 연속 기록', () => {
  it('오늘까지 이어서 한 날을 센다', () => {
    expect(currentStreak(set('2026-11-08', '2026-11-09', '2026-11-10'), TODAY)).toBe(3)
  })
  it('오늘 아직 안 했어도 어제까지 이어졌으면 끊기지 않는다', () => {
    expect(currentStreak(set('2026-11-08', '2026-11-09'), TODAY)).toBe(2)
  })
  it('어제도 안 했으면 0', () => {
    expect(currentStreak(set('2026-11-07', '2026-11-08'), TODAY)).toBe(0)
  })
  it('달이 바뀌어도 이어진다', () => {
    expect(currentStreak(set('2026-10-31', '2026-11-01'), '2026-11-01')).toBe(2)
  })
  it('최고 기록은 가장 긴 구간', () => {
    expect(bestStreak(set('2026-11-01', '2026-11-02', '2026-11-03', '2026-11-05', '2026-11-06'))).toBe(3)
    expect(bestStreak(set())).toBe(0)
  })
})

describe('습관 달력', () => {
  it('2026년 11월은 일요일에 시작해 30칸', () => {
    const cells = monthCells('2026-11')
    expect(cells[0]).toBe('2026-11-01')
    expect(cells.length).toBe(30)
  })
  it('12월은 화요일 시작이라 앞에 빈칸 2개', () => {
    const cells = monthCells('2026-12')
    expect(cells.slice(0, 3)).toEqual([null, null, '2026-12-01'])
  })
  it('최근 7일은 오래된 날부터 오늘까지', () => {
    expect(lastDays(TODAY, 3)).toEqual(['2026-11-08', '2026-11-09', '2026-11-10'])
  })
  it('이번 달 한 날 / 지난 날 (만든 날부터)', () => {
    expect(monthRate(set('2026-11-09', '2026-11-10', '2026-10-30'), '2026-11', TODAY, '2026-11-06')).toEqual({ done: 2, days: 5 })
  })
})

describe('habitRepo', () => {
  it('체크를 켜고 끄고, 습관을 지우면 기록도 지운다', async () => {
    const repo = createHabitRepo(new TidyDB(`habit-${Math.random()}`))
    const id = await repo.add({ title: '물 마시기', emoji: '💧' })
    const id2 = await repo.add({ title: '운동', emoji: '🏃' })
    expect((await repo.list()).map((h) => h.id)).toEqual([id, id2])

    expect(await repo.toggle(id, TODAY)).toBe(true)
    await repo.toggle(id2, TODAY)
    expect(groupChecks(await repo.allChecks()).get(id)?.has(TODAY)).toBe(true)
    expect(await repo.toggle(id, TODAY)).toBe(false)
    expect(groupChecks(await repo.allChecks()).get(id)).toBeUndefined()

    await repo.toggle(id, TODAY)
    await repo.remove(id)
    expect((await repo.allChecks()).map((c) => c.habitId)).toEqual([id2])
  })
})

import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { activityRows, buildYearReport, defaultReportYear, longestStreak, searchSpending, teaserOf, type YearInput } from '../../src/lib/yearlyReport'

const row = (date: string, amount: number, category = '식비', memo = '', type: Transaction['type'] = 'EXPENSE'): Transaction => ({ type, amount, date, category, memo, createdAt: '', updatedAt: '' })
const doneTodo = (doneAt: string): Todo => ({ title: '할 일', dueDate: null, isCompleted: 1, completedAt: doneAt, priority: 'MEDIUM', createdAt: '', updatedAt: '' })
const year2025: YearInput = { year: '2025', today: '2026-11-27', transactions: [], todos: [], habits: [], checks: [], diaries: [], bookmarks: [] }
const SAVING = '저축'

describe('yearlyReport', () => {
  it.each([
    ['2026-01-31', '2025'], // 1월 마지막 날까지는 지난해
    ['2026-02-01', '2026'], // 2월 첫날부터는 올해
  ])('%s에 처음 열면 %s년 리포트를 보여 준다', (today, expected) => {
    expect(defaultReportYear(today)).toBe(expected)
  })

  it.each([
    [['2025-03-01', '2025-03-02', '2025-03-03', '2025-03-05'], 3],
    [['2025-12-31', '2026-01-01'], 2], // 해를 넘겨도 이어진다
    [['2025-05-01', '2025-05-01'], 1], // 같은 날 두 번은 하루
    [[], 0],
  ])('가장 길게 이어진 날: %j → %i일', (dates, expected) => {
    expect(longestStreak(dates)).toBe(expected)
  })

  const money = [row('2024-06-01', 1000000), row('2025-01-10', 300000, '주거/통신', '월세'), row('2025-01-11', 50000), row('2025-03-02', 200000), row('2025-03-02', 100000, SAVING), row('2025-02-25', 3000000, '월급', '월급', 'INCOME')]

  it('돈: 1년 수입 · 지출 · 저축 합계, 지난해 비교, 달마다 쓴 돈을 센다', () => {
    const report = buildYearReport({ ...year2025, transactions: money })

    expect(report.money).toMatchObject({ income: 3000000, expense: 550000, saving: 100000, prevExpense: 1000000, diffPct: -45, monthAvg: 275000, maxMonth: 1, minMonth: 3, noSpendDays: 362 }) // 365일 중 지출한 날 3일
    expect(report.months[0].expense).toBe(350000)
    expect(report.money.biggest).toMatchObject({ memo: '월세', amount: 300000 })
    expect(report.headline).toBe('2025년은 지난해보다 45% 덜 썼어요 👏')
  })

  it('올해는 오늘까지만 세고, 지난해 비교는 해가 끝난 뒤에 한다', () => {
    const report = buildYearReport({ ...year2025, year: '2026', today: '2026-01-10', transactions: [row('2025-05-01', 100000), row('2026-01-05', 1000)] })

    expect(report).toMatchObject({ ongoing: true, days: 10 })
    expect(report.money.diffPct).toBeNull()
  })

  it('가장 아낀 달을 고를 때 아직 진행 중인 이번 달은 뺀다', () => {
    const report = buildYearReport({ ...year2025, year: '2026', today: '2026-03-05', transactions: [row('2026-01-05', 500000), row('2026-02-05', 300000), row('2026-03-02', 1000)] })

    expect(report.money.minMonth).toBe(2)
  })

  it('할 일 · 일기 · 습관 체크도 날마다 기록 수에 들어가고, 가장 많은 달을 고른다', () => {
    const todos = [doneTodo('2025-04-01T03:00:00Z'), doneTodo('2025-04-02T03:00:00Z'), doneTodo('2025-07-01T03:00:00Z')]
    const diaries = [{ date: '2025-04-01', text: '', color: '', photos: [{ src: 'a', at: '' }] as never, createdAt: '', updatedAt: '' }]
    const checks = [{ habitId: 1, date: '2025-04-01', createdAt: '' }]

    const report = buildYearReport({ ...year2025, todos, diaries, checks })

    expect(report.activity['2025-04-01']).toBe(3)
    expect(report.activeDays).toBe(3)
    expect(report.todos).toEqual({ done: 3, bestMonth: 4 })
    expect(report.diary).toEqual({ days: 1, photos: 1, bestMonth: 4 })
  })

  it('습관은 만든 날부터 연말까지 중 한 날과 최장 연속을 세고, 30일 넘게 이으면 맨 위에 자랑한다', () => {
    const habits = [{ id: 1, title: '물 마시기', emoji: '💧', order: 0, createdAt: '2025-12-01T00:00:00', updatedAt: '' }]
    const checks = Array.from({ length: 31 }, (_, n) => ({ habitId: 1, date: `2025-12-${String(n + 1).padStart(2, '0')}`, createdAt: '' }))

    const report = buildYearReport({ ...year2025, habits, checks })

    expect(report.habits).toEqual([{ title: '물 마시기', emoji: '💧', done: 31, days: 31, streak: 31 }])
    expect(report.headline).toBe('물 마시기, 31일 연속으로 해냈어요 🔥')
  })

  it('기록이 없으면 그렇게 말한다', () => {
    expect(buildYearReport(year2025).headline).toBe('2025년 기록이 아직 없어요')
  })

  it('잔디는 12줄, 가장 많이 기록한 날이 가장 진하고 그달에 없는 날은 -1이다', () => {
    const rows = activityRows('2025', { '2025-02-27': 1, '2025-02-28': 6 })

    expect(rows).toHaveLength(12)
    expect(rows[1][26]).toBe(1) // 가장 많은 날(6개)의 1/6 → 가장 옅게
    expect(rows[1][27]).toBe(3)
    expect(rows[1][28]).toBe(-1) // 2025년 2월은 28일까지
  })

  it.each([
    ['2026-12-14', null],
    ['2026-12-15', '/report?y=2026'],
    ['2027-01-15', '/report?y=2026'],
    ['2027-01-16', null],
    ['2026-11-07', '/report?m=2026-10'],
  ])('대시보드 카드: %s에는 %s로 간다', (today, expected) => {
    expect(teaserOf(today)?.to ?? null).toBe(expected)
  })
})

describe('searchSpending', () => {
  const spends = [row('2025-03-01', 20000, '문화/여가', '영화'), row('2025-03-15', 30000, '문화/여가', '전시'), row('2025-07-02', 15000, '식비', '여가 모임 저녁'), row('2025-03-20', 9000, '식비', '점심'), row('2024-03-01', 99000, '문화/여가', '콘서트'), row('2025-03-03', 50000, '저축', '여가 통장')]
  const LEISURE = '여가'

  it('카테고리나 메모에 그 글자가 있는 지출을 그달 · 그해로 모으고, 저축과 다른 해는 뺀다', () => {
    const result = searchSpending(spends, LEISURE, '2025', '2025-03')

    expect(result?.month).toEqual({ amount: 50000, count: 2 })
    expect(result?.year).toEqual({ amount: 65000, count: 3 })
    expect(result?.months[6]).toBe(15000) // 7월: 메모 '여가 모임'
    expect(result?.categories).toEqual(['문화/여가'])
  })

  it.each([
    ['', null],
    ['  ', null],
  ])('빈 검색어(%j)면 결과가 없다', (query, expected) => {
    expect(searchSpending(spends, query, '2025')).toBe(expected)
  })

  it('띄어쓰기와 영문 대소문자는 무시하고, 달을 안 주면 그달 칸은 비운다', () => {
    const result = searchSpending([row('2025-01-01', 5900, '구독', 'Netflix')], 'net flix', '2025')

    expect(result?.year.amount).toBe(5900)
    expect(result?.month).toBeNull()
  })
})

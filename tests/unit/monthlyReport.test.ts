import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { buildReport, prevMonth, type ReportInput } from '../../src/lib/monthlyReport'

const row = (date: string, amount: number, category = '식비', memo = '', type: Transaction['type'] = 'EXPENSE'): Transaction => ({ type, amount, date, category, memo, createdAt: '', updatedAt: '' })
const todo = (dueDate: string, doneAt: string | null): Todo => ({ title: '할 일', dueDate, isCompleted: doneAt ? 1 : 0, completedAt: doneAt, priority: 'MEDIUM', createdAt: '', updatedAt: '' })
const october: ReportInput = { ym: '2026-10', today: '2026-11-11', transactions: [], todos: [], habits: [], checks: [], diaries: [], bookmarks: [], budgets: [] }
const TOTAL_BUDGET = ''

describe('monthlyReport', () => {
  it('1월의 지난달은 지난해 12월이다', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
  })

  const octoberMoney = [row('2026-09-10', 500000), row('2026-10-01', 300000, '주거/통신', '월세'), row('2026-10-02', 50000), row('2026-10-02', 30000, '쇼핑'), row('2026-10-20', 20000), row('2026-10-25', 3000000, '월급', '월급', 'INCOME')]

  it('돈: 그달 수입 · 지출 합계와 지난달 비교, 안 쓴 날 수를 센다', () => {
    const report = buildReport({ ...october, transactions: octoberMoney })

    expect(report.money).toMatchObject({ income: 3000000, expense: 400000, prevExpense: 500000, diffPct: -20, noSpendDays: 28 }) // 31일 중 지출한 날 3일
    expect(report.headline).toBe('지난달보다 20% 덜 썼어요 👏')
  })

  it('돈: 많이 쓴 카테고리 순서와 비율, 가장 큰 지출을 고른다', () => {
    const report = buildReport({ ...october, transactions: octoberMoney })

    expect(report.money.top).toEqual([
      { category: '주거/통신', amount: 300000, pct: 75 },
      { category: '식비', amount: 70000, pct: 18 },
      { category: '쇼핑', amount: 30000, pct: 8 },
    ])
    expect(report.money.biggest).toMatchObject({ memo: '월세', amount: 300000 })
  })

  it('예산 안에서 쓴 달은 쓴 비율과 칭찬 제목을 준다', () => {
    const report = buildReport({ ...october, transactions: [row('2026-10-05', 100000)], budgets: [{ category: TOTAL_BUDGET, amount: 500000, updatedAt: '' }] })

    expect(report.money.budget?.pct).toBe(20)
    expect(report.headline).toBe('10월은 예산 안에서 잘 썼어요 🎉')
  })

  it('할 일: 그달 끝낸 수와, 마감이 그달인 일 중 끝낸 비율을 센다', () => {
    const todos = [todo('2026-10-03', '2026-10-03T10:00:00Z'), todo('2026-10-09', '2026-10-09T10:00:00Z'), todo('2026-10-20', null), todo('2026-11-01', '2026-10-30T10:00:00Z')]

    const report = buildReport({ ...october, todos })

    expect(report.todos).toEqual({ done: 3, due: 3, dueDone: 2, rate: 67 })
  })

  it('습관은 만든 날부터 그달 끝까지 중 한 날을 센다', () => {
    const habits = [{ id: 1, title: '물', emoji: '💧', order: 0, createdAt: '2026-10-22T00:00:00', updatedAt: '' }]
    const checks = [{ habitId: 1, date: '2026-10-22', createdAt: '' }, { habitId: 1, date: '2026-10-23', createdAt: '' }, { habitId: 1, date: '2026-11-01', createdAt: '' }]

    const report = buildReport({ ...october, habits, checks })

    expect(report.habits).toEqual([{ title: '물', emoji: '💧', done: 2, days: 10 }]) // 10/22 ~ 10/31
  })

  it('일기는 쓴 날과 사진 수를, 스크랩은 저장 · 읽은 수를 센다', () => {
    const diaries = [{ date: '2026-10-01', text: '', color: '', photos: [{ src: 'a', at: '' }, { src: 'b', at: '' }] as never, createdAt: '', updatedAt: '' }, { date: '2026-10-02', text: '', color: '', photo: 'x', createdAt: '', updatedAt: '' }]
    const bookmarks = [{ url: 'https://a', title: 'a', isRead: 1, createdAt: '2026-10-05T00:00:00Z', updatedAt: '' } as never]

    const report = buildReport({ ...october, diaries, bookmarks })

    expect(report.diary).toEqual({ days: 2, photos: 3 })
    expect(report.scraps).toEqual({ saved: 1, read: 1 })
  })

  it('이번 달은 아직 진행 중이라고 표시하고, 기록이 없으면 그렇게 말한다', () => {
    const report = buildReport({ ...october, ym: '2026-11' })

    expect(report.ongoing).toBe(true)
    expect(report.headline).toBe('이번 달 기록이 아직 없어요')
  })
})

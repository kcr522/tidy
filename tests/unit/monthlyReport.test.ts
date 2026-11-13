import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { buildReport, prevMonth, type ReportInput } from '../../src/lib/monthlyReport'

const tx = (date: string, amount: number, category = '식비', memo = '', type: Transaction['type'] = 'EXPENSE'): Transaction => ({ type, amount, date, category, memo, createdAt: '', updatedAt: '' })
const todo = (dueDate: string, done: string | null): Todo => ({ title: 't', dueDate, isCompleted: done ? 1 : 0, completedAt: done, priority: 'MEDIUM', createdAt: '', updatedAt: '' })
const base: ReportInput = { ym: '2026-10', today: '2026-11-11', transactions: [], todos: [], habits: [], checks: [], diaries: [], bookmarks: [], budgets: [] }

describe('monthlyReport', () => {
  it('지난달', () => {
    expect(prevMonth('2026-01')).toBe('2025-12')
  })

  it('돈: 합계, 지난달 비교, 많이 쓴 카테고리, 가장 큰 지출, 안 쓴 날', () => {
    const r = buildReport({
      ...base,
      transactions: [tx('2026-09-10', 500000), tx('2026-10-01', 300000, '주거/통신', '월세'), tx('2026-10-02', 50000), tx('2026-10-02', 30000, '쇼핑'), tx('2026-10-20', 20000), tx('2026-10-25', 3000000, '월급', '월급', 'INCOME')],
    })
    expect(r.money).toMatchObject({ income: 3000000, expense: 400000, prevExpense: 500000, diffPct: -20, noSpendDays: 28 })
    expect(r.money.top).toEqual([
      { category: '주거/통신', amount: 300000, pct: 75 },
      { category: '식비', amount: 70000, pct: 18 },
      { category: '쇼핑', amount: 30000, pct: 8 },
    ])
    expect(r.money.biggest).toMatchObject({ memo: '월세', amount: 300000 })
    expect(r.headline).toBe('지난달보다 20% 덜 썼어요 👏')
  })

  it('예산 안에서 쓴 달', () => {
    const r = buildReport({ ...base, transactions: [tx('2026-10-05', 100000)], budgets: [{ category: '', amount: 500000, updatedAt: '' }] })
    expect(r.money.budget?.pct).toBe(20)
    expect(r.headline).toBe('10월은 예산 안에서 잘 썼어요 🎉')
  })

  it('할 일: 그달 끝낸 수, 마감이 그달인 일 중 끝낸 비율', () => {
    const r = buildReport({ ...base, todos: [todo('2026-10-03', '2026-10-03T10:00:00Z'), todo('2026-10-09', '2026-10-09T10:00:00Z'), todo('2026-10-20', null), todo('2026-11-01', '2026-10-30T10:00:00Z')] })
    expect(r.todos).toEqual({ done: 3, due: 3, dueDone: 2, rate: 67 })
  })

  it('습관, 일기, 스크랩', () => {
    const r = buildReport({
      ...base,
      habits: [{ id: 1, title: '물', emoji: '💧', order: 0, createdAt: '2026-10-22T00:00:00', updatedAt: '' }],
      checks: [{ habitId: 1, date: '2026-10-22', createdAt: '' }, { habitId: 1, date: '2026-10-23', createdAt: '' }, { habitId: 1, date: '2026-11-01', createdAt: '' }],
      diaries: [{ date: '2026-10-01', text: '', color: '', photos: [{ src: 'a', at: '' }, { src: 'b', at: '' }] as never, createdAt: '', updatedAt: '' }, { date: '2026-10-02', text: '', color: '', photo: 'x', createdAt: '', updatedAt: '' }],
      bookmarks: [{ url: 'https://a', title: 'a', isRead: 1, createdAt: '2026-10-05T00:00:00Z', updatedAt: '' } as never],
    })
    expect(r.habits).toEqual([{ title: '물', emoji: '💧', done: 2, days: 10 }])
    expect(r.diary).toEqual({ days: 2, photos: 3 })
    expect(r.scraps).toEqual({ saved: 1, read: 1 })
  })

  it('이번 달은 아직 진행 중', () => {
    const r = buildReport({ ...base, ym: '2026-11' })
    expect(r.ongoing).toBe(true)
    expect(r.headline).toBe('이번 달 기록이 아직 없어요')
  })
})

import { describe, expect, it } from 'vitest'
import type { Budget, Transaction } from '../../src/db/types'
import { budgetStatus } from '../../src/lib/budget'
import { dailyTotals, expenseOn } from '../../src/lib/calendar'
import { isSaving, isSpending } from '../../src/lib/categories'
import { buildReport } from '../../src/lib/monthlyReport'
import { categoryShares, totalsByPeriod, periodOf } from '../../src/lib/stats'
import { accountTotals, groupByDate, monthSummary, todayExpense } from '../../src/lib/summary'
import { buildWidgetSummary } from '../../src/lib/widgetSummary'

function tx(partial: Partial<Transaction>): Transaction {
  return {
    type: 'EXPENSE',
    amount: 1000,
    category: '식비',
    date: '2026-11-10',
    memo: '',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...partial,
  }
}

// 사용자 요청 2026-11-23: 저축은 지출로 가지 말고 저축 칸으로
const list = [
  tx({ type: 'INCOME', amount: 3_000_000, category: '월급' }),
  tx({ amount: 20_000, category: '식비', account: '토스' }),
  tx({ amount: 300_000, category: '저축', memo: '청년 적금', account: '토스', savingsId: 1 }),
  tx({ amount: 100_000, category: '저축', memo: '비상금' }),
]

describe('저축은 지출에 넣지 않는다', () => {
  it('저축 카테고리와 적금 자동 기록은 저축', () => {
    expect(isSaving(list[2])).toBe(true)
    expect(isSaving(list[3])).toBe(true)
    expect(isSaving(tx({ category: '기타', savingsId: 2 }))).toBe(true)
    expect(isSaving(list[1])).toBe(false)
    expect(isSaving(list[0])).toBe(false)
    expect(isSpending(list[1])).toBe(true)
    expect(isSpending(list[2])).toBe(false)
  })

  it('월 합계: 지출과 저축이 따로', () => {
    expect(monthSummary(list)).toEqual({ income: 3_000_000, expense: 20_000, saving: 400_000, balance: 2_580_000 })
  })

  it('오늘 지출 · 날짜별 묶음 · 달력', () => {
    expect(todayExpense(list, '2026-11-10')).toBe(20_000)
    const [g] = groupByDate(list)
    expect([g.expense, g.saving, g.income]).toEqual([20_000, 400_000, 3_000_000])
    expect(expenseOn(list, '2026-11-10')).toBe(20_000)
    expect(dailyTotals(list).get('2026-11-10')).toEqual({ income: 3_000_000, expense: 20_000, saving: 400_000 })
  })

  it('결제 수단별 합계에서도 저축은 따로', () => {
    const toss = accountTotals(list).find((a) => a.account === '토스')
    expect(toss).toMatchObject({ expense: 20_000, saving: 300_000 })
  })

  it('카테고리 비율 · 기간 합계에 저축이 지출로 안 들어간다', () => {
    const shares = categoryShares(list, 'EXPENSE')
    expect(shares.map((s) => s.category)).toEqual(['식비'])
    expect(shares[0].percent).toBe(100)
    const [row] = totalsByPeriod(list, periodOf('month', '2026-11-10'), 1)
    expect(row).toMatchObject({ income: 3_000_000, expense: 20_000, saving: 400_000 })
  })

  it('예산은 쓴 돈만 센다', () => {
    const budgets: Budget[] = [{ id: 1, category: '', amount: 100_000, createdAt: '', updatedAt: '' } as Budget]
    expect(budgetStatus(budgets, list, '2026-11', '2026-11-10').total?.spent).toBe(20_000)
  })

  it('월간 리포트는 저축을 따로 보여 준다', () => {
    const r = buildReport({ ym: '2026-11', today: '2026-11-30', transactions: list, budgets: [], todos: [], habits: [], checks: [], diaries: [], bookmarks: [] })
    expect(r.money.expense).toBe(20_000)
    expect(r.money.saving).toBe(400_000)
    expect(r.money.top.map((t) => t.category)).toEqual(['식비'])
  })

  it('위젯의 쓴 돈에도 저축은 빠진다', () => {
    const w = buildWidgetSummary([], list, '2026-11-10', false)
    expect(w.days['2026-11-10'].spend).toBe(20_000)
    expect(w.months['2026-11']).toBe(20_000)
  })
})

describe('저축 내역 달마다 묶기', () => {
  it('최근 순 목록을 달마다 합계와 함께 묶는다', async () => {
    const { groupByMonth } = await import('../../src/components/transactions/SavingsLog')
    const g = groupByMonth([
      tx({ amount: 300_000, category: '저축', date: '2026-11-21', savingsId: 1 }),
      tx({ amount: 100_000, category: '저축', date: '2026-11-18' }),
      tx({ amount: 300_000, category: '저축', date: '2026-10-21', savingsId: 1 }),
    ])
    expect(g.map((x) => [x.ym, x.total, x.items.length])).toEqual([
      ['2026-11', 400_000, 2],
      ['2026-10', 300_000, 1],
    ])
  })
})

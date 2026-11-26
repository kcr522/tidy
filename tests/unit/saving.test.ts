import { describe, expect, it } from 'vitest'
import type { Budget, Transaction } from '../../src/db/types'
import { budgetStatus } from '../../src/lib/budget'
import { dailyTotals, expenseOn } from '../../src/lib/calendar'
import { isSaving, isSpending } from '../../src/lib/categories'
import { buildReport } from '../../src/lib/monthlyReport'
import { categoryShares, totalsByPeriod, periodOf } from '../../src/lib/stats'
import { accountTotals, groupByDate, monthSummary, todayExpense } from '../../src/lib/summary'
import { buildWidgetSummary } from '../../src/lib/widgetSummary'

function row(partial: Partial<Transaction>): Transaction {
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

const TODAY = '2026-11-10'
// 사용자 요청 2026-11-23: 저축은 지출로 가지 말고 저축 칸으로
const salary = row({ type: 'INCOME', amount: 3_000_000, category: '월급' })
const lunch = row({ amount: 20_000, category: '식비', account: '토스' })
const autoSaving = row({ amount: 300_000, category: '저축', memo: '청년 적금', account: '토스', savingsId: 1 })
const handSaving = row({ amount: 100_000, category: '저축', memo: '비상금' })
const list = [salary, lunch, autoSaving, handSaving]
const SPENT = 20_000
const SAVED = 400_000

describe('저축은 지출에 넣지 않는다', () => {
  it.each([
    ['저축 카테고리 + 적금 자동 기록', autoSaving, true],
    ['저축 카테고리', handSaving, true],
    ['다른 카테고리라도 적금 자동 기록', row({ category: '기타', savingsId: 2 }), true],
    ['식비', lunch, false],
    ['월급', salary, false],
  ])('%s 은 저축인가: $2', (_case, item, isSavingRow) => {
    expect(isSaving(item)).toBe(isSavingRow)
  })

  it.each([
    ['식비', lunch, true],
    ['적금', autoSaving, false],
  ])('%s 는 쓴 돈인가: $2', (_case, item, isSpendingRow) => {
    expect(isSpending(item)).toBe(isSpendingRow)
  })

  it('월 합계에서 지출과 저축을 따로 센다', () => {
    expect(monthSummary(list)).toEqual({ income: 3_000_000, expense: SPENT, saving: SAVED, balance: 2_580_000 })
  })

  it('오늘 지출 · 그날 지출에는 저축이 빠진다', () => {
    expect(todayExpense(list, TODAY)).toBe(SPENT)
    expect(expenseOn(list, TODAY)).toBe(SPENT)
  })

  it('날짜별 묶음과 달력 합계에서 저축을 따로 센다', () => {
    const [day] = groupByDate(list)

    expect([day.expense, day.saving, day.income]).toEqual([SPENT, SAVED, 3_000_000])
    expect(dailyTotals(list).get(TODAY)).toEqual({ income: 3_000_000, expense: SPENT, saving: SAVED })
  })

  it('결제 수단별 합계에서도 저축은 따로 센다', () => {
    const toss = accountTotals(list).find((total) => total.account === '토스')

    expect(toss).toMatchObject({ expense: SPENT, saving: 300_000 })
  })

  it('지출 카테고리 비율에 저축이 들어가지 않는다', () => {
    const shares = categoryShares(list, 'EXPENSE')

    expect(shares.map((share) => share.category)).toEqual(['식비'])
    expect(shares[0].percent).toBe(100)
  })

  it('기간 합계에서 저축은 지출이 아니라 저축으로 센다', () => {
    const [month] = totalsByPeriod(list, periodOf('month', TODAY), 1)

    expect(month).toMatchObject({ income: 3_000_000, expense: SPENT, saving: SAVED })
  })

  it('예산은 쓴 돈만 센다', () => {
    const budgets: Budget[] = [{ id: 1, category: '', amount: 100_000, createdAt: '', updatedAt: '' } as Budget]

    expect(budgetStatus(budgets, list, '2026-11', TODAY).total?.spent).toBe(SPENT)
  })

  it('월간 리포트는 저축을 따로 보여 주고 많이 쓴 카테고리에 넣지 않는다', () => {
    const report = buildReport({ ym: '2026-11', today: '2026-11-30', transactions: list, budgets: [], todos: [], habits: [], checks: [], diaries: [], bookmarks: [] })

    expect(report.money.expense).toBe(SPENT)
    expect(report.money.saving).toBe(SAVED)
    expect(report.money.top.map((top) => top.category)).toEqual(['식비'])
  })

  it('위젯의 오늘 · 이번 달 쓴 돈에도 저축은 빠진다', () => {
    const UNLOCKED = false

    const widget = buildWidgetSummary([], list, TODAY, UNLOCKED)

    expect(widget.days[TODAY].spend).toBe(SPENT)
    expect(widget.months['2026-11']).toBe(SPENT)
  })
})

describe('저축 내역 달마다 묶기', () => {
  it('최근 순 목록을 달마다 합계 · 건수와 함께 묶는다', async () => {
    const { groupByMonth } = await import('../../src/components/transactions/SavingsLog')
    const savings = [
      row({ amount: 300_000, category: '저축', date: '2026-11-21', savingsId: 1 }),
      row({ amount: 100_000, category: '저축', date: '2026-11-18' }),
      row({ amount: 300_000, category: '저축', date: '2026-10-21', savingsId: 1 }),
    ]

    const months = groupByMonth(savings)

    expect(months.map((month) => [month.ym, month.total, month.items.length])).toEqual([
      ['2026-11', 400_000, 2],
      ['2026-10', 300_000, 1],
    ])
  })
})

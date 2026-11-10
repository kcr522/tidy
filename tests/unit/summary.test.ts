import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { groupByDate, monthSummary } from '../../src/lib/summary'

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

describe('monthSummary (FR-015)', () => {
  it('수입, 지출, 잔액을 계산한다 (US1 시나리오 2)', () => {
    const s = monthSummary([
      tx({ type: 'INCOME', amount: 3_500_000, category: '월급' }),
      tx({ amount: 1_000_000 }),
      tx({ amount: 240_000 }),
    ])
    expect(s).toEqual({ income: 3_500_000, expense: 1_240_000, balance: 2_260_000 })
  })

  it('내역이 없으면 모두 0', () => {
    expect(monthSummary([])).toEqual({ income: 0, expense: 0, balance: 0 })
  })
})

describe('groupByDate (FR-014)', () => {
  it('날짜별로 묶고 그날 지출/수입 합계를 낸다', () => {
    const groups = groupByDate([
      tx({ date: '2026-11-10', amount: 15000 }),
      tx({ date: '2026-11-10', amount: 5000 }),
      tx({ date: '2026-11-10', type: 'INCOME', amount: 30000, category: '용돈' }),
      tx({ date: '2026-11-09', amount: 8000 }),
    ])
    expect(groups.map((g) => [g.date, g.items.length, g.expense, g.income])).toEqual([
      ['2026-11-10', 3, 20000, 30000],
      ['2026-11-09', 1, 8000, 0],
    ])
  })
})

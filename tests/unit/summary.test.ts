import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { groupByDate, monthSummary } from '../../src/lib/summary'

/** 정상 지출 내역 하나 (1,000원 식비) 에서 필요한 칸만 바꾼다 */
function okTx(over: Partial<Transaction>): Transaction {
  return {
    type: 'EXPENSE',
    amount: 1000,
    category: '식비',
    date: '2026-11-10',
    memo: '',
    createdAt: '2026-11-10T00:00:00.000Z',
    updatedAt: '2026-11-10T00:00:00.000Z',
    ...over,
  }
}

describe('monthSummary (FR-015)', () => {
  it('수입, 지출, 잔액을 계산한다 (US1 시나리오 2)', () => {
    const list = [okTx({ type: 'INCOME', amount: 3_500_000, category: '월급' }), okTx({ amount: 1_000_000 }), okTx({ amount: 240_000 })]

    const summary = monthSummary(list)

    expect(summary).toEqual({ income: 3_500_000, expense: 1_240_000, saving: 0, balance: 2_260_000 })
  })

  it('내역이 없으면 모두 0', () => {
    expect(monthSummary([])).toEqual({ income: 0, expense: 0, saving: 0, balance: 0 })
  })
})

describe('groupByDate (FR-014)', () => {
  it('날짜별로 늦은 날 먼저 묶고 그날 지출 · 수입 합계를 낸다', () => {
    const list = [
      okTx({ date: '2026-11-10', amount: 15_000 }),
      okTx({ date: '2026-11-10', amount: 5_000 }),
      okTx({ date: '2026-11-10', type: 'INCOME', amount: 30_000, category: '용돈' }),
      okTx({ date: '2026-11-09', amount: 8_000 }),
    ]

    const groups = groupByDate(list)

    expect(groups.map((group) => [group.date, group.items.length, group.expense, group.income])).toEqual([
      ['2026-11-10', 3, 20_000, 30_000],
      ['2026-11-09', 1, 8_000, 0],
    ])
  })
})

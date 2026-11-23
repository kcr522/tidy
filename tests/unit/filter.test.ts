import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { categoriesUsed, filterByCategory, monthSummary } from '../../src/lib/summary'

function tx(type: Transaction['type'], amount: number, category: string): Transaction {
  return { type, amount, category, date: '2026-11-10', memo: '', createdAt: '', updatedAt: '' }
}

const list = [tx('EXPENSE', 9000, '식비'), tx('EXPENSE', 1450, '교통'), tx('INCOME', 2_500_000, '월급'), tx('EXPENSE', 12000, '식비')]

describe('카테고리 필터 (FR-018, US6 시나리오 2)', () => {
  it('식비를 고르면 식비만 남고 합계도 식비 기준', () => {
    const food = filterByCategory(list, '식비')
    expect(food).toHaveLength(2)
    expect(monthSummary(food)).toEqual({ income: 0, expense: 21000, saving: 0, balance: -21000 })
  })

  it('null이면 전체', () => {
    expect(filterByCategory(list, null)).toBe(list)
  })

  it('쓰인 카테고리만 기본 순서대로 (지출 → 수입)', () => {
    expect(categoriesUsed([...list].reverse())).toEqual(['식비', '교통', '월급'])
  })
})

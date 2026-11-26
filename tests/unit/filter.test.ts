import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { categoriesUsed, filterByCategory, monthSummary } from '../../src/lib/summary'

function row(type: Transaction['type'], amount: number, category: string): Transaction {
  return { type, amount, category, date: '2026-11-10', memo: '', createdAt: '', updatedAt: '' }
}

const list = [row('EXPENSE', 9000, '식비'), row('EXPENSE', 1450, '교통'), row('INCOME', 2_500_000, '월급'), row('EXPENSE', 12000, '식비')]
const ALL_CATEGORIES = null

describe('카테고리 필터 (FR-018, US6 시나리오 2)', () => {
  it('식비를 고르면 식비만 남고 합계도 식비 기준이다', () => {
    const food = filterByCategory(list, '식비')

    expect(food).toHaveLength(2)
    expect(monthSummary(food)).toEqual({ income: 0, expense: 21000, saving: 0, balance: -21000 }) // 9,000 + 12,000
  })

  it('카테고리를 고르지 않으면(null) 전체 목록을 그대로 준다', () => {
    expect(filterByCategory(list, ALL_CATEGORIES)).toBe(list)
  })

  it('쓰인 카테고리만 기본 순서대로 준다 (지출 → 수입)', () => {
    const reversed = [...list].reverse()

    expect(categoriesUsed(reversed)).toEqual(['식비', '교통', '월급'])
  })
})

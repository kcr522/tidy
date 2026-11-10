import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import {
  categoryShares,
  percentOf,
  periodLabel,
  periodOf,
  shiftPeriod,
  shortWon,
  topIncomeSources,
  totalsByPeriod,
} from '../../src/lib/stats'

const t = (type: Transaction['type'], amount: number, category: string, date: string, memo = ''): Transaction => ({
  type,
  amount,
  category,
  date,
  memo,
  createdAt: '',
  updatedAt: '',
})

const list = [
  t('INCOME', 2_000_000, '월급', '2026-11-01', '회사'),
  t('INCOME', 500_000, '부수입', '2026-11-05', '과외'),
  t('EXPENSE', 300_000, '식비', '2026-11-03'),
  t('EXPENSE', 200_000, '식비', '2026-11-10'),
  t('EXPENSE', 100_000, '기타', '2026-11-04'),
  t('EXPENSE', 400_000, '쇼핑', '2026-11-09'),
  t('EXPENSE', 50_000, '교통', '2026-10-30'),
]

describe('기간', () => {
  it('주는 월요일부터, 달·해는 1일부터', () => {
    expect(periodOf('week', '2026-11-10')).toMatchObject({ start: '2026-11-09', end: '2026-11-16' })
    expect(periodOf('week', '2026-11-08')).toMatchObject({ start: '2026-11-02' })
    expect(periodOf('month', '2026-11-10')).toMatchObject({ start: '2026-11-01', end: '2026-12-01' })
    expect(periodOf('year', '2026-11-10')).toMatchObject({ start: '2026-01-01', end: '2027-01-01' })
  })
  it('앞뒤로 옮기기와 이름', () => {
    expect(shiftPeriod(periodOf('month', '2026-01-15'), -1).start).toBe('2025-12-01')
    expect(periodLabel(periodOf('week', '2026-11-10'))).toBe('11월 9일 ~ 11월 15일')
    expect(periodLabel(periodOf('month', '2026-11-10'), true)).toBe('11월')
  })
})

describe('합계', () => {
  it('기간별 수입·지출 (오래된 순)', () => {
    const rows = totalsByPeriod(list, periodOf('month', '2026-11-10'), 3)
    expect(rows.map((r) => r.period.start)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(rows[1]).toMatchObject({ income: 0, expense: 50_000 })
    expect(rows[2]).toMatchObject({ income: 2_500_000, expense: 1_000_000 })
  })
  it('카테고리별 %: 많은 순, 기타는 맨 뒤', () => {
    const nov = list.filter((x) => x.date >= '2026-11-01')
    expect(categoryShares(nov, 'EXPENSE')).toEqual([
      { category: '식비', amount: 500_000, count: 2, percent: 50 },
      { category: '쇼핑', amount: 400_000, count: 1, percent: 40 },
      { category: '기타', amount: 100_000, count: 1, percent: 10 },
    ])
    expect(categoryShares(nov, 'INCOME').map((x) => x.percent)).toEqual([80, 20])
  })
  it('수입 출처와 % 계산', () => {
    expect(topIncomeSources(list)).toEqual([
      { name: '회사', amount: 2_000_000, percent: 80 },
      { name: '과외', amount: 500_000, percent: 20 },
    ])
    expect(percentOf(1, 3)).toBe(33.3)
    expect(percentOf(5, 0)).toBe(0)
    expect(shortWon(1_234_000)).toBe('123만')
    expect(shortWon(12_000)).toBe('1.2만')
  })
})

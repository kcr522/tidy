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

const TODAY = '2026-11-10'
const PREVIOUS = -1
const SHORT_LABEL = true

const okTx = (type: Transaction['type'], amount: number, category: string, date: string, memo = ''): Transaction => ({
  type, amount, category, date, memo, createdAt: '', updatedAt: '',
})

// 11월: 수입 250만 (월급 200 + 과외 50), 지출 100만 (식비 50 · 쇼핑 40 · 기타 10) / 10월: 교통 5만
const list = [
  okTx('INCOME', 2_000_000, '월급', '2026-11-01', '회사'),
  okTx('INCOME', 500_000, '부수입', '2026-11-05', '과외'),
  okTx('EXPENSE', 300_000, '식비', '2026-11-03'),
  okTx('EXPENSE', 200_000, '식비', '2026-11-10'),
  okTx('EXPENSE', 100_000, '기타', '2026-11-04'),
  okTx('EXPENSE', 400_000, '쇼핑', '2026-11-09'),
  okTx('EXPENSE', 50_000, '교통', '2026-10-30'),
]
const november = list.filter((row) => row.date >= '2026-11-01')

describe('기간', () => {
  it.each([
    ['화요일이 든 주는 그 주 월요일부터 다음 월요일 전까지', 'week', TODAY, { start: '2026-11-09', end: '2026-11-16' }],
    ['일요일이 든 주는 앞 월요일부터', 'week', '2026-11-08', { start: '2026-11-02' }],
    ['달은 1일부터 다음 달 1일 전까지', 'month', TODAY, { start: '2026-11-01', end: '2026-12-01' }],
    ['해는 1월 1일부터 다음 해 1월 1일 전까지', 'year', TODAY, { start: '2026-01-01', end: '2027-01-01' }],
  ])('%s', (_case, kind, day, range) => {
    expect(periodOf(kind as 'week' | 'month' | 'year', day)).toMatchObject(range)
  })

  it('1월에서 한 달 앞으로 가면 작년 12월이 된다', () => {
    expect(shiftPeriod(periodOf('month', '2026-01-15'), PREVIOUS).start).toBe('2025-12-01')
  })

  it('주 이름은 월요일 ~ 일요일 날짜로 보여 준다', () => {
    expect(periodLabel(periodOf('week', TODAY))).toBe('11월 9일 ~ 11월 15일')
  })

  it('짧은 달 이름은 "11월" 로 보여 준다', () => {
    expect(periodLabel(periodOf('month', TODAY), SHORT_LABEL)).toBe('11월')
  })
})

describe('합계', () => {
  it('기간별 수입 · 지출을 오래된 달부터 3개월 낸다', () => {
    const MONTHS = 3

    const rows = totalsByPeriod(list, periodOf('month', TODAY), MONTHS)

    expect(rows.map((row) => row.period.start)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(rows[1]).toMatchObject({ income: 0, expense: 50_000 })
    expect(rows[2]).toMatchObject({ income: 2_500_000, expense: 1_000_000 })
  })

  it('카테고리별 지출 % 는 많은 순으로, 기타는 맨 뒤에 둔다', () => {
    expect(categoryShares(november, 'EXPENSE')).toEqual([
      { category: '식비', amount: 500_000, count: 2, percent: 50 },
      { category: '쇼핑', amount: 400_000, count: 1, percent: 40 },
      { category: '기타', amount: 100_000, count: 1, percent: 10 },
    ])
  })

  it('카테고리별 수입 % 도 낸다', () => {
    expect(categoryShares(november, 'INCOME').map((share) => share.percent)).toEqual([80, 20])
  })

  it('수입 출처는 메모 이름별로 많은 순', () => {
    expect(topIncomeSources(list)).toEqual([
      { name: '회사', amount: 2_000_000, percent: 80 },
      { name: '과외', amount: 500_000, percent: 20 },
    ])
  })

  it.each([
    ['1/3 은 소수 첫째 자리까지', 1, 3, 33.3],
    ['전체가 0 이면 0', 5, 0, 0],
  ])('비율: %s', (_case, part, total, percent) => {
    expect(percentOf(part, total)).toBe(percent)
  })

  it.each([
    [1_234_000, '123만'],
    [12_000, '1.2만'],
  ])('%i원은 짧게 "%s" 로 쓴다', (won, label) => {
    expect(shortWon(won)).toBe(label)
  })
})

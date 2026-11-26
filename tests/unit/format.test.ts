import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatMonthLabel, formatNumber, formatWon } from '../../src/lib/format'

describe('format', () => {
  it.each([
    [15000, '15,000원'],
    [3500000, '3,500,000원'],
  ])('금액 %i 은 쉼표와 원을 붙여 "%s" 로 보여 준다', (amount, label) => {
    expect(formatWon(amount)).toBe(label)
  })

  it('숫자만 보여 줄 때는 쉼표만 붙인다', () => {
    expect(formatNumber(1240000)).toBe('1,240,000')
  })

  it.each([
    ['2026-11-10', '11월 10일 (화)'],
    ['2026-01-01', '1월 1일 (목)'],
  ])('날짜 %s 는 "%s" 로 보여 준다', (date, label) => {
    expect(formatDateLabel(date)).toBe(label)
  })

  it('월은 "2026년 11월" 로 보여 준다', () => {
    expect(formatMonthLabel(2026, 11)).toBe('2026년 11월')
  })
})

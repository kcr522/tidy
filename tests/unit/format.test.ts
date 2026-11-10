import { describe, expect, it } from 'vitest'
import { formatDateLabel, formatMonthLabel, formatNumber, formatWon } from '../../src/lib/format'

describe('format', () => {
  it('금액에 쉼표와 원을 붙인다', () => {
    expect(formatWon(15000)).toBe('15,000원')
    expect(formatWon(3500000)).toBe('3,500,000원')
    expect(formatNumber(1240000)).toBe('1,240,000')
  })

  it('날짜를 "11월 10일 (화)" 형식으로 표시한다', () => {
    expect(formatDateLabel('2026-11-10')).toBe('11월 10일 (화)')
    expect(formatDateLabel('2026-01-01')).toBe('1월 1일 (목)')
  })

  it('월을 "2026년 11월"로 표시한다', () => {
    expect(formatMonthLabel(2026, 11)).toBe('2026년 11월')
  })
})

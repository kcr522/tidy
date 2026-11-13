import { describe, expect, it } from 'vitest'
import { holidaysBetween, holidaysOfYear } from '../../src/lib/holidays'

const dates = (y: number) => holidaysOfYear(y).map((h) => `${h.date.slice(5)} ${h.name}${h.substitute ? ` ${h.substitute}` : ''}`)

describe('holidaysOfYear', () => {
  it('2026년: 노동절·제헌절, 대체공휴일, 지방선거', () => {
    const list = dates(2026)
    expect(list).toContain('03-02 대체공휴일 삼일절')
    expect(list).toContain('05-01 노동절')
    expect(list).toContain('05-25 대체공휴일 부처님오신날')
    expect(list).toContain('06-03 지방선거일')
    expect(list).toContain('07-17 제헌절')
    expect(list).toContain('08-17 대체공휴일 광복절')
    expect(list).toContain('09-25 추석')
    expect(list).toContain('10-05 대체공휴일 개천절')
    expect(list.filter((d) => d.includes('대체')).length).toBe(4)
  })

  it('2027년: 설날 연휴 일요일 → 2월 9일, 토요일 공휴일 → 월요일', () => {
    const list = dates(2027)
    expect(list).toContain('02-09 대체공휴일 설날')
    expect(list).toContain('05-03 대체공휴일 노동절')
    expect(list).toContain('07-19 대체공휴일 제헌절')
    expect(list).toContain('08-16 대체공휴일 광복절')
    expect(list).toContain('10-04 대체공휴일 개천절')
    expect(list).toContain('10-11 대체공휴일 한글날')
    expect(list).toContain('12-27 대체공휴일 성탄절')
    expect(list.filter((d) => d.includes('대체')).length).toBe(7)
  })

  it('2025년: 추석과 개천절이 겹치면 연휴 뒤 첫 평일', () => {
    const list = dates(2025)
    expect(list).toContain('03-03 대체공휴일 삼일절')
    expect(list).toContain('05-06 대체공휴일 어린이날')
    expect(list).toContain('10-08 대체공휴일 추석')
    expect(list).not.toContain('05-01 노동절')
  })

  it('달력 범위로 묶어서 돌려준다 (해를 넘겨도)', () => {
    const map = holidaysBetween('2026-12-27', '2027-01-09')
    expect([...map.keys()]).toEqual(['2027-01-01'])
  })
})

import { describe, expect, it } from 'vitest'
import { holidaysBetween, holidaysOfYear } from '../../src/lib/holidays'

/** 그해 공휴일을 "MM-DD 이름 [대체 대상]" 글로 */
const holidayLines = (year: number) => holidaysOfYear(year).map((day) => `${day.date.slice(5)} ${day.name}${day.substitute ? ` ${day.substitute}` : ''}`)
const substitutes = (year: number) => holidayLines(year).filter((line) => line.includes('대체'))

describe('holidaysOfYear', () => {
  it.each(['03-02 대체공휴일 삼일절', '05-01 노동절', '05-25 대체공휴일 부처님오신날', '06-03 지방선거일', '07-17 제헌절', '08-17 대체공휴일 광복절', '09-25 추석', '10-05 대체공휴일 개천절'])(
    '2026년 공휴일에 "%s" 이 있다 (노동절 · 제헌절 · 지방선거 포함)',
    (line) => {
      expect(holidayLines(2026)).toContain(line)
    },
  )

  it('2026년 대체공휴일은 4일이다', () => {
    expect(substitutes(2026)).toHaveLength(4)
  })

  it.each(['02-09 대체공휴일 설날', '05-03 대체공휴일 노동절', '07-19 대체공휴일 제헌절', '08-16 대체공휴일 광복절', '10-04 대체공휴일 개천절', '10-11 대체공휴일 한글날', '12-27 대체공휴일 성탄절'])(
    '2027년 공휴일에 "%s" 이 있다 (설 연휴 일요일 · 토요일 공휴일은 뒤 평일로)',
    (line) => {
      expect(holidayLines(2027)).toContain(line)
    },
  )

  it('2027년 대체공휴일은 7일이다', () => {
    expect(substitutes(2027)).toHaveLength(7)
  })

  it.each(['03-03 대체공휴일 삼일절', '05-06 대체공휴일 어린이날', '10-08 대체공휴일 추석'])('2025년 공휴일에 "%s" 이 있다 (추석과 개천절이 겹치면 연휴 뒤 첫 평일)', (line) => {
    expect(holidayLines(2025)).toContain(line)
  })

  it('2025년에는 노동절이 아직 공휴일이 아니다', () => {
    expect(holidayLines(2025)).not.toContain('05-01 노동절')
  })

  it('달력 범위의 공휴일을 해를 넘겨도 묶어서 돌려준다', () => {
    const inRange = holidaysBetween('2026-12-27', '2027-01-09')

    expect([...inRange.keys()]).toEqual(['2027-01-01'])
  })
})

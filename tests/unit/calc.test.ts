import { describe, expect, it } from 'vitest'
import { evaluate, formatExpr, pressKey, toWon, tokenize } from '../../src/lib/calc'

function type(keys: string[], start = '') {
  return keys.reduce((e, k) => pressKey(e, k), start)
}

describe('가계부 계산기', () => {
  it('× ÷ 를 먼저 계산한다', () => {
    expect(evaluate('1000+2000×3')).toBe(7000)
    expect(evaluate('30000÷3−500')).toBe(9500)
    expect(evaluate('12,000+3,500')).toBe(15500)
    expect(evaluate('10−2−3')).toBe(5)
  })

  it('끝에 남은 연산자는 무시하고, 비었거나 0으로 나누면 null', () => {
    expect(evaluate('5000+')).toBe(5000)
    expect(evaluate('')).toBeNull()
    expect(evaluate('100÷0')).toBeNull()
  })

  it('소수는 원 단위로 반올림한다', () => {
    expect(toWon(evaluate('10000÷3')!)).toBe(3333)
    expect(toWon(evaluate('1.5×3000')!)).toBe(4500)
  })

  it('키를 누르면 식이 바뀐다', () => {
    expect(type(['1', '2', '00', '+', '×', '3'])).toBe('1200×3')
    expect(type(['+', '5'])).toBe('5')
    expect(type(['0', '0', '7'])).toBe('7')
    expect(type(['.', '5', '.', '1'])).toBe('0.51')
    expect(type(['⌫'], '123')).toBe('12')
    expect(type(['C'], '123+4')).toBe('')
  })

  it('보여 줄 때 천 단위 쉼표', () => {
    expect(formatExpr('12000+3500')).toBe('12,000 + 3,500')
    expect(formatExpr('1000×')).toBe('1,000 ×')
    expect(tokenize('1,000원+2')).toEqual(['1000', '+', '2'])
  })
})

import { describe, expect, it } from 'vitest'
import { evaluate, formatExpr, pressKey, toWon, tokenize } from '../../src/lib/calc'

/** 계산기 키를 차례로 누른 뒤의 식 */
function press(keys: string[], start = '') {
  return keys.reduce((expr, key) => pressKey(expr, key), start)
}

describe('가계부 계산기', () => {
  it.each([
    ['1000+2000×3', 7000],
    ['30000÷3−500', 9500],
    ['12,000+3,500', 15500],
    ['10−2−3', 5], // 빼기는 왼쪽부터
  ])('%s = %i (× ÷ 를 먼저 계산한다)', (expr, result) => {
    expect(evaluate(expr)).toBe(result)
  })

  it('끝에 남은 연산자는 무시한다', () => {
    expect(evaluate('5000+')).toBe(5000)
  })

  it.each([
    ['빈 식', ''],
    ['0 으로 나누기', '100÷0'],
  ])('%s 은 계산하지 않고 null 을 준다', (_case, expr) => {
    expect(evaluate(expr)).toBeNull()
  })

  it.each([
    ['10000÷3', 3333],
    ['1.5×3000', 4500],
  ])('%s 의 결과는 원 단위로 반올림해 %i 원이다', (expr, won) => {
    expect(toWon(evaluate(expr)!)).toBe(won)
  })

  it.each([
    ['연산자를 연달아 누르면 마지막 것만', ['1', '2', '00', '+', '×', '3'], '', '1200×3'],
    ['맨 앞 연산자는 무시', ['+', '5'], '', '5'],
    ['앞자리 0 은 지움', ['0', '0', '7'], '', '7'],
    ['점으로 시작하면 0. 이고 점은 한 번만', ['.', '5', '.', '1'], '', '0.51'],
    ['⌫ 는 한 글자 지움', ['⌫'], '123', '12'],
    ['C 는 모두 지움', ['C'], '123+4', ''],
  ])('키 누르기: %s', (_case, keys, start, expr) => {
    expect(press(keys, start)).toBe(expr)
  })

  it.each([
    ['12000+3500', '12,000 + 3,500'],
    ['1000×', '1,000 ×'],
  ])('식 %s 은 천 단위 쉼표를 붙여 "%s" 로 보여 준다', (expr, label) => {
    expect(formatExpr(expr)).toBe(label)
  })

  it('쉼표와 "원" 이 섞인 식도 숫자와 연산자로 나눈다', () => {
    expect(tokenize('1,000원+2')).toEqual(['1000', '+', '2'])
  })
})

// 가계부 금액칸 계산기 (사용자 요청 2026-11-20) — eval 없이 + − × ÷ 만 계산

export type CalcOp = '+' | '−' | '×' | '÷'
export const CALC_OPS: CalcOp[] = ['+', '−', '×', '÷']

const MAX_NUMBER_LENGTH = 12

function isOp(ch: string): ch is CalcOp {
  return (CALC_OPS as string[]).includes(ch)
}

/** 식을 숫자 · 연산자 조각으로 나눈다. "1,000+2×3" → ['1000', '+', '2', '×', '3'] */
export function tokenize(expr: string): string[] {
  const tokens: string[] = []
  let num = ''
  for (const ch of expr.replace(/[,\s원]/g, '')) {
    if (isOp(ch)) {
      if (num) tokens.push(num)
      num = ''
      tokens.push(ch)
    } else if (/[\d.]/.test(ch)) {
      num += ch
    }
  }
  if (num) tokens.push(num)
  return tokens
}

/**
 * 식을 계산한다 (× ÷ 먼저). 끝에 연산자가 남아 있으면 무시한다.
 * 숫자가 없거나 0으로 나누면 null.
 */
export function evaluate(expr: string): number | null {
  const tokens = tokenize(expr)
  while (tokens.length && isOp(tokens[tokens.length - 1])) tokens.pop()
  // 맨 앞의 연산자는 버린다 (예: "×3")
  while (tokens.length && isOp(tokens[0])) tokens.shift()
  if (tokens.length === 0) return null

  // 1단계: × ÷ 를 먼저 계산해 더하기 · 빼기만 남긴다
  const sums: number[] = []
  const signs: CalcOp[] = []
  let current = Number(tokens[0])
  if (!Number.isFinite(current)) return null
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i] as CalcOp
    const n = Number(tokens[i + 1])
    if (!Number.isFinite(n)) return null
    if (op === '×') current *= n
    else if (op === '÷') {
      if (n === 0) return null
      current /= n
    } else {
      sums.push(current)
      signs.push(op)
      current = n
    }
  }
  sums.push(current)

  // 2단계: 왼쪽부터 더하고 뺀다
  let result = sums[0]
  for (let i = 0; i < signs.length; i++) result = signs[i] === '+' ? result + sums[i + 1] : result - sums[i + 1]
  return result
}

/** 계산 결과를 금액(원, 정수)으로: 반올림 */
export function toWon(value: number): number {
  return Math.round(value)
}

/** 키 하나를 눌렀을 때 식이 어떻게 바뀌는지 */
export function pressKey(expr: string, key: string): string {
  if (key === 'C') return ''
  if (key === '⌫') return expr.slice(0, -1)
  const last = expr.slice(-1)
  if (isOp(key)) {
    if (expr === '') return ''
    // 연산자를 연달아 누르면 바꿔 끼운다
    if (isOp(last)) return expr.slice(0, -1) + key
    if (last === '.') return expr.slice(0, -1) + key
    return expr + key
  }
  // 지금 쓰는 숫자 조각
  const lastNumber = expr.split(/[+−×÷]/).pop() ?? ''
  if (key === '.') {
    if (lastNumber.includes('.')) return expr
    return expr + (lastNumber === '' ? '0.' : '.')
  }
  if (/^\d+$/.test(key)) {
    if (lastNumber.replace('.', '').length + key.length > MAX_NUMBER_LENGTH) return expr
    // 앞자리 0 은 하나만: "0" 다음 숫자는 0 을 바꾼다
    if (lastNumber === '0') return expr.slice(0, -1) + (key === '00' ? '0' : key)
    if (lastNumber === '' && key === '00') return expr + '0'
    return expr + key
  }
  return expr
}

/** 보여 줄 때 숫자마다 천 단위 쉼표: "12000+3500" → "12,000 + 3,500" */
export function formatExpr(expr: string): string {
  return tokenize(expr)
    .map((t) => {
      if (isOp(t)) return ` ${t} `
      const [int, dec] = t.split('.')
      const intText = int === '' ? '0' : Number(int).toLocaleString('ko-KR')
      return dec !== undefined ? `${intText}.${dec}` : intText
    })
    .join('')
    .trim()
}

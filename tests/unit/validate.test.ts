import { describe, expect, it } from 'vitest'
import { domainOf, isWebUrl, normalizeUrl, parseAmount, validateMemo, validateTitle } from '../../src/lib/validate'
import { isValidCategory } from '../../src/lib/categories'

describe('parseAmount (FR-011)', () => {
  it('쉼표와 "원"을 지우고 정수로 바꾼다', () => {
    expect(parseAmount('15,000')).toEqual({ ok: true, value: 15000 })
    expect(parseAmount('3,500,000원')).toEqual({ ok: true, value: 3500000 })
  })

  it('빈 값, 0, 소수, 음수, 문자를 거부한다', () => {
    expect(parseAmount('').ok).toBe(false)
    expect(parseAmount('0').ok).toBe(false)
    expect(parseAmount('1.5').ok).toBe(false)
    expect(parseAmount('-100').ok).toBe(false)
    expect(parseAmount('abc').ok).toBe(false)
  })

  it('999,999,999원까지만 허용한다', () => {
    expect(parseAmount('999999999').ok).toBe(true)
    expect(parseAmount('1000000000').ok).toBe(false)
  })
})

describe('validateTitle / validateMemo', () => {
  it('앞뒤 공백을 지우고 빈 제목은 거부한다', () => {
    expect(validateTitle('  장보기 ')).toEqual({ ok: true, value: '장보기' })
    expect(validateTitle('   ', '할 일을 입력해 주세요')).toEqual({ ok: false, error: '할 일을 입력해 주세요' })
  })

  it('제목 100자, 메모 200자를 넘으면 거부한다', () => {
    expect(validateTitle('a'.repeat(100)).ok).toBe(true)
    expect(validateTitle('a'.repeat(101)).ok).toBe(false)
    expect(validateMemo('a'.repeat(200)).ok).toBe(true)
    expect(validateMemo('a'.repeat(201)).ok).toBe(false)
  })
})

describe('normalizeUrl (FR-031)', () => {
  it('스킴이 없으면 https://를 붙인다', () => {
    expect(normalizeUrl('react.dev/learn')).toEqual({ ok: true, value: 'https://react.dev/learn' })
  })

  it('http/https 주소는 그대로 둔다', () => {
    expect(normalizeUrl('http://example.com')).toEqual({ ok: true, value: 'http://example.com/' })
  })

  it('주소 형식이 아니거나 위험한 스킴은 거부한다', () => {
    expect(normalizeUrl('abc').ok).toBe(false)
    expect(normalizeUrl('').ok).toBe(false)
    expect(normalizeUrl('javascript:alert(1)').ok).toBe(false)
    expect(normalizeUrl('file:///etc/passwd').ok).toBe(false)
  })

  it('도메인만 뽑는다 (FR-032)', () => {
    expect(domainOf('https://www.react.dev/learn')).toBe('react.dev')
  })
})

describe('categories (FR-013)', () => {
  it('구분에 맞는 카테고리만 허용한다', () => {
    expect(isValidCategory('EXPENSE', '식비')).toBe(true)
    expect(isValidCategory('INCOME', '식비')).toBe(false)
    expect(isValidCategory('INCOME', '월급')).toBe(true)
  })
})

describe('isWebUrl (보안: 위험한 주소 막기)', () => {
  it('http/https 만 통과', () => {
    expect(isWebUrl('https://naver.com')).toBe(true)
    expect(isWebUrl('http://a.kr/x')).toBe(true)
    expect(isWebUrl('javascript:alert(1)')).toBe(false)
    expect(isWebUrl('data:text/html,<script>')).toBe(false)
    expect(isWebUrl('file:///etc/passwd')).toBe(false)
    expect(isWebUrl('nope')).toBe(false)
    expect(isWebUrl(3)).toBe(false)
  })
})

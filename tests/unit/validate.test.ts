import { describe, expect, it } from 'vitest'
import { domainOf, isWebUrl, normalizeUrl, parseAmount, validateMemo, validateTitle } from '../../src/lib/validate'
import { isValidCategory } from '../../src/lib/categories'

// 화면에 정해 둔 한도 (FR-011 · 제목 · 메모 칸)
const MAX_AMOUNT = 999_999_999
const MAX_TITLE = 100
const MAX_MEMO = 200

describe('금액 읽기 (parseAmount, FR-011)', () => {
  it.each([
    ['15,000', 15_000],
    ['3,500,000원', 3_500_000],
  ])('"%s" 는 쉼표와 "원"을 지우고 정수 %i 로 읽는다', (text, value) => {
    expect(parseAmount(text)).toEqual({ ok: true, value })
  })

  it.each([
    ['빈 값', ''],
    ['0', '0'],
    ['소수', '1.5'],
    ['음수', '-100'],
    ['문자', 'abc'],
  ])('%s "%s" 는 금액으로 받지 않는다', (_case, text) => {
    expect(parseAmount(text).ok).toBe(false)
  })

  it.each([
    ['한도와 같은 999,999,999원', String(MAX_AMOUNT), true],
    ['한도보다 1원 많은 1,000,000,000원', String(MAX_AMOUNT + 1), false],
  ])('%s 을 받는가: $2', (_case, text, isOk) => {
    expect(parseAmount(text).ok).toBe(isOk)
  })
})

describe('제목 · 메모 검사 (validateTitle · validateMemo)', () => {
  it('제목의 앞뒤 공백을 지운다', () => {
    expect(validateTitle('  장보기 ')).toEqual({ ok: true, value: '장보기' })
  })

  it('공백만 있는 제목은 받지 않고 넘겨준 안내 문구를 돌려준다', () => {
    const message = '할 일을 입력해 주세요'

    expect(validateTitle('   ', message)).toEqual({ ok: false, error: message })
  })

  it.each([
    ['제목', validateTitle, MAX_TITLE, true],
    ['제목', validateTitle, MAX_TITLE + 1, false],
    ['메모', validateMemo, MAX_MEMO, true],
    ['메모', validateMemo, MAX_MEMO + 1, false],
  ])('%s 이 %i자면 받는가: $3', (_field, validate, length, isOk) => {
    expect(validate('a'.repeat(length)).ok).toBe(isOk)
  })
})

describe('주소 다듬기 (normalizeUrl, FR-031)', () => {
  it('스킴이 없으면 https:// 를 붙인다', () => {
    expect(normalizeUrl('react.dev/learn')).toEqual({ ok: true, value: 'https://react.dev/learn' })
  })

  it('http 주소는 http 그대로 두고 끝에 / 를 붙인다', () => {
    expect(normalizeUrl('http://example.com')).toEqual({ ok: true, value: 'http://example.com/' })
  })

  it.each([
    ['주소 모양이 아닌 글', 'abc'],
    ['빈 값', ''],
    ['javascript: 주소', 'javascript:alert(1)'],
    ['file: 주소', 'file:///etc/passwd'],
  ])('%s "%s" 는 받지 않는다 (보안)', (_case, url) => {
    expect(normalizeUrl(url).ok).toBe(false)
  })

  it('www 를 뺀 도메인만 뽑는다 (FR-032)', () => {
    expect(domainOf('https://www.react.dev/learn')).toBe('react.dev')
  })
})

describe('카테고리 (FR-013)', () => {
  it.each([
    ['EXPENSE', '식비', true],
    ['INCOME', '식비', false],
    ['INCOME', '월급', true],
  ] as const)('%s 에 "%s" 카테고리를 쓸 수 있는가: $2', (type, category, isOk) => {
    expect(isValidCategory(type, category)).toBe(isOk)
  })
})

describe('isWebUrl (보안: 위험한 주소 막기)', () => {
  it.each(['https://naver.com', 'http://a.kr/x'])('http · https 주소 %s 는 통과한다', (url) => {
    expect(isWebUrl(url)).toBe(true)
  })

  it.each([['javascript:alert(1)'], ['data:text/html,<script>'], ['file:///etc/passwd'], ['nope'], [3]])('위험하거나 주소가 아닌 %s 는 막는다', (value) => {
    expect(isWebUrl(value)).toBe(false)
  })
})

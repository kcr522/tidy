import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { BOM, csvCell, exportFileName, pickForExport, spanOf, toCsv } from '../../src/lib/moneyExport'

const TODAY = '2026-11-27'
const WITH_SAVING = true
const NO_SAVING = false
const ALL_DAYS = { from: '', to: '' }

/** 정상 지출 내역 하나 (12,000원 점심 식비) 에서 필요한 칸만 바꾼다 */
function okTx(over: Partial<Transaction> = {}): Transaction {
  return {
    type: 'EXPENSE',
    amount: 12_000,
    category: '식비',
    date: '2026-11-10',
    memo: '점심',
    createdAt: '2026-11-10T03:00:00.000Z',
    updatedAt: '2026-11-10T03:00:00.000Z',
    ...over,
  }
}

describe('spanOf', () => {
  it.each([
    ['thisMonth', { from: '2026-11-01', to: '2026-11-30' }],
    ['lastMonth', { from: '2026-10-01', to: '2026-10-31' }],
    ['thisYear', { from: '2026-01-01', to: '2026-12-31' }],
    ['all', ALL_DAYS],
  ] as const)('%s를 고르면 그 기간의 첫날 ~ 마지막 날이 된다', (range, expected) => {
    expect(spanOf(range, TODAY)).toEqual(expected)
  })

  it('직접 고르기에서 끝일을 시작일보다 앞으로 고르면 서로 바꾼다', () => {
    const reversed = { from: '2026-11-20', to: '2026-11-05' }

    const span = spanOf('custom', TODAY, reversed)

    expect(span).toEqual({ from: '2026-11-05', to: '2026-11-20' })
  })
})

describe('pickForExport', () => {
  const span = { from: '2026-11-01', to: '2026-11-30' }

  it.each([
    ['2026-11-01', 1],
    ['2026-10-31', 0],
    ['2026-11-30', 1],
    ['2026-12-01', 0],
  ])('날짜가 %s이면 이번 달 내보내기에 %i건 들어간다 (첫날 · 끝날 포함)', (date, count) => {
    expect(pickForExport([okTx({ date })], span, WITH_SAVING)).toHaveLength(count)
  })

  it('저축 빼기를 고르면 저축 내역은 빠진다', () => {
    const list = [okTx(), okTx({ category: '저축', amount: 300_000 })]

    const rows = pickForExport(list, span, NO_SAVING)

    expect(rows.map((t) => t.category)).toEqual(['식비'])
  })

  it('오래된 날부터, 같은 날은 이른 시각부터 줄을 세운다', () => {
    const list = [okTx({ date: '2026-11-12', memo: '저녁' }), okTx({ time: '19:00', memo: '카페' }), okTx({ time: '08:30', memo: '아침' })]

    const rows = pickForExport(list, span, WITH_SAVING)

    expect(rows.map((t) => t.memo)).toEqual(['아침', '카페', '저녁'])
  })
})

describe('csvCell', () => {
  it.each([
    ['쉼표 있는 글자', '김밥, 라면', '"김밥, 라면"'],
    ['따옴표 있는 글자', '"맛집"', '"""맛집"""'],
    ['수식처럼 보이는 글자', '=SUM(A1)', "'=SUM(A1)"],
    ['보통 글자', '편의점', '편의점'],
  ])('%s → 엑셀에서 그대로 보이게 바꾼다', (_case, value, expected) => {
    expect(csvCell(value)).toBe(expected)
  })
})

describe('toCsv', () => {
  it('맨 앞에 BOM, 머리줄, 내역 한 줄씩 CRLF로 쓴다', () => {
    const list = [okTx({ time: '12:30', account: '신한카드' }), okTx({ type: 'INCOME', category: '월급', memo: '11월 월급', amount: 3_000_000 })]

    const csv = toCsv(list)

    expect(csv.startsWith(BOM)).toBe(true)
    expect(csv.slice(BOM.length).split('\r\n')).toEqual(['날짜,시각,구분,카테고리,내용,결제 수단,금액', '2026-11-10,12:30,지출,식비,점심,신한카드,12000', '2026-11-10,,수입,월급,11월 월급,,3000000', ''])
  })
})

describe('exportFileName', () => {
  it.each([
    ['thisMonth', { from: '2026-11-01', to: '2026-11-30' }, '가계부_2026-11.csv'],
    ['thisYear', { from: '2026-01-01', to: '2026-12-31' }, '가계부_2026.csv'],
    ['all', ALL_DAYS, '가계부_전체.csv'],
    ['custom', { from: '2026-11-01', to: '2026-11-15' }, '가계부_2026-11-01_2026-11-15.csv'],
  ] as const)('%s 기간 → 파일 이름에 기간이 보인다', (range, span, expected) => {
    expect(exportFileName(range, span)).toBe(expected)
  })
})

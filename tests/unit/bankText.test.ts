import { describe, expect, it } from 'vitest'
import { guessCategory, joinSpacedHangul, parseBankText } from '../../src/lib/ocr/bankText'

const today = '2026-11-10'

describe('parseBankText (캡처 글자 → 내역)', () => {
  const tossText = `토스뱅크 통장
11월 10일 화요일
다이소 운남점
-5,000원
14:35
CJ올리브영 명동점 -23,800원
19:02
11월 9일 월요일
급여 +2,500,000원
09:00 잔액 3,120,000원
GS25 역삼점
-3,200원 23:15`

  it('토스처럼 날짜 줄 아래 거래 목록을 날짜 · 시각 · 금액이 붙은 내역으로 읽는다', () => {
    const result = parseBankText(tossText, today)

    expect(result.payments.map((p) => [p.type, p.merchant, p.amount, p.date, p.time])).toEqual([
      ['EXPENSE', '다이소 운남점', 5000, '2026-11-10', '14:35'],
      ['EXPENSE', 'CJ올리브영 명동점', 23800, '2026-11-10', '19:02'],
      ['INCOME', '급여', 2500000, '2026-11-09', '09:00'],
      ['EXPENSE', 'GS25 역삼점', 3200, '2026-11-09', '23:15'],
    ])
  })

  it('통장 이름은 결제 수단으로, 가게 이름으로 카테고리를, 잔액 줄은 잔액으로 읽는다', () => {
    const result = parseBankText(tossText, today)

    expect(result.payments[0]).toMatchObject({ account: '토스뱅크', category: '쇼핑' })
    expect(result.payments[2].category).toBe('월급')
    expect(result.balance).toBe(3120000)
  })

  it('카드 결제 알림 문자에서 카드 · 금액 · 날짜 · 시각 · 가게를 읽는다', () => {
    const cardText = '[Web발신]\n신한카드(1234)승인 김*림 6,100원(일시불)11/08 08:41 스타벅스강남R점 누적123,400원'

    const result = parseBankText(cardText, today)

    expect(result.payments).toEqual([
      { type: 'EXPENSE', merchant: '스타벅스강남R점', amount: 6100, date: '2026-11-08', time: '08:41', account: '신한카드', category: '식비' },
    ])
  })

  it('OCR 이 한 글자씩 띄어 읽은 한글을 붙인다', () => {
    expect(joinSpacedHangul('다 이 소 운 남 점')).toBe('다이소운남점')
  })

  it('OCR 이 "원" 을 "윈" 으로 잘못 읽어도 금액으로 읽는다', () => {
    const result = parseBankText('2026.11.07\n동 네 분 식\n8,000 윈', today)

    expect(result.payments[0]).toMatchObject({ merchant: '동네분식', amount: 8000, date: '2026-11-07', category: '식비' })
  })

  it('잔액 · 누적 금액만 있는 줄은 내역으로 읽지 않는다', () => {
    const result = parseBankText('잔액 1,234,560원\n이번 달 누적 300,000원', today)

    expect(result.payments).toEqual([])
  })

  it('이름 없는 내역은 빠진 돈이면 "결제", 들어온 돈이면 "입금" 으로 부른다', () => {
    const result = parseBankText('-12,000원\n+30,000원', today)

    expect(result.payments.map((p) => p.merchant)).toEqual(['결제', '입금'])
  })

  it.each([
    ['행복약국', '의료/건강'],
    ['서울택시', '교통'],
    ['KCP*결제', '기타'],
  ])('모르는 가게 "%s" 는 이름 속 낱말로 %s 카테고리를 고른다', (merchant, category) => {
    expect(guessCategory(merchant)).toBe(category)
  })
})

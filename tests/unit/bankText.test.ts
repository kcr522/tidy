import { describe, expect, it } from 'vitest'
import { guessCategory, joinSpacedHangul, parseBankText } from '../../src/lib/ocr/bankText'

const today = '2026-11-10'

describe('parseBankText (캡처 글자 → 내역)', () => {
  it('토스처럼 날짜 줄 아래 거래 목록', () => {
    const text = `토스뱅크 통장
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
    const r = parseBankText(text, today)
    expect(r.payments.map((p) => [p.type, p.merchant, p.amount, p.date, p.time])).toEqual([
      ['EXPENSE', '다이소 운남점', 5000, '2026-11-10', '14:35'],
      ['EXPENSE', 'CJ올리브영 명동점', 23800, '2026-11-10', '19:02'],
      ['INCOME', '급여', 2500000, '2026-11-09', '09:00'],
      ['EXPENSE', 'GS25 역삼점', 3200, '2026-11-09', '23:15'],
    ])
    expect(r.payments[0]).toMatchObject({ account: '토스뱅크', category: '쇼핑' })
    expect(r.payments[2].category).toBe('월급')
    expect(r.balance).toBe(3120000)
  })

  it('카드 결제 알림 문자', () => {
    const r = parseBankText('[Web발신]\n신한카드(1234)승인 김*림 6,100원(일시불)11/08 08:41 스타벅스강남R점 누적123,400원', today)
    expect(r.payments).toEqual([
      { type: 'EXPENSE', merchant: '스타벅스강남R점', amount: 6100, date: '2026-11-08', time: '08:41', account: '신한카드', category: '식비' },
    ])
  })

  it('OCR이 띄어 읽은 한글과 "윈"을 고친다', () => {
    expect(joinSpacedHangul('다 이 소 운 남 점')).toBe('다이소운남점')
    const r = parseBankText('2026.11.07\n동 네 분 식\n8,000 윈', today)
    expect(r.payments[0]).toMatchObject({ merchant: '동네분식', amount: 8000, date: '2026-11-07', category: '식비' })
  })

  it('잔액·누적 금액만 있는 줄은 내역이 아니다', () => {
    expect(parseBankText('잔액 1,234,560원\n이번 달 누적 300,000원', today).payments).toEqual([])
  })

  it('이름 없는 내역은 결제/입금, 모르는 가게는 낱말로 카테고리', () => {
    const r = parseBankText('-12,000원\n+30,000원', today)
    expect(r.payments.map((p) => p.merchant)).toEqual(['결제', '입금'])
    expect(guessCategory('행복약국')).toBe('의료/건강')
    expect(guessCategory('서울택시')).toBe('교통')
    expect(guessCategory('KCP*결제')).toBe('기타')
  })
})

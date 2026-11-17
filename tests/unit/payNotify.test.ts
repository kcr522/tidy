import { describe, expect, it } from 'vitest'
import { buildCandidates, parsePayNotification, type PayNotification } from '../../src/lib/payNotify'
import { addApp, addWord, EMPTY_FILTER, type PayFilter } from '../../src/lib/payNotifyFilter'

const at = (hm: string, day = '2026-11-17') => new Date(`${day}T${hm}:00`).getTime()
const note = (pkg: string, app: string, title: string, text: string, time = '14:35'): PayNotification => ({ id: `${pkg}-${time}-${title}`, pkg, app, title, text, postedAt: at(time) })
const pick = (n: PayNotification) => {
  const g = parsePayNotification(n)
  return g && [g.type, g.merchant, g.amount, g.date, g.time, g.account, g.category]
}

describe('parsePayNotification (결제 알림 → 가계부 후보)', () => {
  it('카드사 앱 승인 알림', () => {
    expect(pick(note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '6,100원 일시불\n11/17 14:35 스타벅스강남R점\n누적 123,400원'))).toEqual(['EXPENSE', '스타벅스강남R점', 6100, '2026-11-17', '14:35', '신한카드', '식비'])
  })

  it('카드 결제 문자 (메시지 앱)', () => {
    expect(pick(note('com.samsung.android.messaging', '메시지', '15881688', '[Web발신]\nKB국민카드1234승인\n김*림\n12,000원 일시불\n11/16 19:02\nCU역삼점\n누적530,000원'))).toEqual([
      'EXPENSE',
      'CU역삼점',
      12000,
      '2026-11-16',
      '19:02',
      'KB국민카드',
      '식비',
    ])
  })

  it('삼성 월렛: ₩ 금액, 시각이 없으면 알림이 온 시각', () => {
    expect(pick(note('com.samsung.android.spay', 'Samsung Wallet', '결제 완료', '₩4,500 · 다이소 강남점', '09:12'))).toEqual(['EXPENSE', '다이소 강남점', 4500, '2026-11-17', '09:12', '삼성페이', '쇼핑'])
    expect(pick(note('com.samsung.android.spay', 'Samsung Wallet', '현대카드', '₩4,500 결제 완료\nGS25 역삼점', '09:12'))?.[5]).toBe('현대카드')
  })

  it('토스·카카오페이: "○○에서 ○원 결제했어요"', () => {
    expect(pick(note('viva.republica.toss', '토스', '결제 완료', '올리브영 명동점에서 23,800원 결제했어요', '19:40'))).toEqual(['EXPENSE', '올리브영 명동점', 23800, '2026-11-17', '19:40', '토스', '쇼핑'])
    expect(pick(note('com.kakaopay.app', '카카오페이', '카카오페이', '배달의민족에서 18,900원을 결제했어요', '12:05'))?.slice(0, 3)).toEqual(['EXPENSE', '배달의민족', 18900])
  })

  it('은행 입금·출금', () => {
    expect(pick(note('com.kakaobank.channel', '카카오뱅크', '입금 2,500,000원', '(주)타이디 급여 | 잔액 3,120,000원', '09:00'))?.slice(0, 3)).toEqual(['INCOME', '(주)타이디 급여', 2500000])
    expect(pick(note('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '출금 50,000원 월세 잔액 70,000원', '10:00'))?.slice(0, 3)).toEqual(['EXPENSE', '월세', 50000])
  })

  it('승인 취소는 수입(환불)으로', () => {
    expect(pick(note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인취소', '6,100원 11/17 15:00 스타벅스강남R점'))?.slice(0, 3)).toEqual(['INCOME', '스타벅스강남R점', 6100])
  })

  it('광고·명세서 안내는 빼기', () => {
    expect(parsePayNotification(note('com.shcard.smartpay', '신한 SOL페이', '(광고) 최대 10,000원 캐시백', '지금 결제하면 혜택'))).toBeNull()
    expect(parsePayNotification(note('com.kbcard.cxh.appcard', 'KB Pay', '11월 명세서', '결제 예정 금액 530,000원'))).toBeNull()
  })
})

describe('buildCandidates (같은 결제를 두 앱이 알려 주면 하나로)', () => {
  it('삼성 월렛 + 카드사 앱이 같은 결제를 알려 주면 하나로 합친다', () => {
    const wallet = note('com.samsung.android.spay', 'Samsung Wallet', '결제 완료', '₩6,100', '14:35')
    const card = note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '6,100원 일시불 11/17 14:35 스타벅스강남R점', '14:36')
    const ad = note('com.shcard.smartpay', '신한 SOL페이', '(광고) 이벤트', '10,000원 쿠폰', '14:40')
    const { candidates, skipped } = buildCandidates([card, wallet, ad])
    expect(candidates).toHaveLength(1)
    expect(candidates[0].ids.sort()).toEqual([wallet.id, card.id].sort())
    expect(candidates[0].guess).toMatchObject({ merchant: '스타벅스강남R점', account: '신한카드', amount: 6100 })
    expect(skipped).toEqual([ad.id])
  })

  it('금액이 같아도 시간이 멀면 따로', () => {
    const a = note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '4,500원 스타벅스', '09:00')
    const b = note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '4,500원 스타벅스', '15:00')
    expect(buildCandidates([a, b]).candidates).toHaveLength(2)
  })
})

describe('거르기 (기록하지 않을 알림)', () => {
  const card = note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '6,100원 일시불 11/17 14:35 스타벅스강남R점 누적 123,400원', '14:35')
  const small = note('com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '800원 일시불 11/17 15:00 CU역삼점', '15:00')
  const toss = note('viva.republica.toss', '토스', '결제 완료', '올리브영에서 23,800원 결제했어요', '16:00')
  const deposit = note('com.kakaobank.channel', '카카오뱅크', '입금 2,500,000원', '(주)타이디 급여', '17:00')
  const all = [card, small, toss, deposit]
  const left = (f: Partial<PayFilter>) => buildCandidates(all, { ...EMPTY_FILTER, ...f }).candidates.map((c) => c.source.id)

  it('낱말: 띄어쓰기·대소문자 상관없이 가게 이름이나 알림 글에 있으면 뺀다', () => {
    expect(left({ words: ['스타 벅스'] })).toEqual([small.id, toss.id, deposit.id])
    expect(left({ words: ['신한카드'] })).toEqual([toss.id, deposit.id])
  })
  it('앱 · 적은 금액 · 입금', () => {
    expect(left({ apps: [{ pkg: 'viva.republica.toss', name: '토스' }] })).toEqual([card.id, small.id, deposit.id])
    expect(left({ minAmount: 1000 })).toEqual([card.id, toss.id, deposit.id])
    expect(left({ skipDeposit: true })).toEqual([card.id, small.id, toss.id])
  })
  it('걸린 알림은 skipped 로 (확인 화면을 닫을 때 같이 지운다)', () => {
    expect(buildCandidates(all, { ...EMPTY_FILTER, minAmount: 1000 }).skipped).toEqual([small.id])
  })
  it('규칙 더하기는 같은 낱말 · 앱을 두 번 넣지 않는다', () => {
    const f = addApp(addWord(addWord(EMPTY_FILTER, '스타벅스'), ' 스타 벅스 '), 'a.b', 'AB')
    expect(f.words).toEqual(['스타벅스'])
    expect(addApp(f, 'a.b', 'AB').apps).toHaveLength(1)
  })
})

describe('입출금 알림 · 금액 (은행 · 카드 · 간편결제 여러 모양)', () => {
  const cases: [string, string, string, string, [string, number, string, string | null]][] = [
    // [패키지, 앱 이름, 제목, 글, [종류, 금액, 가게(보낸 사람), 결제 수단]]
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]11/17 13:05\n123456**789\n김채림\n출금\n50,000\n잔액1,230,000', ['EXPENSE', 50000, '출금', 'KB국민은행']],
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]11/17 13:05 123456**789 김채림 입금 2,500,000 (주)타이디 급여 잔액3,730,000', ['INCOME', 2500000, '(주)타이디 급여', 'KB국민은행']],
    ['com.kebhana.hanapush', '하나원큐', '하나은행', '하나 11/17 13:05 123-***456-78901 입금 25,000원 김철수 잔액 145,000원', ['INCOME', 25000, '김철수', '하나은행']],
    ['com.wooribank.smart.npib', '우리WON뱅킹', '우리은행', '우리 11/17 13:05 *1234 출금 50,000원 관리비 잔액 120,000원', ['EXPENSE', 50000, '관리비', '우리은행']],
    ['nh.smart.banking', 'NH스마트뱅킹', '농협', '농협 출금50,000원 11/17 13:05 352-****-1234-23 월세 잔액120,000원', ['EXPENSE', 50000, '월세', 'NH농협']],
    ['com.kakaobank.channel', '카카오뱅크', '출금', '김채림(1234) 12,000원 | 스타벅스', ['EXPENSE', 12000, '스타벅스', '카카오뱅크']],
    ['com.kakaobank.channel', '카카오뱅크', '입금', '홍길동 50,000원 → 내 입출금통장(1234)', ['INCOME', 50000, '홍길동', '카카오뱅크']],
    ['viva.republica.toss', '토스', '토스뱅크', '50,000원 입금 | 홍길동', ['INCOME', 50000, '홍길동', '토스뱅크']],
    ['viva.republica.toss', '토스', '송금 완료', '홍길동님께 50,000원을 보냈어요', ['EXPENSE', 50000, '홍길동', '토스']],
    ['viva.republica.toss', '토스', '돈이 들어왔어요', '홍길동님이 30,000원을 보냈어요', ['INCOME', 30000, '홍길동', '토스']],
    ['com.samsung.android.messaging', '메시지', '1544-7200', '[Web발신]\n신한 11/17 13:05\n110-***-123456\n이체출금 100,000\n김철수\n잔액 230,000', ['EXPENSE', 100000, '김철수', '신한은행']],
    ['kr.co.samsungcard.mpocket', '삼성카드', '삼성카드 승인', '김*림 120,000원 03개월 11/17 13:05 롯데하이마트 누적1,230,000원', ['EXPENSE', 120000, '롯데하이마트', '삼성카드']],
    ['com.kbcard.cxh.appcard', 'KB Pay', 'KB국민체크', '[KB국민체크]김*림님 11/17 13:05 6,100원 스타벅스 사용', ['EXPENSE', 6100, '스타벅스', 'KB국민카드']],
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]자동이체 출금 55,000원 SKT통신요금 잔액 1,175,000원', ['EXPENSE', 55000, 'SKT통신요금', 'KB국민은행']],
    ['com.shinhan.sbanking', '신한 SOL뱅크', '신한은행', '이자 입금 1,234원 잔액 1,231,234원', ['INCOME', 1234, '이자', '신한은행']],
    ['com.shinhan.sbanking', '신한 SOL뱅크', '신한은행', '잔액 1,230,000원 | 출금 5000원 GS25', ['EXPENSE', 5000, 'GS25', '신한은행']],
    ['com.ibk.android.ionebank', 'i-ONE Bank', 'IBK기업은행', '[IBK]11/17 13:05 출금 33,000 쿠팡 잔액 1,000,000', ['EXPENSE', 33000, '쿠팡', 'IBK기업은행']],
    ['com.kbankwith.smartbank', '케이뱅크', '케이뱅크', '입금 | 200,000원\n보낸 분: 홍길동\n잔액 1,200,000원', ['INCOME', 200000, '홍길동', '케이뱅크']],
    ['com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '김*림 6,100원 일시불 11/17 13:05 (주)스타벅스코리아 누적 123,400원 잔여한도 2,000,000원', ['EXPENSE', 6100, '(주)스타벅스코리아', '신한카드']],
  ]
  for (const [pkg, app, title, text, want] of cases) {
    it(`${title} | ${text.replace(/\n/g, ' ').slice(0, 40)}`, () => {
      const g = parsePayNotification({ id: 'x', pkg, app, title, text, postedAt: at('13:06') })
      expect(g && [g.type, g.amount, g.merchant, g.account]).toEqual(want)
    })
  }

  it('잔액 · 누적 · 한도 · 계좌번호 숫자는 금액으로 고르지 않는다', () => {
    const g = parsePayNotification(note('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '잔액 3,000,000 누적 900,000 [KB] 123-45-678901 출금 7,700 편의점'))
    expect(g?.amount).toBe(7700)
  })
  it('급여 입금은 월급, 승인 취소는 수입(환불)', () => {
    expect(parsePayNotification(note('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '입금 2,500,000원 (주)타이디 급여'))?.category).toBe('월급')
    expect(parsePayNotification(note('com.hyundaicard.appcard', '현대카드', '현대카드', '[현대카드] 승인취소 김*림 6,100원 11/17 13:05 스타벅스'))).toMatchObject({ type: 'INCOME', amount: 6100, merchant: '스타벅스' })
  })
  it('외화 결제와 페이머니 충전은 빼기 (얼마 나갔는지 원으로 알 수 없거나, 내 돈을 옮긴 것)', () => {
    expect(parsePayNotification(note('com.samsung.android.messaging', '메시지', '15447200', '[Web발신]\n신한카드(1234)승인 김*림 USD 12.99 11/17 13:05 NETFLIX.COM'))).toBeNull()
    expect(parsePayNotification(note('com.kakaopay.app', '카카오페이', '카카오페이', '카카오페이머니 10,000원이 충전되었습니다'))).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { buildCandidates, parsePayNotification, type PayNotification } from '../../src/lib/payNotify'
import { addApp, addWord, EMPTY_FILTER, type PayFilter } from '../../src/lib/payNotifyFilter'

const at = (hourMinute: string, day = '2026-11-17') => new Date(`${day}T${hourMinute}:00`).getTime()
const notice = (pkg: string, app: string, title: string, text: string, time = '14:35'): PayNotification => ({ id: `${pkg}-${time}-${title}`, pkg, app, title, text, postedAt: at(time) })
/** 알림에서 읽은 [종류, 가게, 금액, 날짜, 시각, 결제 수단, 카테고리] */
const readFields = (item: PayNotification) => {
  const guess = parsePayNotification(item)
  return guess && [guess.type, guess.merchant, guess.amount, guess.date, guess.time, guess.account, guess.category]
}
const SHINHAN_APP = ['com.shcard.smartpay', '신한 SOL페이'] as const
const WALLET = ['com.samsung.android.spay', 'Samsung Wallet'] as const

describe('parsePayNotification (결제 알림 → 가계부 후보)', () => {
  it('카드사 앱 승인 알림에서 가게 · 금액 · 날짜 · 시각 · 카드를 읽고 카테고리를 고른다', () => {
    const item = notice(...SHINHAN_APP, '신한카드 승인', '6,100원 일시불\n11/17 14:35 스타벅스강남R점\n누적 123,400원')

    expect(readFields(item)).toEqual(['EXPENSE', '스타벅스강남R점', 6100, '2026-11-17', '14:35', '신한카드', '식비'])
  })

  it('메시지 앱의 카드 결제 문자도 읽는다', () => {
    const item = notice('com.samsung.android.messaging', '메시지', '15881688', '[Web발신]\nKB국민카드1234승인\n김*림\n12,000원 일시불\n11/16 19:02\nCU역삼점\n누적530,000원')

    expect(readFields(item)).toEqual(['EXPENSE', 'CU역삼점', 12000, '2026-11-16', '19:02', 'KB국민카드', '식비'])
  })

  it('삼성 월렛은 ₩ 금액을 읽고, 글에 시각이 없으면 알림이 온 시각을 쓴다', () => {
    const item = notice(...WALLET, '결제 완료', '₩4,500 · 다이소 강남점', '09:12')

    expect(readFields(item)).toEqual(['EXPENSE', '다이소 강남점', 4500, '2026-11-17', '09:12', '삼성페이', '쇼핑'])
  })

  it('삼성 월렛 알림 제목이 카드 이름이면 그 카드를 결제 수단으로 쓴다', () => {
    const item = notice(...WALLET, '현대카드', '₩4,500 결제 완료\nGS25 역삼점', '09:12')

    expect(readFields(item)?.[5]).toBe('현대카드')
  })

  it('토스 "○○에서 ○원 결제했어요" 를 읽는다', () => {
    const item = notice('viva.republica.toss', '토스', '결제 완료', '올리브영 명동점에서 23,800원 결제했어요', '19:40')

    expect(readFields(item)).toEqual(['EXPENSE', '올리브영 명동점', 23800, '2026-11-17', '19:40', '토스', '쇼핑'])
  })

  it.each([
    ['카카오페이 결제', notice('com.kakaopay.app', '카카오페이', '카카오페이', '배달의민족에서 18,900원을 결제했어요', '12:05'), ['EXPENSE', '배달의민족', 18900]],
    ['은행 입금', notice('com.kakaobank.channel', '카카오뱅크', '입금 2,500,000원', '(주)타이디 급여 | 잔액 3,120,000원', '09:00'), ['INCOME', '타이디 급여', 2500000]],
    ['은행 출금', notice('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '출금 50,000원 월세 잔액 70,000원', '10:00'), ['EXPENSE', '월세', 50000]],
    ['승인 취소는 수입(환불)', notice(...SHINHAN_APP, '신한카드 승인취소', '6,100원 11/17 15:00 스타벅스강남R점'), ['INCOME', '스타벅스강남R점', 6100]],
  ])('%s 알림의 종류 · 가게 · 금액을 읽는다', (_case, item, fields) => {
    expect(readFields(item)?.slice(0, 3)).toEqual(fields)
  })

  it.each([
    ['광고', notice(...SHINHAN_APP, '(광고) 최대 10,000원 캐시백', '지금 결제하면 혜택')],
    ['명세서 안내', notice('com.kbcard.cxh.appcard', 'KB Pay', '11월 명세서', '결제 예정 금액 530,000원')],
  ])('%s 알림은 가계부 후보에서 뺀다', (_case, item) => {
    expect(parsePayNotification(item)).toBeNull()
  })
})

describe('buildCandidates (같은 결제를 두 앱이 알려 주면 하나로)', () => {
  it('삼성 월렛 + 카드사 앱이 같은 결제를 알려 주면 하나로 합치고 광고는 건너뛴다', () => {
    const wallet = notice(...WALLET, '결제 완료', '₩6,100', '14:35')
    const card = notice(...SHINHAN_APP, '신한카드 승인', '6,100원 일시불 11/17 14:35 스타벅스강남R점', '14:36')
    const ad = notice(...SHINHAN_APP, '(광고) 이벤트', '10,000원 쿠폰', '14:40')

    const { candidates, skipped } = buildCandidates([card, wallet, ad])

    expect(candidates).toHaveLength(1)
    expect(candidates[0].ids.sort()).toEqual([wallet.id, card.id].sort())
    expect(candidates[0].guess).toMatchObject({ merchant: '스타벅스강남R점', account: '신한카드', amount: 6100 })
    expect(skipped).toEqual([ad.id])
  })

  it('금액이 같아도 6시간 떨어진 결제는 따로 둔다', () => {
    const morning = notice(...SHINHAN_APP, '신한카드 승인', '4,500원 스타벅스', '09:00')
    const afternoon = notice(...SHINHAN_APP, '신한카드 승인', '4,500원 스타벅스', '15:00')

    expect(buildCandidates([morning, afternoon]).candidates).toHaveLength(2)
  })
})

describe('거르기 (기록하지 않을 알림)', () => {
  const card = notice(...SHINHAN_APP, '신한카드 승인', '6,100원 일시불 11/17 14:35 스타벅스강남R점 누적 123,400원', '14:35')
  const small = notice(...SHINHAN_APP, '신한카드 승인', '800원 일시불 11/17 15:00 CU역삼점', '15:00')
  const toss = notice('viva.republica.toss', '토스', '결제 완료', '올리브영에서 23,800원 결제했어요', '16:00')
  const deposit = notice('com.kakaobank.channel', '카카오뱅크', '입금 2,500,000원', '(주)타이디 급여', '17:00')
  const all = [card, small, toss, deposit]
  const left = (filter: Partial<PayFilter>) => buildCandidates(all, { ...EMPTY_FILTER, ...filter }).candidates.map((candidate) => candidate.source.id)

  it.each([
    ['가게 이름 (띄어쓰기 달라도)', { words: ['스타 벅스'] }, [small.id, toss.id, deposit.id]],
    ['알림 글', { words: ['신한카드'] }, [toss.id, deposit.id]],
  ])('거를 낱말이 %s 에 있으면 뺀다', (_case, filter, ids) => {
    expect(left(filter)).toEqual(ids)
  })

  it.each([
    ['거를 앱(토스)', { apps: [{ pkg: 'viva.republica.toss', name: '토스' }] }, [card.id, small.id, deposit.id]],
    ['1,000원보다 적은 금액', { minAmount: 1000 }, [card.id, toss.id, deposit.id]],
    ['입금 건너뛰기', { skipDeposit: true }, [card.id, small.id, toss.id]],
  ])('%s 규칙에 걸린 알림은 뺀다', (_case, filter, ids) => {
    expect(left(filter)).toEqual(ids)
  })

  it('걸린 알림은 skipped 로 준다 (확인 화면을 닫을 때 같이 지운다)', () => {
    expect(buildCandidates(all, { ...EMPTY_FILTER, minAmount: 1000 }).skipped).toEqual([small.id])
  })

  it('규칙 더하기는 같은 낱말(띄어쓰기 달라도) · 같은 앱을 두 번 넣지 않는다', () => {
    const filter = addApp(addWord(addWord(EMPTY_FILTER, '스타벅스'), ' 스타 벅스 '), 'a.b', 'AB')

    expect(filter.words).toEqual(['스타벅스'])
    expect(addApp(filter, 'a.b', 'AB').apps).toHaveLength(1)
  })
})

describe('입출금 알림 · 금액 (은행 · 카드 · 간편결제 여러 모양)', () => {
  const cases: [string, string, string, string, [string, number, string, string | null]][] = [
    // [패키지, 앱 이름, 제목, 글, [종류, 금액, 가게(보낸 사람), 결제 수단]]
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]11/17 13:05\n123456**789\n김채림\n출금\n50,000\n잔액1,230,000', ['EXPENSE', 50000, '출금', 'KB국민은행']],
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]11/17 13:05 123456**789 김채림 입금 2,500,000 (주)타이디 급여 잔액3,730,000', ['INCOME', 2500000, '타이디 급여', 'KB국민은행']],
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
    ['com.shcard.smartpay', '신한 SOL페이', '신한카드 승인', '김*림 6,100원 일시불 11/17 13:05 (주)스타벅스코리아 누적 123,400원 잔여한도 2,000,000원', ['EXPENSE', 6100, '스타벅스코리아', '신한카드']],
  ]
  const short = (text: string) => text.replace(/\n/g, ' ').slice(0, 40)

  it.each(cases.map(([pkg, app, title, text, fields]) => [title, short(text), { pkg, app, title, text }, fields] as const))('%s | %s 알림의 종류 · 금액 · 가게 · 결제 수단을 읽는다', (_title, _text, item, fields) => {
    const guess = parsePayNotification({ id: 'x', ...item, postedAt: at('13:06') })

    expect(guess && [guess.type, guess.amount, guess.merchant, guess.account]).toEqual(fields)
  })

  it('잔액 · 누적 · 한도 · 계좌번호 숫자는 금액으로 고르지 않는다', () => {
    const guess = parsePayNotification(notice('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '잔액 3,000,000 누적 900,000 [KB] 123-45-678901 출금 7,700 편의점'))

    expect(guess?.amount).toBe(7700)
  })

  it('급여 입금은 월급 카테고리로 넣는다', () => {
    const guess = parsePayNotification(notice('com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '입금 2,500,000원 (주)타이디 급여'))

    expect(guess?.category).toBe('월급')
  })

  it('카드 승인 취소 문자는 수입(환불)으로 넣는다', () => {
    const guess = parsePayNotification(notice('com.hyundaicard.appcard', '현대카드', '현대카드', '[현대카드] 승인취소 김*림 6,100원 11/17 13:05 스타벅스'))

    expect(guess).toMatchObject({ type: 'INCOME', amount: 6100, merchant: '스타벅스' })
  })

  it.each([
    ['외화 결제 (원으로 얼마인지 모름)', notice('com.samsung.android.messaging', '메시지', '15447200', '[Web발신]\n신한카드(1234)승인 김*림 USD 12.99 11/17 13:05 NETFLIX.COM')],
    ['페이머니 충전 (내 돈을 옮긴 것)', notice('com.kakaopay.app', '카카오페이', '카카오페이', '카카오페이머니 10,000원이 충전되었습니다')],
  ])('%s 알림은 가계부 후보에서 뺀다', (_case, item) => {
    expect(parsePayNotification(item)).toBeNull()
  })
})

describe('기록 이름은 출금처(가게 · 받는 사람)만', () => {
  const cases: [string, string, string, string, string][] = [
    // [패키지, 앱 이름, 제목, 글, 기록 이름]
    ['com.shcard.smartpay', '신한카드', '신한카드 승인', '신한카드(1234)승인 김*림 6,100원(일시불)11/17 14:35 스타벅스강남R점 누적123,400원', '스타벅스강남R점'],
    ['com.shcard.smartpay', '신한 SOL페이', '결제 승인', '6,100원 일시불 | 다이소 운남점', '다이소 운남점'],
    ['com.kbcard.cxh.appcard', 'KB Pay', 'KB국민카드 승인', 'KB국민카드1*2*승인 김*림님 12,000원 일시불 11/17 13:05 (주)올리브영 누적 1,234,000원', '올리브영'],
    ['com.samsung.android.spay', 'Samsung Wallet', '삼성카드', '₩6,100 결제 완료 · 롯데리아 운남점', '롯데리아 운남점'],
    ['com.samsung.android.spay', 'Samsung Wallet', '결제 완료', '삼성카드로 ₩4,500을 결제했습니다. 가맹점: GS25 운남점', 'GS25 운남점'],
    ['com.hyundaicard.appcard', '현대카드', '현대카드 승인', '김*림님, 현대카드 M 승인 23,500원 일시불 다이소 운남점', '다이소 운남점'],
    ['com.hyundaicard.appcard', '현대카드', '[현대카드]', '[현대카드] 승인 김*림 23,500원 일시불 11/17 13:05 쿠팡(쿠페이) 누적 500,000원', '쿠팡'],
    ['com.lcacApp', '롯데카드', '롯데카드 결제', '롯데카드 승인 9,900원 일시불 11.17 18:20 롯데리아 첨단점', '롯데리아 첨단점'],
    ['com.wooricard.smartapp', '우리WON카드', '우리카드 승인', '[우리카드] 승인 4,500원 일시불 11/17 08:10 메가엠지씨커피 운남점 누적 300,000원 잔여한도 2,700,000원', '메가엠지씨커피 운남점'],
    ['com.hanaskcard.paycli', '하나Pay', '하나카드', '하나카드 승인 김*림님 15,000원 일시불 11/17 12:30 버거킹 광주수완점', '버거킹 광주수완점'],
    ['nh.smart.nhallonepay', 'NH pay', 'NH농협카드', 'NH카드 승인 김*림 8,000원 체크 11/17 12:00 이마트24 운남점 잔액 1,000,000원', '이마트24 운남점'],
    ['com.kakaobank.channel', '카카오뱅크', '카카오뱅크', '[카카오뱅크] 김*림님 체크카드 결제 6,100원 다이소 운남점 잔액 200,000원', '다이소 운남점'],
    ['com.kakaobank.channel', '카카오뱅크', '출금', '홍길동님에게 30,000원을 보냈어요.', '홍길동'],
    ['viva.republica.toss', '토스', '결제 완료', '다이소 운남점에서 6,100원 결제했어요', '다이소 운남점'],
    ['viva.republica.toss', '토스', '토스뱅크 체크카드', '6,100원 결제 | 올리브영 수완점', '올리브영 수완점'],
    ['viva.republica.toss', '토스', '송금 완료', '홍길동님께 30,000원 송금했어요', '홍길동'],
    ['com.kbstar.kbbank', 'KB스타뱅킹', 'KB국민은행', '[KB]11/17 13:05 123456**789 김채림 출금 50,000 잔액 1,234,567 다이소운남', '다이소운남'],
    ['com.shinhan.sbanking', '신한 SOL뱅크', '신한은행', '신한 11/17 13:05 110-***-123456 출금 6,100 잔액 200,000 롯데리아수완', '롯데리아수완'],
    ['com.wooribank.smart.npib', '우리WON뱅킹', '우리은행', '우리 11/17 13:05 *123456 출금 12,000원 GS25운남점 잔액 88,000원', 'GS25운남점'],
    ['com.nhbank.nhsmart', 'NH스마트뱅킹', '농협', '농협 출금6,100원 11/17 13:05 352-****-1234-11 CU운남점 잔액200,000원', 'CU운남점'],
    ['com.kakaopay.app', '카카오페이', '카카오페이', '카카오페이머니 6,100원 결제 완료 | 스타벅스', '스타벅스'],
    ['com.kakaopay.app', '카카오페이', '결제 완료', '[카카오페이] 쿠팡이츠에서 23,000원 결제가 완료되었습니다.', '쿠팡이츠'],
    ['com.nhn.android.search', '네이버', '네이버페이', '네이버페이 결제 완료 34,900원 무신사 스토어', '무신사 스토어'],
    ['com.android.mms', '메시지', '15881688', '[Web발신]\nKB국민체크(1*2*)\n김*림님\n11/17 13:05\n6,100원\n다이소운남점 사용', '다이소운남점'],
    ['com.samsung.android.messaging', '메시지', '15447200', '[Web발신]\n신한카드(1234)승인\n김*림\n23,500원(일시불)\n11/17 13:05\n올리브영 수완점\n누적1,234,000원', '올리브영 수완점'],
    ['com.samsung.android.messaging', '메시지', '16449999', '[Web발신]\n삼성1234승인 김*림\n9,900원 일시불\n11/17 13:05 롯데리아\n누적500,000원', '롯데리아'],
    ['com.samsung.android.messaging', '메시지', '15881600', '[Web발신]\n[하나]11/17 13:05\n123-******-12345\n출금 6,100원\n(주)다이소\n잔액 100,000원', '다이소'],
    ['com.kbstar.kbbank', 'KB스타뱅킹', '체크카드 사용', '6,100원 사용 다이소 운남점 (KB국민체크 1234) 잔액 200,000원', '다이소 운남점'],
    ['com.shinhan.sbanking', '신한 SOL뱅크', '이체', '[신한은행] 김채림님 계좌에서 50,000원 이체출금 받는분: 홍길동 잔액 150,000원', '홍길동'],
    ['com.kakaobank.channel', '카카오뱅크', '자동이체', '자동이체 출금 55,000원 SKT 통신요금 잔액 100,000원', 'SKT 통신요금'],
  ]
  it.each(cases.map(([pkg, app, title, text, merchant]) => [merchant, text.replace(/\n/g, ' ').slice(0, 40), { pkg, app, title, text }] as const))('기록 이름은 "%s" 만 남긴다 | %s', (merchant, _text, item) => {
    expect(parsePayNotification({ id: 'x', ...item, postedAt: at('13:06') })?.merchant).toBe(merchant)
  })
})

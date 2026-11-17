// 결제 알림 → 가계부 후보 (폰 앱에서 PayNotifyService.java 가 모아 둔 알림을 읽는다). AI 없이 규칙으로만.
// 지원하는 모양 (예)
// - 카드사 앱: 제목 "신한카드 승인" / 글 "6,100원 일시불 11/17 14:35 스타벅스강남R점 누적 123,400원"
// - 삼성 월렛: 제목 "결제 완료" / 글 "₩6,100 · 신한카드 · 스타벅스 강남점"
// - 토스·카카오페이: "스타벅스에서 6,100원 결제했어요"
// - 은행 앱: "출금 6,100원 스타벅스 잔액 120,000원" / "입금 2,500,000원 (주)회사 급여"
// - 카드 결제 문자: "[Web발신] KB국민카드1234승인 김*림 6,100원 일시불 11/17 14:35 스타벅스 누적…"
import type { PaymentGuess } from './ai/assistant'
import { toDateKey } from './date'
import { matchMerchant } from './merchants'
import { findAccount, guessCategory } from './ocr/bankText'
import { readPayText, timeOf } from './payNotifyText'
import { findLast4 } from './payMethods'
import { blockReason, type PayFilter } from './payNotifyFilter'

/** PayNotifyService.java 가 모아 둔 알림 하나 */
export interface PayNotification {
  id: string
  /** 알림을 보낸 앱 패키지 */
  pkg: string
  /** 알림을 보낸 앱 이름 (폰에 보이는 이름) */
  app: string
  title: string
  text: string
  /** 알림이 온 시각 (ms) */
  postedAt: number
}

/** 앱 이름을 결제 수단으로 (글에 카드 이름이 없을 때) */
const APP_ACCOUNTS: [RegExp, string][] = [
  [/samsung\.android\.spay|samsungpay|wallet/i, '삼성페이'],
  [/viva\.republica\.toss/i, '토스'],
  [/kakaopay/i, '카카오페이'],
  [/kakaobank/i, '카카오뱅크'],
  [/naverpay|naver\.pay/i, '네이버페이'],
]

/** 은행 문자의 짧은 이름 ("신한 11/17 13:05 출금…", "[KB]", "농협 출금…") */
const BANK_SHORT: [RegExp, string][] = [
  [/(^|[\s[])(신한)(?=[\s\]]|$)/, '신한은행'],
  [/(^|[\s[])(kb|국민)(?=[\s\]]|$)/i, 'KB국민은행'],
  [/(^|[\s[])(우리)(?=[\s\]]|$)/, '우리은행'],
  [/(^|[\s[])(하나)(?=[\s\]]|$)/, '하나은행'],
  [/(^|[\s[])(nh|농협)/i, 'NH농협'],
  [/(^|[\s[])(ibk|기업)(?=[\s\]]|$)/i, 'IBK기업은행'],
  [/(^|[\s[])(sc|제일)(?=[\s\]]|$)/i, 'SC제일은행'],
]

/** 결제가 아닌 알림 (광고, 혜택 안내, 한도·명세서 안내) */
const NOT_PAYMENT = /\(광고\)|광고|이벤트|혜택|쿠폰|추첨|당첨|최대|프로모션|명세서|청구\s*예정|결제\s*예정|자동\s*납부\s*예정|한도\s*(안내|변경)|인증\s*번호|비밀\s*번호/

/** 알림 하나 → 가계부 후보 (결제 · 입출금 알림이 아니면 null) */
export function parsePayNotification(n: PayNotification): PaymentGuess | null {
  const all = `${n.title}\n${n.text}`
  if (NOT_PAYMENT.test(all)) return null
  const posted = new Date(n.postedAt)
  const r = readPayText(n.title, n.text, toDateKey(posted))
  if (!r) return null
  const cancel = /승인\s*취소|결제\s*취소|취소\s*(승인|완료)|환불|매출\s*취소/.test(all)
  const brand = matchMerchant(r.merchant)
  const category =
    r.type === 'INCOME' ? (cancel ? '기타' : /급여|월급|상여/.test(all) ? '월급' : /용돈/.test(all) ? '용돈' : '기타') : (brand?.brand.category ?? guessCategory(r.merchant))
  const account = findAccount(all) ?? findAccount(n.app) ?? BANK_SHORT.find(([re]) => re.test(all))?.[1] ?? APP_ACCOUNTS.find(([re]) => re.test(n.pkg) || re.test(n.app))?.[1] ?? null
  // 카드 · 계좌 끝 4자리 (내 카드 · 계좌에 등록한 것과 맞춰 본다)
  const last4 = findLast4(all)
  return {
    type: r.type,
    merchant: r.merchant,
    amount: r.amount,
    // 글에 날짜 · 시각이 없으면 알림이 온 때
    date: r.date ?? toDateKey(posted),
    time: r.time ?? timeOf(n.postedAt),
    account,
    ...(last4 ? { last4 } : {}),
    category,
  }
}

export interface PayCandidate {
  guess: PaymentGuess
  /** 이 후보를 만든 알림들 (삼성 월렛과 카드사 앱이 같은 결제를 두 번 알려 주면 하나로 합친다) */
  ids: string[]
  /** 처음 온 알림 (화면에 원래 글을 보여 줄 때) */
  source: PayNotification
}

/** 같은 결제를 여러 앱이 알려 주는 일이 많다: 금액·종류가 같고 3분 안이면 하나로 */
const SAME_WINDOW = 3 * 60 * 1000

/** 모아 둔 알림들 → 가계부 후보 목록 (결제가 아니거나 거르기에 걸린 알림의 id 는 skipped 로) */
export function buildCandidates(items: PayNotification[], filter?: PayFilter): { candidates: PayCandidate[]; skipped: string[] } {
  const candidates: PayCandidate[] = []
  const skipped: string[] = []
  for (const n of [...items].sort((a, b) => a.postedAt - b.postedAt)) {
    const guess = parsePayNotification(n)
    if (!guess || (filter && blockReason(filter, n, guess))) {
      skipped.push(n.id)
      continue
    }
    const same = candidates.find((c) => c.guess.amount === guess.amount && c.guess.type === guess.type && Math.abs(c.source.postedAt - n.postedAt) <= SAME_WINDOW)
    if (same) {
      same.ids.push(n.id)
      // 이름이 "결제"뿐이거나 카드 이름이 없던 쪽을 더 자세한 쪽으로 채운다
      if (/^(결제|입금|출금)$/.test(same.guess.merchant) && !/^(결제|입금|출금)$/.test(guess.merchant)) same.guess = { ...same.guess, merchant: guess.merchant, category: guess.category }
      if (!same.guess.account || same.guess.account === '삼성페이') same.guess = { ...same.guess, account: guess.account ?? same.guess.account }
      if (!same.guess.last4 && guess.last4) same.guess = { ...same.guess, last4: guess.last4 }
      continue
    }
    candidates.push({ guess, ids: [n.id], source: n })
  }
  return { candidates, skipped }
}

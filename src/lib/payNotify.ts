// 결제 알림 → 가계부 후보 (폰 앱에서 PayNotifyService.java 가 모아 둔 알림을 읽는다). AI 없이 규칙으로만.
// 지원하는 모양 (예)
// - 카드사 앱: 제목 "신한카드 승인" / 글 "6,100원 일시불 11/17 14:35 스타벅스강남R점 누적 123,400원"
// - 삼성 월렛: 제목 "결제 완료" / 글 "₩6,100 · 신한카드 · 스타벅스 강남점"
// - 토스·카카오페이: "스타벅스에서 6,100원 결제했어요"
// - 은행 앱: "출금 6,100원 스타벅스 잔액 120,000원" / "입금 2,500,000원 (주)회사 급여"
// - 카드 결제 문자: "[Web발신] KB국민카드1234승인 김*림 6,100원 일시불 11/17 14:35 스타벅스 누적…"
import type { PaymentGuess } from './ai/assistant'
import { toDateKey } from './date'
import { findAccount, parseBankText } from './ocr/bankText'
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

/** 결제가 아닌 알림 (광고, 혜택 안내, 한도·명세서 안내) */
const NOT_PAYMENT = /\(광고\)|광고|이벤트|혜택|쿠폰|추첨|당첨|최대|프로모션|명세서|청구\s*예정|결제\s*예정|자동\s*납부\s*예정|한도\s*(안내|변경)|인증\s*번호|비밀\s*번호/

/** 알림 글을 bankText 가 읽기 좋은 모양으로: 알림 하나는 결제 하나라서 한 줄로 잇는다 */
function prepare(title: string, text: string): string {
  // 문자 알림 제목은 보낸 번호 (예: 15881688)
  const head = /^[\d\s+\-#]+$/.test(title) ? '' : title
  return `${head} ${text}`
    .replace(/\s*\n\s*/g, ' ')
    // 카드 뒷자리 (KB국민카드1234승인, 신한카드*1234)
    .replace(/(카드|은행|뱅크|페이)\s*[*(]?\d{3,4}\)?(?![\d,]*\s*원)/g, '$1 ')
    .replace(/[₩￦]\s*([\d,]+)/g, '$1원')
    .replace(/KRW\s*([\d,]+)/gi, '$1원')
    .replace(/([가-힣a-zA-Z0-9)])에서\s+(?=\d)/g, '$1 ')
    .replace(/([가-힣a-zA-Z0-9)])에서\s*(결제|사용|구매)/g, '$1 $2')
    .replace(/(결제|사용|출금|입금|이체)\s*(했어요|했습니다|되었습니다|됐어요|완료되었습니다|완료)/g, '$1')
    .replace(/(?<=\d)\s*원\s*을/g, '원')
}

/** 알림 하나 → 가계부 후보 (결제 알림이 아니면 null) */
export function parsePayNotification(n: PayNotification): PaymentGuess | null {
  const all = `${n.title}\n${n.text}`
  if (NOT_PAYMENT.test(all)) return null
  const posted = new Date(n.postedAt)
  const today = toDateKey(posted)
  const parsed = parseBankText(prepare(n.title, n.text), today)
  // 첫 번째 금액이 결제 금액 (잔액·누적은 bankText 가 이미 뺐다)
  const p = parsed.payments[0]
  if (!p) return null
  const cancel = /승인\s*취소|결제\s*취소|취소\s*승인|환불/.test(all)
  const account = p.account ?? findAccount(n.app) ?? APP_ACCOUNTS.find(([re]) => re.test(n.pkg) || re.test(n.app))?.[1] ?? null
  return {
    ...p,
    type: cancel ? 'INCOME' : p.type,
    category: cancel ? '기타' : p.category,
    account,
    // 글에 시각이 없으면 알림이 온 시각
    time: p.time ?? `${String(posted.getHours()).padStart(2, '0')}:${String(posted.getMinutes()).padStart(2, '0')}`,
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
      if (/^(결제|입금)$/.test(same.guess.merchant) && !/^(결제|입금)$/.test(guess.merchant)) same.guess = { ...same.guess, merchant: guess.merchant, category: guess.category }
      if (!same.guess.account || same.guess.account === '삼성페이') same.guess = { ...same.guess, account: guess.account ?? same.guess.account }
      continue
    }
    candidates.push({ guess, ids: [n.id], source: n })
  }
  return { candidates, skipped }
}

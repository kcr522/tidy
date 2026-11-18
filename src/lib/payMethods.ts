// 내 카드 · 계좌: 어떤 카드나 계좌로 썼는지 구분한다 (사용자 요청 2026-11-17)
// 내역에는 이름(Transaction.account)으로 들어가고, 등록한 카드 · 계좌는 종류와 끝 4자리를 더 안다.
import type { PayMethod, PayMethodKind } from '../db/types'
import { accountEmoji } from './accounts'

export const PAY_METHOD_KINDS: PayMethodKind[] = ['card', 'account', 'pay', 'cash']

export const PAY_KIND_LABEL: Record<PayMethodKind, string> = { card: '카드', account: '계좌', pay: '간편결제', cash: '현금' }

export const PAY_KIND_EMOJI: Record<PayMethodKind, string> = { card: '💳', account: '🏦', pay: '📱', cash: '💵' }

export const MAX_PAY_METHOD_NAME = 20

/** 이름만 보고 종류 짐작 (신한카드 → 카드, 토스뱅크 → 계좌) */
export function guessKind(name: string): PayMethodKind {
  const e = accountEmoji(name.trim())
  return e === '💵' ? 'cash' : e === '📱' ? 'pay' : e === '🏦' ? 'account' : 'card'
}

/** 결제 수단 이름의 그림: 등록한 것이면 그 종류로, 아니면 이름으로 짐작 */
export function methodEmoji(name: string, methods: PayMethod[] = []): string {
  const m = methods.find((x) => x.name === name)
  return m ? PAY_KIND_EMOJI[m.kind] : accountEmoji(name)
}

/** 화면에 보여 줄 이름: "신한 체크 ··1234" */
export function methodLabel(m: Pick<PayMethod, 'name' | 'last4'>): string {
  return m.last4 ? `${m.name} ··${m.last4}` : m.name
}

/** "1234", "**** 1234" → "1234". 숫자 4개가 아니면 undefined */
export function cleanLast4(text: string | undefined | null): string | undefined {
  const d = (text ?? '').replace(/\D/g, '')
  return d.length >= 4 ? d.slice(-4) : undefined
}

/**
 * 알림 · 문자에서 카드 번호 · 계좌 번호 끝 4자리 찾기
 * "KB국민카드1234승인", "신한체크(1234)", "삼성카드 [1234]", "110-***-123456", "계좌(*5678)"
 */
export function findLast4(text: string): string | undefined {
  const t = text.replace(/\s+/g, ' ')
  const patterns = [
    /(?:카드|체크|신용|card)\s*[([]?\s*\*{0,8}(\d{4})(?!\d)/i,
    /[([]\s*\*{0,8}(\d{4})\s*[)\]]/,
    /\d{2,6}-[\d*]{1,8}-[\d*]*?(\d{4})(?!\d)/,
    /\*{2,}-?(\d{4})(?!\d)/,
  ]
  for (const re of patterns) {
    const m = re.exec(t)
    if (m) return m[1]
  }
  return undefined
}

/** 카드사 · 은행 · 앱 이름의 공통 부분 (신한카드와 신한 체크, KB국민은행과 국민 월급통장을 같은 곳으로 본다) */
const BRANDS: [RegExp, string][] = [
  [/신한/, '신한'],
  [/kb|국민/i, '국민'],
  [/삼성페이|samsung\s*pay/i, '삼성페이'],
  [/삼성/, '삼성'],
  [/현대/, '현대'],
  [/우리/, '우리'],
  [/하나/, '하나'],
  [/롯데/, '롯데'],
  [/nh|농협/i, '농협'],
  [/bc|비씨/i, 'BC'],
  [/ibk|기업/i, '기업'],
  [/sc|제일/i, '제일'],
  [/씨티|citi/i, '씨티'],
  [/카카오\s*뱅크|kakao\s*bank/i, '카카오뱅크'],
  [/카카오/, '카카오'],
  [/토스\s*뱅크/, '토스뱅크'],
  [/토스|toss/i, '토스'],
  [/케이\s*뱅크|k\s*bank/i, '케이뱅크'],
  [/네이버|naver/i, '네이버'],
  [/페이코|payco/i, '페이코'],
  [/새마을|mg/i, '새마을'],
  [/우체국/, '우체국'],
  [/수협/, '수협'],
  [/부산/, '부산'],
  [/대구|im\s*뱅크/i, '대구'],
  [/광주/, '광주'],
  [/전북/, '전북'],
  [/경남/, '경남'],
  [/제주/, '제주'],
  [/현금/, '현금'],
]

export function brandOf(name: string): string | undefined {
  return BRANDS.find(([re]) => re.test(name))?.[1]
}

/**
 * 알림에서 읽은 카드 · 계좌 이름과 끝 4자리 → 내가 등록한 카드 · 계좌
 * 1) 끝 4자리가 같은 것  2) 이름이 같은 것  3) 같은 회사 · 같은 종류가 하나뿐인 것
 * 헷갈리면 (같은 회사 카드가 둘) 고르지 않는다
 */
export function pickPayMethod(methods: PayMethod[], account: string | null | undefined, last4?: string | null): PayMethod | undefined {
  if (methods.length === 0) return undefined
  const name = account?.trim() ?? ''
  const brand = name ? brandOf(name) : undefined
  if (last4) {
    const byDigits = methods.filter((m) => m.last4 === last4)
    if (byDigits.length === 1) return byDigits[0]
    const both = byDigits.filter((m) => brand && brandOf(m.name) === brand)
    if (both.length === 1) return both[0]
  }
  if (!name) return undefined
  const same = methods.find((m) => m.name === name)
  if (same) return same
  if (!brand) return undefined
  const kind = guessKind(name)
  const sameBrand = methods.filter((m) => brandOf(m.name) === brand && m.kind === kind)
  return sameBrand.length === 1 ? sameBrand[0] : undefined
}

/** 고르는 칸에 보여 줄 순서: 등록한 것(종류별 → 순서), 그다음 기록에만 있는 이름 */
export function groupMethods(methods: PayMethod[]): { kind: PayMethodKind; items: PayMethod[] }[] {
  return PAY_METHOD_KINDS.map((kind) => ({ kind, items: methods.filter((m) => m.kind === kind).sort((a, b) => a.order - b.order) })).filter((g) => g.items.length > 0)
}

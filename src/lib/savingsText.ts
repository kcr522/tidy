import { addMonthsKey } from './savings'
import type { SavingsDraft } from './ai/savingsPrompt'

export type { SavingsDraft }

const BANKS = ['카카오뱅크', '토스뱅크', '케이뱅크', '국민은행', 'KB국민', '신한은행', '우리은행', '하나은행', '농협', 'NH농협', '기업은행', 'IBK', '새마을금고', '신협', '우체국', 'SC제일', '부산은행', '대구은행', 'iM뱅크']

const toNum = (s: string) => Number(s.replace(/[,\s]/g, ''))

/** "2026.11.10", "2026-11-10", "2026년 11월 10일" → "2026-11-10" */
function findDates(text: string): string[] {
  const out: string[] = []
  const re = /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g
  for (const m of text.matchAll(re)) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return out
}

/** "30만원", "1,000,000원", "5천원", "10만 원" → 숫자 */
function parseWon(s: string): number | undefined {
  const m = s.match(/(\d[\d,]*(?:\.\d+)?)\s*(만|천)?\s*원/)
  if (!m) return undefined
  const n = toNum(m[1]) * (m[2] === '만' ? 10000 : m[2] === '천' ? 1000 : 1)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : undefined
}

/**
 * AI 없이 붙여 넣은 글에서 적금 정보를 찾는다 (은행 앱 상품 설명, 가입 완료 문자 등)
 * 찾지 못한 칸은 비워 둔다
 */
export function parseSavingsText(text: string, today: string): SavingsDraft {
  const t = text.replace(/ /g, ' ')
  const draft: SavingsDraft = {}

  const bank = BANKS.find((b) => t.includes(b))
  if (bank) draft.bank = bank

  const name = t.match(/([가-힣A-Za-z0-9 ]{2,20}?(?:적금|계좌|저축))/)
  if (name) draft.name = name[1].trim().replace(/^(상품명|상품)\s*/, '')

  // 이율: "연 3.5%", "금리 4.0%", "최고 연 5%" — 여러 개면 가장 큰 값(우대 포함)
  const rates = [...t.matchAll(/(?:연|금리|이율|이자율)[^\d%\n]{0,8}(\d{1,2}(?:\.\d{1,3})?)\s*%/g)].map((m) => Number(m[1]))
  const anyRate = rates.length ? rates : [...t.matchAll(/(\d{1,2}\.\d{1,3})\s*%/g)].map((m) => Number(m[1]))
  if (anyRate.length) draft.rate = Math.max(...anyRate)

  if (/복리/.test(t)) draft.interestType = 'compound'
  else if (/단리/.test(t)) draft.interestType = 'simple'

  if (/비과세/.test(t)) draft.taxType = 'free'
  else if (/세금\s*우대/.test(t)) draft.taxType = 'preferential'
  else if (/일반\s*과세/.test(t)) draft.taxType = 'normal'

  // 주기와 금액: "매월 30만원", "매주 1만원", "매일 1,000원"
  const freqAmount = t.match(/(매일|매주|매월|매달|월|주|일)\s*(?:납입|저축|자동이체)?\s*(?:금액)?\s*[:\s]?\s*(\d[\d,]*(?:\.\d+)?\s*(?:만|천)?\s*원)/)
  if (freqAmount) {
    const f = freqAmount[1]
    draft.freq = f === '매일' || f === '일' ? 'daily' : f === '매주' || f === '주' ? 'weekly' : 'monthly'
    draft.amount = parseWon(freqAmount[2])
  } else {
    if (/매일|하루/.test(t)) draft.freq = 'daily'
    else if (/매주|주\s*\d+\s*회|\d+\s*주\s*적금/.test(t)) draft.freq = 'weekly'
    else if (/매월|매달|월\s*납입/.test(t)) draft.freq = 'monthly'
    const amt = t.match(/(?:납입\s*금액|납입액|월\s*납입|저축\s*금액|금액)\s*[:\s]?\s*(\d[\d,]*(?:\.\d+)?\s*(?:만|천)?\s*원)/)
    if (amt) draft.amount = parseWon(amt[1])
  }

  const day = t.match(/매[월달]\s*(\d{1,2})\s*일/)
  if (day) {
    draft.freq = 'monthly'
    draft.day = Number(day[1])
  }
  const wd = t.match(/매주\s*([일월화수목금토])요일/)
  if (wd) {
    draft.freq = 'weekly'
    draft.weekday = '일월화수목금토'.indexOf(wd[1])
  }

  const months = t.match(/(\d{1,3})\s*개월/)
  const years = t.match(/(\d{1,2})\s*년\s*(?:만기|약정|기간|짜리)/)
  const weeks = t.match(/(\d{1,3})\s*주\s*(?:적금|만기|기간|동안)/)
  if (months) draft.months = Number(months[1])
  else if (years) draft.months = Number(years[1]) * 12

  const dates = findDates(t)
  const startLabel = t.match(/(?:가입일|시작일|신규일|개설일)[^\d]{0,6}(20\d{2}[^\n]{0,12})/)
  const endLabel = t.match(/(?:만기일|만기\s*예정일|종료일)[^\d]{0,6}(20\d{2}[^\n]{0,12})/)
  if (startLabel) draft.startDate = findDates(startLabel[1])[0]
  if (endLabel) draft.endDate = findDates(endLabel[1])[0]
  if (!draft.startDate && !draft.endDate && dates.length >= 2) {
    const sorted = [...dates].sort()
    draft.startDate = sorted[0]
    draft.endDate = sorted[sorted.length - 1]
  } else if (!draft.startDate && dates.length === 1 && !draft.endDate) draft.startDate = dates[0]

  const start = draft.startDate ?? today
  if (!draft.endDate && draft.months) draft.endDate = addMonthsKey(start, draft.months)
  if (!draft.endDate && weeks) {
    const d = new Date(`${start}T00:00`)
    d.setDate(d.getDate() + Number(weeks[1]) * 7)
    draft.endDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    draft.freq ??= 'weekly'
  }

  return Object.fromEntries(Object.entries(draft).filter(([, v]) => v !== undefined && v !== '')) as SavingsDraft
}

/** 찾은 칸 수 (하나도 없으면 "못 찾았어요") */
export const draftSize = (d: SavingsDraft) => Object.keys(d).length

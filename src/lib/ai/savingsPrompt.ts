type Freq = 'daily' | 'weekly' | 'monthly'
type InterestType = 'simple' | 'compound'
type TaxType = 'normal' | 'preferential' | 'free'

/** 붙여 넣은 글이나 AI가 읽어 준 적금 정보 (모르는 칸은 비워 둔다) */
export interface SavingsDraft {
  name?: string
  bank?: string
  amount?: number
  startDate?: string
  endDate?: string
  /** 가입 기간 (개월). 만기일을 모를 때 가입일 + 기간으로 계산 */
  months?: number
  rate?: number
  interestType?: InterestType
  taxType?: TaxType
  freq?: Freq
  /** 매달 며칠 */
  day?: number
  /** 매주 무슨 요일 0~6 */
  weekday?: number
}

/** AI나 서버에서 온 값을 믿을 수 있는 모양으로 다듬는다 */
export function sanitizeDraft(raw: unknown): SavingsDraft {
  if (!raw || typeof raw !== 'object') return {}
  const r = raw as Record<string, unknown>
  const out: SavingsDraft = {}
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined)
  const date = (v: unknown) => (typeof v === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(v) ? v : undefined)
  const num = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined)
  out.name = str(r.name, 30)
  out.bank = str(r.bank, 30)
  out.amount = num(r.amount, 1, 999_999_999)
  if (out.amount) out.amount = Math.round(out.amount)
  out.startDate = date(r.startDate)
  out.endDate = date(r.endDate)
  out.months = num(r.months, 1, 600)
  out.rate = num(r.rate, 0, 50)
  if (r.interestType === 'simple' || r.interestType === 'compound') out.interestType = r.interestType
  if (r.taxType === 'normal' || r.taxType === 'preferential' || r.taxType === 'free') out.taxType = r.taxType
  if (r.freq === 'daily' || r.freq === 'weekly' || r.freq === 'monthly') out.freq = r.freq
  out.day = num(r.day, 1, 31)
  out.weekday = num(r.weekday, 0, 6)
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as SavingsDraft
}

/** 앱 → AI 로 보내는 것: 붙여 넣은 글 또는 스크린샷 하나 */
export interface SavingsAiInput {
  text?: string
  image?: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; data: string }
  /** 오늘 날짜 (가입일을 모르면 오늘로 보라고 알려 준다) */
  today: string
}

export class SavingsAiError extends Error {}

export const SAVINGS_SYSTEM = `너는 한국 은행 적금 상품 정보를 읽어 칸에 채워 주는 도우미야.
사용자가 은행 앱 화면 캡처, 가입 완료 문자, 상품 설명 글을 줄 거야. 거기서 적금 정보를 찾아 JSON으로만 답해.
- 확실하지 않은 칸은 null 로 둬. 지어내지 마.
- amount: 한 번에 넣는 돈(원, 정수). "월 30만원" → 300000
- rate: 연 이율 %. 기본금리와 우대금리가 같이 있으면 받을 수 있는 최고 금리(기본+우대)를 넣어.
- interestType: 단리면 "simple", 복리(월복리)면 "compound"
- taxType: 일반과세 "normal", 세금우대 "preferential", 비과세 "free"
- freq: 매일 "daily", 매주 "weekly", 매달 "monthly"
- day: 매달 넣는 날(1~31), weekday: 매주 넣는 요일(0=일요일 ~ 6=토요일)
- startDate/endDate: YYYY-MM-DD. 만기일 대신 기간만 있으면 months 에 개월 수를 넣어.
- name: 상품 이름, bank: 은행 이름`

/** 서버로 들어온 값을 다듬는다 (글 8000자, 사진 6MB까지) */
export function sanitizeInput(raw: unknown): SavingsAiInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const today = typeof r.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.today) ? r.today : null
  if (!today) return null
  const text = typeof r.text === 'string' ? r.text.slice(0, 8000) : undefined
  const img = r.image as Record<string, unknown> | undefined
  const image =
    img && typeof img.data === 'string' && img.data.length < 8_000_000 && (img.mediaType === 'image/jpeg' || img.mediaType === 'image/png' || img.mediaType === 'image/webp')
      ? { mediaType: img.mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: img.data }
      : undefined
  if (!text?.trim() && !image) return null
  return { today, ...(text?.trim() ? { text } : {}), ...(image ? { image } : {}) }
}

/** AI에게 보낼 글 */
export function savingsPrompt(input: SavingsAiInput): string {
  return `오늘은 ${input.today} 이야.\n${input.text ? `\n---\n${input.text}\n---\n` : '위 화면에서 '}적금 정보를 찾아 줘. JSON 하나로만 답해: {"name","bank","amount","startDate","endDate","months","rate","interestType","taxType","freq","day","weekday"} (모르면 null)`
}

/** AI 답(글)에서 JSON 을 꺼내 다듬는다 */
export function draftFromText(text: string): SavingsDraft {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new SavingsAiError('AI 답을 읽지 못했어요')
  try {
    return sanitizeDraft(JSON.parse(m[0]))
  } catch {
    throw new SavingsAiError('AI 답을 읽지 못했어요')
  }
}

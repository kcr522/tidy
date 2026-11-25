// AI 대화창: 사진(포스터·공지·결제 내역 캡처)이나 글을 보고 일정 또는 가계부 내역을 찾아 "등록할까요?" 묻는다

/** 이전 기록에서 배운 것: AI가 이름·카테고리·결제 수단을 늘 쓰던 대로 맞추게 한다 */
export interface AssistantContext {
  /** 사용자가 알려 준 결제처 이름 (예: "KCP*결제" → "운남 다이소") */
  aliases: { original: string; name: string }[]
  /** 전에 쓴 가게와 그때 고른 카테고리·결제 수단 (자주 쓴 순) */
  merchants: { name: string; category: string; account?: string }[]
  /** 자주 쓴 결제 수단 이름 (이 글자 그대로 쓰게 한다) */
  accounts: string[]
  /** 이 사용자의 지금 카테고리 (직접 만들고 지울 수 있어서 기본과 다를 수 있다) */
  categories?: { expense: string[]; income: string[] }
}

/** 앱 → AI 로 보내는 것 */
export interface AssistantRequest {
  /** 줄인 사진 (JPEG base64). 글만 보낼 때는 없다 */
  image?: string
  /** 사용자가 쓴 말 */
  text?: string
  /** 오늘 날짜 YYYY-MM-DD ("내일", "이번 주 토요일"을 계산하는 기준) */
  today: string
  context?: AssistantContext
}

/** 찾은 일정 하나 */
export interface EventGuess {
  title: string
  /** YYYY-MM-DD */
  startDate: string
  /** YYYY-MM-DD (하루면 startDate와 같다) */
  endDate: string
  /** 시작 시각 HH:mm. 없으면 null */
  time: string | null
  place: string | null
  /** 준비물, 신청 방법 같은 한 줄. 없으면 빈 글 */
  note: string
}

/** 찾은 결제 내역 하나 */
export interface PaymentGuess {
  type: 'EXPENSE' | 'INCOME'
  /** 가게나 보낸 사람 이름 (캡처에 찍힌 그대로) */
  merchant: string
  /** 원 단위 정수 */
  amount: number
  /** YYYY-MM-DD */
  date: string
  /** HH:mm. 없으면 null */
  time: string | null
  /** 카드·계좌·앱 이름. 없으면 null */
  account: string | null
  /** 카드 번호 · 계좌 번호 끝 4자리 (결제 알림에 있을 때만) */
  last4?: string
  /** 가계부 카테고리 */
  category: string
}

/** 오늘 있었던 일 → 일기 */
export interface DiaryGuess {
  /** YYYY-MM-DD */
  date: string
  /** 일기에 넣을 글 (사용자 말을 살려서 일기 말투로) */
  text: string
}

/** AI → 앱 으로 돌아오는 것 */
export interface AssistantReply {
  /** 찾은 것: 일정 / 결제 내역 / 일기 / 없음 */
  kind: 'event' | 'payment' | 'diary' | 'question' | 'none'
  /** 대화창에 보일 한두 문장 */
  reply: string
  events: EventGuess[]
  payments: PaymentGuess[]
  diary: DiaryGuess | null
}

export const EXPENSE_CATEGORIES = ['식비', '교통', '쇼핑', '문화/여가', '주거/통신', '의료/건강', '교육', '기타']
export const INCOME_CATEGORIES = ['월급', '용돈', '부수입', '기타']

export const MAX_IMAGE_CHARS = 3_000_000 // 약 2.2MB 사진 (Vercel 요청 4.5MB 한도 안)
export const MAX_TEXT = 500
export const MAX_EVENTS = 5
export const MAX_PAYMENTS = 20
const MAX_AMOUNT = 999_999_999

const WEEK = '일월화수목금토'

/** YYYY-MM-DD 의 요일 글자 */
export function weekdayOf(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  return WEEK[new Date(y, m - 1, d).getDay()]
}

export const ASSISTANT_SYSTEM = `너는 가계부·일정 앱 "Tidy" 안의 AI 비서야.
사용자가 사진(포스터, 공지, 안내문, 단체 문자, 은행·카드·간편결제 앱의 결제 내역 캡처, 영수증)이나 짧은 글을 보내면
캘린더에 넣을 일정인지, 가계부에 넣을 결제 내역인지, 일기에 남길 오늘 이야기인지 스스로 판단해서 내용을 뽑아 줘.

판단:
- 행사, 모임, 마감, 신청 기간, 예약처럼 "앞으로 언제 무엇을 한다"면 kind="event".
- 결제, 이체, 입금, 출금, 승인 내역, 영수증처럼 "돈이 오갔다"면 kind="payment".
- "오늘 ~했다", "~한 일이 있었어"처럼 이미 지나간 하루 이야기, 기분, 느낌이면 kind="diary".
- 돈 관리, 저축, 적금·예금, 청년 지원 상품, 청약, 대출, 소비 습관, 자기관리처럼 무언가를 "물어보는" 말이면 kind="question" (reply는 빈 글자 ""로. 답은 앱이 따로 만든다).
- 넷 다 아니면 kind="none".

일정(event):
- 가장 중요한 일정 하나 (서로 다른 일정이 여러 개면 많아야 ${MAX_EVENTS}개).
- 날짜는 YYYY-MM-DD. 연도가 없으면 오늘 기준으로 가장 가까운 앞날. "내일", "다음 주 금요일"은 오늘 날짜로 계산해.
- 기간(예: 11.20~11.22)이면 startDate와 endDate를 따로, 하루면 둘 다 같게.
- title은 캘린더에 들어갈 짧은 이름 (20자 안팎). note는 준비물·신청 방법·참가비처럼 알아 둘 것 한 줄.

일기(diary):
- date는 그 일이 있었던 날 (보통 오늘, "어제"라고 하면 어제).
- text는 사용자가 한 말을 살려서 일기 말투(~했다)로 1~4문장. 없는 일을 덧붙이지 마.
- reply는 먼저 공감해 줘 (예: "그런 일이 있으셨군요. 많이 속상하셨겠어요", "와, 정말 신나는 하루였네요!").

결제 내역(payment):
- 캡처에 보이는 내역을 한 줄씩 모두 (많아야 ${MAX_PAYMENTS}개). 취소된 결제, 잔액 표시, 광고는 빼.
- 나간 돈이면 type="EXPENSE", 들어온 돈이면 type="INCOME". amount는 양수 원 단위 정수.
- merchant는 캡처에 찍힌 가게·보낸 사람 이름 그대로 (예: "스타벅스 강남R점", "KCP*결제", "김엄마").
- 날짜 연도가 없으면 오늘 기준으로 가장 가까운 지난날. 시각이 보이면 time.
- account는 캡처에 보이는 카드·계좌·앱 이름. "이전 기록"의 자주 쓴 결제 수단과 같은 것이면 그 글자 그대로 써. 모르면 null.
- category는 지출이면 ${EXPENSE_CATEGORIES.join(', ')} 중 하나, 수입이면 ${INCOME_CATEGORIES.join(', ')} 중 하나.
  "이전 기록"에 같은 가게가 있으면 그때 고른 카테고리를 그대로 써.

지켜야 할 것:
- 사진에 없는 날짜, 금액, 장소를 지어내지 마. 안 보이면 null이나 빈 글.
- reply는 다정한 존댓말(해요체) 1~2문장 (예: "포스터를 보니 11월 22일 토요일에 플리마켓이 있네요!", "결제 3건을 찾았어요. 합치면 23,400원이에요").
  끝에 질문은 붙이지 마 (앱이 "등록할까요?"를 따로 물어). kind="none"이면 왜 못 찾았는지 쓰거나, 그냥 인사·잡담이면 짧게 대답해.
- 마지막에 꼭 report 도구를 한 번 불러서 결과를 알려 줘. 그 밖의 말은 하지 마.`

const nullable = (type: string, description: string) => ({ type: [type, 'null'], description })

/** 결과를 받는 도구. strict 라서 모양이 항상 맞게 온다 */
export const REPORT_TOOL = {
  name: 'report',
  description: '사진이나 글에서 찾은 일정 또는 결제 내역을 앱에 알려 준다. 맨 마지막에 한 번만 부른다.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['kind', 'reply', 'events', 'payments', 'diary'],
    properties: {
      kind: { type: 'string', enum: ['event', 'payment', 'diary', 'question', 'none'], description: '일정이면 event, 결제 내역이면 payment, 오늘 이야기면 diary, 돈·생활 질문이면 question, 아니면 none' },
      reply: { type: 'string', description: '대화창에 보일 1~2문장' },
      events: {
        type: 'array',
        description: 'kind=event 일 때 찾은 일정. 아니면 빈 배열',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'startDate', 'endDate', 'time', 'place', 'note'],
          properties: {
            title: { type: 'string', description: '일정 이름 (짧게)' },
            startDate: { type: 'string', description: '시작 날짜 YYYY-MM-DD' },
            endDate: { type: 'string', description: '끝 날짜 YYYY-MM-DD (하루면 시작과 같게)' },
            time: nullable('string', '시작 시각 HH:mm (24시간)'),
            place: nullable('string', '장소'),
            note: { type: 'string', description: '알아 둘 것 한 줄. 없으면 빈 글' },
          },
        },
      },
      payments: {
        type: 'array',
        description: 'kind=payment 일 때 찾은 내역. 아니면 빈 배열',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['type', 'merchant', 'amount', 'date', 'time', 'account', 'category'],
          properties: {
            type: { type: 'string', enum: ['EXPENSE', 'INCOME'] },
            merchant: { type: 'string', description: '캡처에 찍힌 가게·보낸 사람 이름 그대로' },
            amount: { type: 'integer', description: '금액 (원, 양수)' },
            date: { type: 'string', description: 'YYYY-MM-DD' },
            time: nullable('string', 'HH:mm (24시간)'),
            account: nullable('string', '카드·계좌·앱 이름'),
            category: { type: 'string', description: '가계부 카테고리' },
          },
        },
      },
      diary: {
        type: ['object', 'null'],
        description: 'kind=diary 일 때 일기. 아니면 null',
        additionalProperties: false,
        required: ['date', 'text'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          text: { type: 'string', description: '일기에 넣을 글' },
        },
      },
    },
  },
}

/** 사진·글과 함께 보낼 설명 */
export function assistantPrompt(req: AssistantRequest): string {
  const lines = [`오늘: ${req.today} (${weekdayOf(req.today)}요일)`]
  if (req.text) lines.push(`사용자가 한 말: ${req.text}`)
  const c = req.context
  if (c && (c.aliases.length || c.merchants.length || c.accounts.length)) {
    lines.push('', '이전 기록 (이 사용자가 늘 쓰던 방식. 같은 가게·결제 수단이면 이대로 맞춰 줘):')
    if (c.accounts.length) lines.push(`- 자주 쓴 결제 수단: ${c.accounts.join(', ')}`)
    for (const a of c.aliases) lines.push(`- "${a.original}"로 찍히는 곳은 실제로 "${a.name}"`)
    for (const m of c.merchants) lines.push(`- ${m.name}: ${m.category}${m.account ? `, ${m.account}` : ''}`)
  }
  if (c?.categories) lines.push('', `이 사용자의 카테고리 (category는 이 중에서): 지출 ${c.categories.expense.join(', ')} / 수입 ${c.categories.income.join(', ')}`)
  lines.push('', req.image ? '이 사진을 보고 report로 알려 줘.' : '이 말을 보고 report로 알려 줘.')
  return lines.join('\n')
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validDate(v: unknown): string | null {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return null
  const [y, m, d] = v.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? v : null
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const time = (v: unknown) => {
  const t = str(v, 5)
  return TIME_RE.test(t) ? t : null
}

function sanitizeContext(raw: unknown): AssistantContext | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const arr = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : [])
  const obj = (v: unknown) => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  return {
    aliases: arr(r.aliases, 30)
      .map(obj)
      .map((a) => ({ original: str(a.original, 40), name: str(a.name, 40) }))
      .filter((a) => a.original && a.name),
    merchants: arr(r.merchants, 40)
      .map(obj)
      .map((m) => ({ name: str(m.name, 40), category: str(m.category, 20), ...(str(m.account, 30) ? { account: str(m.account, 30) } : {}) }))
      .filter((m) => m.name && m.category),
    accounts: arr(r.accounts, 10)
      .map((a) => str(a, 30))
      .filter(Boolean),
    ...(r.categories && typeof r.categories === 'object' ? { categories: { expense: names(obj(r.categories).expense), income: names(obj(r.categories).income) } } : {}),
  }
}

/** 카테고리 이름 목록 (많아야 40개, 한 이름 20자) */
const names = (v: unknown) => (Array.isArray(v) ? v.slice(0, 40) : []).map((n) => str(n, 20)).filter(Boolean)

type Cats = AssistantContext['categories']

/** 들어온 요청을 믿을 수 있는 모양으로 (서버에서 쓴다) */
export function sanitizeAssistantRequest(raw: unknown): AssistantRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const today = validDate(r.today)
  if (!today) return null
  const out: AssistantRequest = { today }
  if (typeof r.image === 'string' && r.image) {
    if (r.image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(r.image)) return null
    out.image = r.image
  }
  if (typeof r.text === 'string' && r.text.trim()) out.text = r.text.trim().slice(0, MAX_TEXT)
  const context = sanitizeContext(r.context)
  if (context) out.context = context
  return out.image || out.text ? out : null
}

function sanitizeEvent(raw: unknown): EventGuess | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const title = str(r.title, 100)
  const start = validDate(r.startDate)
  if (!title || !start) return null
  const end = validDate(r.endDate)
  return {
    title,
    startDate: start,
    endDate: end && end >= start ? end : start,
    time: time(r.time),
    place: str(r.place, 60) || null,
    note: str(r.note, 120),
  }
}

function sanitizePayment(raw: unknown, mine?: Cats): PaymentGuess | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const type = r.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) ? Math.round(Math.abs(r.amount)) : 0
  const date = validDate(r.date)
  const merchant = str(r.merchant, 40)
  if (!date || amount < 1 || amount > MAX_AMOUNT) return null
  const cats = [...(type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES), ...((type === 'INCOME' ? mine?.income : mine?.expense) ?? [])]
  const category = str(r.category, 20)
  return {
    type,
    merchant: merchant || (type === 'INCOME' ? '입금' : '결제'),
    amount,
    date,
    time: time(r.time),
    account: str(r.account, 30) || null,
    category: cats.includes(category) ? category : '기타',
  }
}

/** AI가 준 결과를 믿을 수 있는 모양으로 */
export function sanitizeAssistantReply(raw: unknown, mine?: Cats): AssistantReply | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const reply = str(r.reply, 300)
  const events = (Array.isArray(r.events) ? r.events : []).map(sanitizeEvent).filter((e): e is EventGuess => e !== null).slice(0, MAX_EVENTS)
  const payments = (Array.isArray(r.payments) ? r.payments : [])
    .map((p) => sanitizePayment(p, mine))
    .filter((p): p is PaymentGuess => p !== null)
    .slice(0, MAX_PAYMENTS)
  const none = { events: [], payments: [], diary: null }
  if (r.kind === 'event' && events.length) return { ...none, kind: 'event', reply: reply || '일정을 찾았어요', events }
  if (r.kind === 'payment' && payments.length) return { ...none, kind: 'payment', reply: reply || `결제 내역 ${payments.length}건을 찾았어요`, payments }
  const d = r.diary && typeof r.diary === 'object' ? (r.diary as Record<string, unknown>) : null
  const diaryText = str(d?.text, 2000)
  const diaryDate = validDate(d?.date)
  if (r.kind === 'diary' && diaryText && diaryDate) return { ...none, kind: 'diary', reply: reply || '그런 일이 있으셨군요', diary: { date: diaryDate, text: diaryText } }
  if (r.kind === 'question') return { ...none, kind: 'question', reply }
  if (!['event', 'payment', 'diary', 'none'].includes(r.kind as string)) return null
  return { ...none, kind: 'none', reply: reply || '여기서는 일정이나 결제 내역을 찾지 못했어요' }
}

/** 도구가 없는 AI(Gemini)에게 알려 줄 답 모양 */
export const JSON_SHAPE = `report 도구 대신, 아래 모양의 JSON 하나로만 답해 (다른 글 없이):
{"kind":"event|payment|diary|question|none","reply":"…","events":[{"title":"…","startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","time":"HH:mm 또는 null","place":"… 또는 null","note":""}],"payments":[{"type":"EXPENSE|INCOME","merchant":"…","amount":0,"date":"YYYY-MM-DD","time":"HH:mm 또는 null","account":"… 또는 null","category":"…"}],"diary":{"date":"YYYY-MM-DD","text":"…"} 또는 null}
해당 없는 칸은 빈 배열이나 null.`

/** 글로 받은 JSON 답을 믿을 수 있는 모양으로 (Gemini·Groq) */
export function parseAssistantJson(text: string, mine?: Cats): AssistantReply | null {
  return replyFromText(text, mine)
}

/** 모델이 도구 대신 글로 JSON을 썼을 때 대비 */
function replyFromText(text: string, mine?: Cats): AssistantReply | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return sanitizeAssistantReply(JSON.parse(m[0]), mine)
  } catch {
    return null
  }
}

export class AssistantError extends Error {}

/** 캘린더 메모에 넣을 한 줄: "오후 3:00 · 시민공원 · 참가비 무료" */
export function eventMemo(g: Pick<EventGuess, 'time' | 'place' | 'note'>): string {
  const parts: string[] = []
  if (g.time) {
    const [h, m] = g.time.split(':').map(Number)
    parts.push(`${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`)
  }
  if (g.place) parts.push(g.place)
  if (g.note) parts.push(g.note)
  return parts.join(' · ').slice(0, 200)
}

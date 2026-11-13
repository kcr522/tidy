// AI 소비 한마디: 말투(모드), 프롬프트, 오늘 소비 요약

export type FeedbackMode = 'feedback' | 'saver' | 'cheer'

export interface ModeInfo {
  id: FeedbackMode
  label: string
  emoji: string
  /** 고르는 화면에 보일 한 줄 설명 */
  desc: string
}

export const FEEDBACK_MODES: ModeInfo[] = [
  { id: 'feedback', label: '피드백', emoji: '🧐', desc: '잘한 점과 아쉬운 점을 같이 짚어 줘요' },
  { id: 'saver', label: '절약 잔소리', emoji: '😤', desc: '아낄 수 있는 곳을 콕 집어 잔소리해요' },
  { id: 'cheer', label: '무조건 칭찬', emoji: '🥰', desc: '뭘 사도 잘했다고 칭찬해 줘요' },
]

export function isFeedbackMode(v: unknown): v is FeedbackMode {
  return v === 'feedback' || v === 'saver' || v === 'cheer'
}

/** AI에게 보내는 오늘 소비 요약. 금액은 원 단위 정수 */
export interface SpendingSnapshot {
  /** YYYY-MM-DD */
  date: string
  /** 오늘 지출 합계 */
  todayTotal: number
  /** 오늘 지출 내역 (최대 30개) */
  items: { time?: string; name: string; category: string; amount: number }[]
  /** 이번 달 지출 합계 (오늘 포함) */
  monthExpense: number
  /** 이번 달 수입 합계 */
  monthIncome: number
  /** 오늘 전까지 이번 달 하루 평균 지출. 이번 달 첫날이면 null */
  dailyAverage: number | null
}

export const MAX_ITEMS = 30

/** 모든 모드에 공통인 규칙 (바뀌지 않는 부분이라 앞에 둔다) */
const BASE_SYSTEM = `너는 가계부 앱 "Tidy" 안에 사는 소비 코멘트 친구야.
사용자가 오늘 쓴 돈 내역을 보고 한국어로 짧게 한마디 해 줘.

지켜야 할 것:
- 2~4문장, 전체 150자 안팎. 친구한테 말하듯 반말로, 이모지는 1~2개까지.
- 내역에 실제로 있는 가게, 카테고리, 금액만 말해. 없는 내역을 지어내지 마.
- 금액은 "12,000원"처럼 쉼표와 "원"을 붙여.
- 하루 평균과 비교할 수 있으면 한 번은 비교해.
- 제목, 목록, 마크다운 없이 말풍선에 들어갈 문장만 써.
- 사람을 깎아내리거나 죄책감을 주는 말은 하지 마. 잔소리도 웃기고 귀엽게.`

const PERSONA: Record<FeedbackMode, string> = {
  feedback: `말투: "피드백" 모드.
잘한 점 하나와 아쉬운 점 하나를 균형 있게 짚고, 내일 해 볼 만한 작은 팁을 하나 줘. 차분하고 다정하게.`,
  saver: `말투: "절약 잔소리" 모드.
엄마나 깐깐한 친구처럼 귀엽게 잔소리해. 가장 아까운 지출 하나를 콕 집어서 "이건 참을 수 있었잖아" 하는 느낌으로 말하고, 그걸 아꼈으면 얼마가 남았을지 말해 줘.
오늘 안 썼거나 아주 적게 썼으면 그때만 마지못해 인정해 줘.`,
  cheer: `말투: "무조건 칭찬" 모드.
무엇을 샀든 무조건 칭찬해. 지출을 나를 위한 투자, 행복, 자기 돌봄으로 긍정적으로 해석해 줘. 많이 썼어도 비난하지 말고 열정적으로 응원해.`,
}

/** 시스템 프롬프트 = 공통 규칙 + 말투 */
export function systemPrompt(mode: FeedbackMode): string {
  return `${BASE_SYSTEM}\n\n${PERSONA[mode]}`
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 사용자 메시지: 오늘 소비 요약을 글로 */
export function userPrompt(s: SpendingSnapshot): string {
  const lines = s.items.length
    ? s.items.map((i) => `- ${i.time ? `${i.time} ` : ''}${i.name} (${i.category}) ${won(i.amount)}`).join('\n')
    : '- (오늘은 지출 기록이 없어)'
  return `오늘(${s.date}) 쓴 돈: ${won(s.todayTotal)}
오늘 내역:
${lines}

이번 달 지금까지 쓴 돈: ${won(s.monthExpense)}
이번 달 들어온 돈: ${won(s.monthIncome)}
오늘 전까지 하루 평균: ${s.dailyAverage === null ? '아직 없음 (이번 달 첫날)' : won(s.dailyAverage)}

이걸 보고 한마디 해 줘.`
}

/** 서버로 들어온 값을 믿을 수 있는 모양으로 다듬는다 */
export function sanitizeSnapshot(raw: unknown): SpendingSnapshot | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0)
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null
  const items = Array.isArray(r.items) ? r.items.slice(0, MAX_ITEMS) : []
  return {
    date: r.date,
    todayTotal: int(r.todayTotal),
    items: items.map((x) => {
      const i = (x ?? {}) as Record<string, unknown>
      const time = str(i.time, 5)
      return { ...(time ? { time } : {}), name: str(i.name, 40) || '이름 없음', category: str(i.category, 20) || '기타', amount: int(i.amount) }
    }),
    monthExpense: int(r.monthExpense),
    monthIncome: int(r.monthIncome),
    dailyAverage: r.dailyAverage === null ? null : int(r.dailyAverage),
  }
}

/** AI가 답을 거절하거나 빈 답을 줬을 때 */
export class FeedbackError extends Error {}

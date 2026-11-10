import { addDays, format } from 'date-fns'
import { parseDateKey } from '../date'
import { matchMerchant } from '../merchants'
import type { AssistantReply, AssistantRequest, EventGuess, PaymentGuess } from './assistant'

// AI 없이(설정 > AI 연결 '기본') 쓰는 대화창: 글에서 날짜·금액·지난 이야기를 규칙으로 찾는다.
// 사진 속 글자는 읽지 못한다.

const WEEK = '일월화수목금토'
const key = (d: Date) => format(d, 'yyyy-MM-dd')
const pad = (n: number) => String(n).padStart(2, '0')

/** 월·일만 있으면 오늘 기준으로 연도를 정한다 (future: 가까운 앞날 / 아니면 가까운 지난날) */
function withYear(today: string, m: number, d: number, future: boolean): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const y = Number(today.slice(0, 4))
  const k = `${y}-${pad(m)}-${pad(d)}`
  const dt = parseDateKey(k)
  if (dt.getMonth() !== m - 1) return null
  if (future && k < today) return `${y + 1}-${pad(m)}-${pad(d)}`
  if (!future && k > today) return `${y - 1}-${pad(m)}-${pad(d)}`
  return k
}

interface Found {
  date: string
  /** 원문에서 찾은 글자 (제목에서 지운다) */
  text: string
  index: number
}

/** 글에서 날짜들을 찾는다 (나온 순서대로) */
export function findDates(text: string, today: string, future = true): Found[] {
  const out: Found[] = []
  const base = parseDateKey(today)
  const push = (date: string | null, m: RegExpMatchArray) => {
    if (!date || m.index === undefined) return
    if (out.some((f) => m.index! < f.index + f.text.length && f.index < m.index! + m[0].length)) return
    out.push({ date, text: m[0], index: m.index })
  }
  for (const m of text.matchAll(/(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g)) {
    const k = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`
    push(parseDateKey(k).getDate() === +m[3] ? k : null, m)
  }
  for (const m of text.matchAll(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/g)) push(withYear(today, +m[1], +m[2], future), m)
  // 11.20 / 11/20 (시각 12:30, 금액 1,000 과 헷갈리지 않게)
  for (const m of text.matchAll(/(?<![\d,:])(\d{1,2})[./](\d{1,2})(?![\d,:])/g)) push(withYear(today, +m[1], +m[2], future), m)
  const rel: [RegExp, number][] = [
    [/그저께|그제/g, -2],
    [/어제/g, -1],
    [/오늘/g, 0],
    [/내일/g, 1],
    [/모레/g, 2],
    [/글피/g, 3],
  ]
  for (const [re, n] of rel) for (const m of text.matchAll(re)) push(key(addDays(base, n)), m)
  for (const m of text.matchAll(/(이번\s*주|다음\s*주|담주)?\s*([월화수목금토일])요일/g)) {
    const want = WEEK.indexOf(m[2])
    const now = base.getDay()
    let diff = (want - now + 7) % 7
    if (m[1] && /다음|담/.test(m[1])) diff = 7 - now + (want === 0 ? 7 : want)
    else if (!m[1] && diff === 0) diff = 0
    push(key(addDays(base, diff)), m)
  }
  return out.sort((a, b) => a.index - b.index)
}

/** "오후 3시 30분", "15:00", "3시 반" → HH:mm */
export function findTime(text: string): { time: string; text: string } | null {
  const hm = text.match(/(?<![\d.])([01]?\d|2[0-3]):([0-5]\d)(?!\d)/)
  if (hm) return { time: `${pad(+hm[1])}:${hm[2]}`, text: hm[0] }
  const k = text.match(/(오전|오후|아침|저녁|밤|낮)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분|\s*(반))?/)
  if (!k) return null
  let h = +k[2]
  if (h > 24) return null
  if ((k[1] === '오후' || k[1] === '저녁' || k[1] === '밤') && h < 12) h += 12
  if (k[1] === '낮' && h < 7) h += 12
  if (!k[1] && h >= 1 && h <= 7) h += 12 // "3시"는 보통 오후
  const m = k[4] ? 30 : k[3] ? +k[3] : 0
  return { time: `${pad(h % 24)}:${pad(Math.min(59, m))}`, text: k[0] }
}

/** "5,600원", "1만 2천원", "3만원" → 원 */
export function findAmount(text: string): { amount: number; text: string } | null {
  const man = text.match(/(\d+(?:\.\d+)?)\s*만\s*(?:(\d+)\s*천)?\s*원?/)
  if (man) return { amount: Math.round(parseFloat(man[1]) * 10000 + (man[2] ? +man[2] * 1000 : 0)), text: man[0] }
  const won = text.match(/(\d{1,3}(?:,\d{3})+|\d+)\s*원/)
  if (won) return { amount: Number(won[1].replace(/,/g, '')), text: won[0] }
  return null
}

/** 글자 받침이 ㅆ 인지: 했/갔/봤/있었 … (지난 이야기) */
function hasPastTense(text: string): boolean {
  for (const ch of text) {
    const c = ch.charCodeAt(0) - 0xac00
    if (c >= 0 && c < 11172 && c % 28 === 20) {
      // "있다", "있어", "있음"(받침 ㅆ인데 지금 이야기)은 빼고 본다
      if (ch === '있' || ch === '겠') continue
      return true
    }
  }
  return false
}

const FILLER =
  /(일정|등록|해\s*줘|해\s*주세요|넣어\s*줘|있어요?|있음|있다|예정|까지|부터|에서|에는|에|결제|썼어요?|썼다|샀어요?|샀다|냈어요?|지출|사용|원)(?=\s|$|[.!?~])/g

function cleanTitle(text: string, remove: string[]): string {
  let t = text
  for (const r of remove) t = t.replace(r, ' ')
  return t
    .replace(/[~\-–]+/g, ' ')
    .replace(FILLER, ' ')
    .replace(/[.!?,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** AI 없이 대답하기 */
export function localAssistant(req: AssistantRequest): AssistantReply {
  const none = { events: [], payments: [], diary: null }
  const text = req.text?.trim() ?? ''
  if (!text) {
    return {
      ...none,
      kind: 'none',
      reply: "지금은 AI 연결이 '기본'이라 사진 속 글자를 읽지 못해요. 설정 > AI 연결에서 'Gemini (무료)'를 켜 주시거나, 사진 속 날짜와 내용을 글로 적어 주세요.",
    }
  }
  const today = req.today

  // 1) 금액이 있으면 가계부
  const amount = findAmount(text)
  if (amount && amount.amount > 0) {
    const date = findDates(text, today, false)[0]
    const time = findTime(text.replace(amount.text, ' '))
    const income = /입금|들어왔|받았|월급|용돈/.test(text)
    const merchant = cleanTitle(text, [amount.text, date?.text ?? '', time?.text ?? '']).replace(/(오늘|어제)\s*/g, '') || (income ? '입금' : '결제')
    const brand = matchMerchant(merchant)
    const p: PaymentGuess = {
      type: income ? 'INCOME' : 'EXPENSE',
      merchant,
      amount: amount.amount,
      date: date?.date ?? today,
      time: time?.time ?? null,
      account: null,
      category: income ? (/월급/.test(text) ? '월급' : /용돈/.test(text) ? '용돈' : '기타') : (brand?.brand.category ?? '기타'),
    }
    return { ...none, kind: 'payment', reply: `${merchant} ${p.amount.toLocaleString('ko-KR')}원, 가계부에 적어 둘 내역이네요.`, payments: [p] }
  }

  // 2) 지난 이야기면 일기
  const dates = findDates(text, today, !hasPastTense(text))
  if (hasPastTense(text)) {
    const day = dates[0]?.date && dates[0].date <= today ? dates[0].date : today
    return { ...none, kind: 'diary', reply: '그런 일이 있으셨군요. 이야기해 주셔서 고마워요.', diary: { date: day, text } }
  }

  // 3) 날짜가 있으면 일정
  if (dates.length) {
    const [a, b] = dates
    const range = b && /[~\-–]|부터|까지/.test(text.slice(a.index, b.index + b.text.length)) && b.date >= a.date
    const time = findTime(text.replace(a.text, ' ').replace(b?.text ?? '', ' '))
    const title = cleanTitle(text, [a.text, range ? b.text : '', time?.text ?? '']) || '새 일정'
    const e: EventGuess = { title, startDate: a.date, endDate: range ? b.date : a.date, time: time?.time ?? null, place: null, note: '' }
    const d = parseDateKey(e.startDate)
    return { ...none, kind: 'event', reply: `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEK[d.getDay()]})에 "${title}" 일정이 있네요.`, events: [e] }
  }

  return {
    ...none,
    kind: 'none',
    reply: '어떤 걸 도와드릴까요? 날짜가 있는 일정, 금액이 있는 결제 내역, 오늘 있었던 일을 말해 주시면 정리해 드릴게요.',
  }
}

/**
 * AI 없이 바로 답하기 (사용자 요청 2026-11-13)
 * "오늘 일정 뭐야?", "이번 달 얼마 썼어?", "예산 얼마 남았어?" 처럼 앱에 이미 있는 기록으로 답할 수 있는 질문은
 * AI 에게 묻지 않고 기기 안의 기록(캘린더, 할 일, 가계부, 예산, 적금, 정기 내역, 일기)으로 바로 답한다.
 * AI 하루 횟수를 쓰지 않고, 인터넷이 없어도 되고, 더 빠르다. 알아듣지 못한 질문만 AI 에게 넘긴다.
 * 이 파일은 계산만 한다 (기록을 읽는 건 quickData.ts).
 */
import { addDays, addMonths, endOfMonth, startOfMonth } from 'date-fns'
import type { Budget, CalendarEvent, Diary, Recurring, SavingsPlan, Todo, Transaction } from '../../db/types'
import { findAmount, findDates, findTime } from '../ai/assistantLocal'
import { budgetStatus } from '../budget'
import { parseDateKey, toDateKey } from '../date'
import type { Holiday } from '../holidays'
import { ddayFor, dueDateIn } from '../recurring'
import { isDueOn, progressOf } from '../savings'
import { categoryShares } from '../stats'

export type QuickIntent =
  | { kind: 'schedule'; from: string; to: string; label: string }
  | { kind: 'spending'; from: string; to: string; label: string; income: boolean }
  | { kind: 'budget' }
  | { kind: 'savings' }
  | { kind: 'recurring'; income: boolean }
  | { kind: 'diary'; date: string; label: string }

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 묻는 말인가 (등록해 달라는 말과 구별) */
const ASKING = /\?|뭐|무슨|무엇|있어|있나|있니|있을까|있는지|알려|보여|말해|어때|얼마|언제|며칠|몇|확인|남았|남은|했어|썼어|나갔|맞아|아니야|해야\s*(돼|해|하)/

const SCHEDULE = /일정|스케줄|약속|할\s*일|할일|투두|뭐\s*(해야|하는|하지|할까|있)|뭐하|무슨\s*날|뭔\s*날|휴일|공휴일|쉬는\s*날|빨간\s*날|계획/
const SPENDING = /얼마\s*(나|를|정도|쯤)?\s*(썼|쓴|나갔|나간|지출|벌|들어)|지출|소비|쓴\s*돈|썼어|수입|번\s*돈|들어온\s*돈/
const BUDGET = /예산|얼마\s*(더\s*)?(남|쓸\s*수)|쓸\s*수\s*있는\s*돈/
const SAVINGS = /적금|저축|만기|모은\s*돈|모았/
const RECURRING = /월급\s*날|월급\s*(언제|며칠)|월급.*남|용돈\s*날|정기\s*(결제|지출|내역)|결제일|구독/
const DIARY = /일기/
/** 조언·정보를 묻는 말은 AI 에게 ("적금 금리 비교해 줘", "예산 짜는 법") */
const ADVICE = /방법|어떻게|추천|비교|금리|이자율|좋은|좋을까|팁|조언|왜|상품|가입|줄이|아끼|짜는|짤까|계획\s*세워|만들어\s*줘|정리해\s*줘|써\s*줘/

const pad = (n: number) => String(n).padStart(2, '0')
const key = (d: Date) => toDateKey(d)
const won = (n: number) => `${Math.round(n).toLocaleString('ko-KR')}원`

/** 11월 13일 (금) */
export function dayLabel(date: string): string {
  const d = parseDateKey(date)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
}

/** 말 속의 기간. 없으면 null */
function rangeOf(text: string, today: string, future: boolean): { from: string; to: string; label: string } | null {
  const t = parseDateKey(today)
  const monday = addDays(t, -((t.getDay() + 6) % 7))
  if (/다음\s*주\s*말|담주\s*말/.test(text)) return { from: key(addDays(monday, 12)), to: key(addDays(monday, 13)), label: '다음 주말' }
  if (/주말/.test(text)) return { from: key(addDays(monday, 5)), to: key(addDays(monday, 6)), label: '이번 주말' }
  if (/다음\s*주|담주/.test(text) && !/[월화수목금토일]요일/.test(text)) return { from: key(addDays(monday, 7)), to: key(addDays(monday, 13)), label: '다음 주' }
  if (/지난\s*주|저번\s*주/.test(text)) return { from: key(addDays(monday, -7)), to: key(addDays(monday, -1)), label: '지난주' }
  if (/이번\s*주|이번주|금주/.test(text) && !/[월화수목금토일]요일/.test(text)) return { from: key(monday), to: key(addDays(monday, 6)), label: '이번 주' }
  if (/다음\s*달|담달/.test(text) && !/\d+\s*일/.test(text)) {
    const m = addMonths(t, 1)
    return { from: key(startOfMonth(m)), to: key(endOfMonth(m)), label: `다음 달(${m.getMonth() + 1}월)` }
  }
  if (/지난\s*달|저번\s*달|전\s*달/.test(text)) {
    const m = addMonths(t, -1)
    return { from: key(startOfMonth(m)), to: key(endOfMonth(m)), label: `지난달(${m.getMonth() + 1}월)` }
  }
  if (/이번\s*달|이번달|한\s*달|이달/.test(text)) return { from: key(startOfMonth(t)), to: key(endOfMonth(t)), label: `이번 달(${t.getMonth() + 1}월)` }
  // "11월에 얼마 썼어?" 처럼 달만
  const mon = text.match(/(\d{1,2})\s*월(?!\s*\d)/)
  if (mon && +mon[1] >= 1 && +mon[1] <= 12 && !findDates(text, today, future).length) {
    let y = t.getFullYear()
    if (future && +mon[1] < t.getMonth() + 1) y += 1
    if (!future && +mon[1] > t.getMonth() + 1) y -= 1
    const first = new Date(y, +mon[1] - 1, 1)
    return { from: key(first), to: key(endOfMonth(first)), label: `${+mon[1]}월` }
  }
  const dates = findDates(text, today, future).map((f) => f.date).sort()
  if (!dates.length) return null
  const from = dates[0]
  const to = dates.at(-1)!
  const rel = from === to ? (from === today ? '오늘' : from === key(addDays(t, 1)) ? '내일' : from === key(addDays(t, -1)) ? '어제' : from === key(addDays(t, 2)) ? '모레' : '') : ''
  return { from, to, label: from === to ? (rel ? `${rel} ${dayLabel(from)}` : dayLabel(from)) : `${dayLabel(from)} ~ ${dayLabel(to)}` }
}

/** 기록만 보고 답할 수 있는 질문인지. 아니면 null (그때는 AI 에게) */
export function detectQuick(raw: string, today: string): QuickIntent | null {
  const text = raw.trim()
  // "다음 주 스케줄", "오늘 할 일" 처럼 짧게 이름만 말해도 묻는 걸로 본다
  const short = /^(오늘|내일|모레|어제|이번\s*주|다음\s*주|담주|이번\s*주말|주말|이번\s*달|다음\s*달)?\s*(의\s*)?(일정|스케줄|할\s*일|할일|약속|지출|예산|적금)\s*[?!.]*$/.test(text)
  if (!text || text.length > 80 || !(short || ASKING.test(text))) return null
  // 금액이 들어 있으면 가계부에 적어 달라는 말일 가능성이 크다 ("점심 9천원 썼어")
  if (findAmount(text)) return null
  if (ADVICE.test(text)) return null
  if (DIARY.test(text) && /뭐|무슨|보여|있어|썼|알려|어땠/.test(text)) {
    const r = rangeOf(text, today, false)
    const date = r?.from ?? today
    return { kind: 'diary', date, label: r?.label ?? `오늘 ${dayLabel(today)}` }
  }
  if (RECURRING.test(text)) return { kind: 'recurring', income: /월급|용돈|수입|들어/.test(text) }
  if (SAVINGS.test(text) && !/예산/.test(text)) return { kind: 'savings' }
  if (BUDGET.test(text)) return { kind: 'budget' }
  if (SPENDING.test(text)) {
    const t = parseDateKey(today)
    const r = rangeOf(text, today, false) ?? { from: key(startOfMonth(t)), to: key(endOfMonth(t)), label: `이번 달(${t.getMonth() + 1}월)` }
    return { kind: 'spending', ...r, income: /수입|벌|번\s*돈|들어/.test(text) }
  }
  if (SCHEDULE.test(text)) {
    // "내일 3시 치과 약속" 처럼 시각이 있으면 일정을 등록하려는 말
    if (findTime(text) && !/\?|뭐|있어|있나|알려/.test(text)) return null
    const r = rangeOf(text, today, true) ?? { from: today, to: today, label: `오늘 ${dayLabel(today)}` }
    return { kind: 'schedule', ...r }
  }
  return null
}

/** 답을 만드는 데 필요한 기록 (필요한 것만 채운다) */
export interface QuickData {
  events?: CalendarEvent[]
  todos?: Todo[]
  holidays?: Map<string, Holiday[]>
  transactions?: Transaction[]
  budgets?: Budget[]
  savings?: SavingsPlan[]
  recurring?: Recurring[]
  diary?: Diary | null
}

/** 일정 메모 맨 앞의 "오후 3:00" → 15:00 (정렬용) */
function eventTime(e: CalendarEvent): { sort: string; label: string } {
  const m = e.memo.match(/^(오전|오후)\s*(\d{1,2}):(\d{2})/)
  if (!m) return { sort: '', label: '' }
  const h = (+m[2] % 12) + (m[1] === '오후' ? 12 : 0)
  return { sort: `${pad(h)}:${m[3]}`, label: `${m[1]} ${m[2]}:${m[3]} ` }
}

function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = parseDateKey(from); key(d) <= to && out.length < 62; d = addDays(d, 1)) out.push(key(d))
  return out
}

function scheduleAnswer(q: Extract<QuickIntent, { kind: 'schedule' }>, data: QuickData, today: string): string {
  const days = eachDay(q.from, q.to)
  const single = days.length === 1
  const todos = (data.todos ?? []).filter((t) => !t.isCompleted)
  const lines: string[] = []
  let count = 0
  for (const day of days) {
    const part: string[] = []
    for (const h of data.holidays?.get(day) ?? []) part.push(`🎌 ${h.name}${h.substitute ? ` (${h.substitute} 대체공휴일)` : ''}`)
    const evs = (data.events ?? []).filter((e) => e.startDate <= day && e.endDate >= day).sort((a, b) => eventTime(a).sort.localeCompare(eventTime(b).sort) || a.title.localeCompare(b.title))
    for (const e of evs) part.push(`📅 ${eventTime(e).label}${e.title}${e.startDate !== e.endDate ? ` (${dayLabel(e.startDate).replace(/ \(.\)/, '')}~${dayLabel(e.endDate).replace(/ \(.\)/, '')})` : ''}`)
    for (const t of todos.filter((t) => t.dueDate === day)) part.push(`✅ ${t.title}${t.remindAt ? ` (${t.remindAt} 알림)` : ''}`)
    for (const r of data.recurring ?? []) {
      if (!r.isActive || r.startDate > day) continue
      const d = parseDateKey(day)
      if (dueDateIn(d.getFullYear(), d.getMonth() + 1, r.day) === day) part.push(`${r.type === 'INCOME' ? '💰' : '💸'} ${r.memo || r.category} ${r.type === 'INCOME' ? '들어오는 날' : '나가는 날'} (${won(r.amount)})`)
    }
    for (const s of data.savings ?? []) if (day >= s.startDate && day < s.endDate && isDueOn(s.schedule, day)) part.push(`🐷 ${s.name} 넣는 날 (${won(s.amount)})`)
    count += part.length
    if (!part.length) continue
    if (!single) lines.push(`\n${dayLabel(day)}${day === today ? ' · 오늘' : ''}`)
    lines.push(...part.map((p) => `• ${p}`))
  }
  // 오늘을 물었으면 마감이 지난 할 일도 알려 준다
  const overdue = days.includes(today) ? todos.filter((t) => t.dueDate && t.dueDate < today) : []
  if (overdue.length) lines.push(`\n⚠️ 마감이 지난 할 일 ${overdue.length}개: ${overdue.slice(0, 3).map((t) => t.title).join(', ')}${overdue.length > 3 ? ' …' : ''}`)
  if (!count) {
    const free = single ? `${q.label}은 캘린더에 일정도, 마감인 할 일도 없어요. 여유로운 하루예요 😊` : `${q.label}에는 캘린더에 일정도, 마감인 할 일도 없어요 😊`
    return overdue.length ? `${free}${lines.join('\n')}` : free
  }
  return `${q.label} 일정이에요.\n${lines.join('\n').trim()}`
}

function spendingAnswer(q: Extract<QuickIntent, { kind: 'spending' }>, data: QuickData, text: string): string {
  const list = (data.transactions ?? []).filter((t) => t.date >= q.from && t.date <= q.to)
  const type = q.income ? 'INCOME' : 'EXPENSE'
  const word = q.income ? '수입' : '지출'
  const shares = categoryShares(list, type)
  // "식비 얼마 썼어?" 처럼 카테고리를 물었으면 그것만
  const cat = shares.find((s) => s.category.split('/').some((c) => c && text.includes(c)))
  if (cat) return `${q.label} ${cat.category}는 ${won(cat.amount)}이에요 (${cat.count}건, ${word}의 ${cat.percent}%).`
  const total = shares.reduce((s, r) => s + r.amount, 0)
  if (!total) return `${q.label}에는 ${word} 기록이 없어요.`
  const top = shares.slice(0, 3).map((s) => `• ${s.category} ${won(s.amount)} (${s.percent}%)`)
  const other = q.income ? '' : (() => {
    const income = list.filter((t) => t.type === 'INCOME').reduce((s, t) => s + t.amount, 0)
    return income ? `\n같은 기간 수입은 ${won(income)}이에요.` : ''
  })()
  return `${q.label} ${word}은 모두 ${won(total)}이에요 (${list.filter((t) => t.type === type).length}건).\n${q.income ? '들어온 곳' : '많이 쓴 곳'}:\n${top.join('\n')}${other}`
}

function budgetAnswer(data: QuickData, today: string): string {
  const ym = today.slice(0, 7)
  const s = budgetStatus(data.budgets ?? [], data.transactions ?? [], ym, today)
  if (!s.total && !s.categories.length) return '아직 예산을 정하지 않았어요. 가계부 화면의 예산에서 한 달 예산을 정하면 남은 돈을 알려 드릴게요.'
  const out: string[] = []
  if (s.total) {
    const t = s.total
    out.push(
      t.left >= 0
        ? `이번 달 예산 ${won(t.budget)} 중 ${won(t.spent)}을 썼어요 (${t.pct}%). ${won(t.left)} 남았어요.${s.perDay !== null && s.daysLeft ? ` 남은 ${s.daysLeft}일 동안 하루 ${won(s.perDay)}씩 쓸 수 있어요.` : ''}`
        : `이번 달 예산 ${won(t.budget)}을 ${won(-t.left)} 넘었어요 (${t.pct}%). 남은 날은 조금 아껴 봐요 💪`,
    )
  }
  const watch = s.categories.filter((c) => c.level !== 'ok')
  if (watch.length) out.push(`조심할 곳: ${watch.map((c) => `${c.category} ${c.pct}%${c.left < 0 ? ` (${won(-c.left)} 넘음)` : ` (${won(c.left)} 남음)`}`).join(', ')}`)
  else if (s.categories.length) out.push(`카테고리 예산은 모두 괜찮아요: ${s.categories.map((c) => `${c.category} ${won(c.left)} 남음`).join(', ')}`)
  return out.join('\n')
}

function savingsAnswer(data: QuickData, today: string): string {
  const plans = data.savings ?? []
  if (!plans.length) return '아직 등록한 적금이 없어요. 가계부 화면의 적금에서 추가할 수 있어요.'
  const lines = plans.map((p) => {
    const g = progressOf(p, today)
    if (g.matured) return `• ${p.name}: 만기 끝 (${dayLabel(p.endDate)}), 넣은 돈 ${won(g.saved)}`
    return `• ${p.name}: ${won(g.saved)} 모았어요 (${g.done}/${g.total}회), 만기까지 D-${g.daysLeft}${g.next ? `, 다음 넣는 날 ${g.next === today ? '오늘' : dayLabel(g.next)}` : ''}`
  })
  const total = plans.reduce((s, p) => s + progressOf(p, today).saved, 0)
  return `적금 ${plans.length}개, 지금까지 모두 ${won(total)} 모았어요.\n${lines.join('\n')}`
}

function recurringAnswer(q: Extract<QuickIntent, { kind: 'recurring' }>, data: QuickData, today: string): string {
  const list = (data.recurring ?? []).filter((r) => r.isActive && r.type === (q.income ? 'INCOME' : 'EXPENSE'))
  if (!list.length) return q.income ? '정기 수입(월급, 용돈)을 아직 등록하지 않았어요. 가계부의 정기 내역에서 넣으면 며칠 남았는지 알려 드릴게요.' : '등록한 정기 결제가 없어요.'
  const rows = list
    .map((r) => ({ r, d: ddayFor(r.day, today) }))
    .sort((a, b) => a.d.daysLeft - b.d.daysLeft)
    .map(({ r, d }) => `• ${r.memo || r.category} ${won(r.amount)}: ${d.daysLeft === 0 ? '오늘이에요!' : `${dayLabel(d.date)}, D-${d.daysLeft}`}`)
  return `${q.income ? '들어올 돈' : '나갈 돈'}이에요.\n${rows.join('\n')}`
}

function diaryAnswer(q: Extract<QuickIntent, { kind: 'diary' }>, data: QuickData): string {
  const d = data.diary
  if (!d || (!d.text.trim() && !d.photos?.length && !d.photo)) return `${q.label}에는 쓴 일기가 없어요.`
  const text = d.text.trim()
  const photos = d.photos?.length ?? (d.photo ? 1 : 0)
  return `${q.label} 일기예요${photos ? ` (사진 ${photos}장)` : ''}.\n${text ? `"${text.length > 300 ? `${text.slice(0, 300)}…` : text}"` : '글 없이 사진만 남겼어요.'}`
}

/** 기록으로 답을 만든다 */
export function answerQuick(q: QuickIntent, data: QuickData, today: string, text = ''): string {
  switch (q.kind) {
    case 'schedule':
      return scheduleAnswer(q, data, today)
    case 'spending':
      return spendingAnswer(q, data, text)
    case 'budget':
      return budgetAnswer(data, today)
    case 'savings':
      return savingsAnswer(data, today)
    case 'recurring':
      return recurringAnswer(q, data, today)
    case 'diary':
      return diaryAnswer(q, data)
  }
}

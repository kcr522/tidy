import { addDays, addMonths, endOfMonth, format, getDay, getDaysInMonth } from 'date-fns'
import type { Budget, CalendarEvent, Diary, Habit, HabitCheck, Memo, MemoFolder, Todo, Transaction } from '../db/types'
import { cellWon } from './calendar'
import { parseDateKey } from './date'
import { holidaysBetween } from './holidays'
import { memoTitle, sortMemos } from './memo'
import { isDueOn } from './savings'
import { todayTodos } from './summary'
import { DEFAULT_OPACITY, WIDGET_KINDS, type WidgetOpacity } from './widgetSettings'

/** 홈 화면 위젯이 앱 없이 며칠 동안 맞게 보이도록 미리 계산해 두는 날 수 */
export const WIDGET_DAYS = 7
/** '오늘' 위젯에 보여 줄 할 일 수 */
export const WIDGET_ITEMS = 4
/** 요약에 담아 두는 하루 할 일 수 ('할 일' 위젯이 이만큼까지 보여 준다) */
export const WIDGET_TODO_ITEMS = 8
/** 요약에 담아 두는 하루 일정 수 */
export const WIDGET_EVENTS = 5
/** 요약에 담아 두는 하루 습관 수 */
export const WIDGET_HABITS = 8
/** 요약에 담아 두는 최근 메모 수 ('메모' 위젯) */
export const WIDGET_MEMOS = 5

/** 위젯에 담는 메모 하나 */
export interface WidgetMemo {
  id: number
  /** 제목 (없으면 첫 줄). 잠금 중이면 비어 있다 */
  t: string
  /** 쓴 때: ISO (위젯이 오늘이면 시각, 아니면 날짜로 보여 준다) */
  at: string
  /** 파일집 색 (#rrggbb). 파일집 밖이면 빈 글자 */
  c: string
  /** 고정한 메모면 1 */
  p: 0 | 1
}

/** 위젯에 담는 일정 하나 */
export interface WidgetEvent {
  t: string
  /** 그날 시작하는 일정이면 1 (여러 날 일정은 첫날과 오늘에만 보인다) */
  f: 0 | 1
}

/** 위젯에 담는 습관 하나 */
export interface WidgetHabit {
  e: string
  t: string
  d: 0 | 1
}

export interface WidgetDay {
  /** 그날 할 일 중 끝낸 것 */
  done: number
  /** 그날 할 일 전체 (마감일이 그날 + 지났는데 못 끝낸 것) */
  total: number
  /** 앞에서부터 몇 개. 못 끝낸 것이 먼저. 잠금 중이면 비어 있다 */
  items: { t: string; d: 0 | 1 }[]
  /** 그날 지출. 잠금 중이면 null */
  spend: number | null
  /** 그날 일정 (앞에서부터 WIDGET_EVENTS개). 잠금 중이면 비어 있다 */
  ev: WidgetEvent[]
  /** 그날 일정 전체 수 */
  evn: number
  /** 그날 할 습관. 잠금 중이면 제목은 비운다 */
  hb: WidgetHabit[]
  /** 그날 할 습관 전체 수와 한 수 */
  hbn: number
  hbd: number
}

/**
 * 안드로이드 위젯에 넘기는 요약 (JSON으로 저장된다).
 * 위젯은 앱이 꺼져 있어도 날짜가 바뀌면 오늘 칸을 골라 보여 준다.
 */
export interface WidgetSummary {
  v: 2
  /** 잠금이 켜져 있으면 할 일 제목과 금액을 숨긴다 */
  locked: boolean
  /** YYYY-MM-DD → 그날 요약 (오늘부터 WIDGET_DAYS일) */
  days: Record<string, WidgetDay>
  /** YYYY-MM → 그달 지출 합계. 잠금 중이면 비어 있다 */
  months: Record<string, number>
  /** 한 달 전체 예산 (원). 없거나 잠금 중이면 null */
  budget: number | null
  /** 위젯 종류마다 바탕 투명도 (%) */
  opacity: WidgetOpacity
  /** 최근 메모 (고정 먼저, 그다음 최근에 쓴 것). 잠금 중이면 제목을 비운다 */
  memos: WidgetMemo[]
  /** 메모 전체 수 */
  memon: number
  /** 달력 위젯: YYYY-MM → 그달 칸 (이번 달과 다음 달) */
  cal: Record<string, WidgetCalMonth>
}

/** 달력 위젯 한 달. 키는 날짜 숫자 ('1'~'31') */
export interface WidgetCalMonth {
  /** 그날 지출. 잠금 중이면 비어 있다 */
  s: Record<string, number>
  /** 그날 일정: [일정 수, 앞 일정 제목 3개까지]. 잠금 중이면 비어 있다 */
  e: Record<string, [number, ...string[]]>
  /** 일기 쓴 날: 일기 색. 잠금 중이면 비어 있다 */
  d: Record<string, string>
  /** 공휴일인 날 */
  h: number[]
}

/** 할 일, 지출 말고 다른 위젯이 쓰는 것들 (없으면 빈 칸) */
export interface WidgetExtras {
  /** 오늘 ~ 오늘 + WIDGET_DAYS일과 겹치는 일정 */
  events?: CalendarEvent[]
  habits?: Habit[]
  /** 습관 체크 (기간 밖 것은 무시한다) */
  checks?: HabitCheck[]
  budgets?: Budget[]
  opacity?: WidgetOpacity
  /** 이번 달과 다음 달 일기 (날짜와 색만 쓴다) */
  diaries?: Pick<Diary, 'date' | 'color'>[]
  memos?: Memo[]
  memoFolders?: MemoFolder[]
}

const defaultOpacity = (): WidgetOpacity => Object.fromEntries(WIDGET_KINDS.map(({ kind }) => [kind, DEFAULT_OPACITY])) as WidgetOpacity

/**
 * @param todos 모든 할 일
 * @param transactions 이번 달 1일부터 (오늘 + WIDGET_DAYS일)까지의 내역
 */
export function buildWidgetSummary(todos: Todo[], transactions: Transaction[], today: string, locked: boolean, extras: WidgetExtras = {}): WidgetSummary {
  const events = [...(extras.events ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate) || a.title.localeCompare(b.title))
  const habits = [...(extras.habits ?? [])].sort((a, b) => a.order - b.order)
  const checked = new Set((extras.checks ?? []).map((c) => `${c.habitId}|${c.date}`))

  const spendByDate = new Map<string, number>()
  const months: Record<string, number> = {}
  for (const t of transactions) {
    if (t.type !== 'EXPENSE') continue
    spendByDate.set(t.date, (spendByDate.get(t.date) ?? 0) + t.amount)
    if (!locked) {
      const ym = t.date.slice(0, 7)
      months[ym] = (months[ym] ?? 0) + t.amount
    }
  }

  const days: Record<string, WidgetDay> = {}
  const start = parseDateKey(today)
  for (let i = 0; i < WIDGET_DAYS; i++) {
    const key = format(addDays(start, i), 'yyyy-MM-dd')
    const list = todayTodos(todos, key)
    const ym = key.slice(0, 7)
    if (!locked && months[ym] === undefined) months[ym] = 0
    const dayEvents = events.filter((e) => e.startDate <= key && e.endDate >= key)
    const dayHabits = habits.filter((h) => !h.schedule || isDueOn(h.schedule, key)).map((h) => ({ h, d: (checked.has(`${h.id}|${key}`) ? 1 : 0) as 0 | 1 }))
    days[key] = {
      done: list.filter((t) => t.isCompleted === 1).length,
      total: list.length,
      items: locked ? [] : list.slice(0, WIDGET_TODO_ITEMS).map((t) => ({ t: t.title, d: t.isCompleted })),
      spend: locked ? null : (spendByDate.get(key) ?? 0),
      ev: locked ? [] : dayEvents.slice(0, WIDGET_EVENTS).map((e) => ({ t: e.title, f: (e.startDate === key ? 1 : 0) as 0 | 1 })),
      evn: dayEvents.length,
      hb: dayHabits.slice(0, WIDGET_HABITS).map(({ h, d }) => ({ e: h.emoji, t: locked ? '' : h.title, d })),
      hbn: dayHabits.length,
      hbd: dayHabits.filter((x) => x.d === 1).length,
    }
  }
  const total = extras.budgets?.find((b) => b.category === '')
  const cal = buildCal(transactions, events, extras.diaries ?? [], today, locked)
  const folderColor = new Map((extras.memoFolders ?? []).map((f) => [f.id, f.color]))
  const memos = sortMemos(extras.memos ?? [])
    .slice(0, WIDGET_MEMOS)
    .map((m) => ({ id: m.id ?? 0, t: locked ? '' : memoTitle(m), at: m.createdAt, c: (m.folderId && folderColor.get(m.folderId)) || '', p: (m.pinned ? 1 : 0) as 0 | 1 }))
  return { v: 2, locked, days, months, budget: locked || !total ? null : total.amount, opacity: extras.opacity ?? defaultOpacity(), cal, memos, memon: extras.memos?.length ?? 0 }
}

/** 달력 위젯이 앱 없이 다음 달까지 보이도록 이번 달과 다음 달을 담는다 */
function buildCal(transactions: Transaction[], events: CalendarEvent[], diaries: Pick<Diary, 'date' | 'color'>[], today: string, locked: boolean): Record<string, WidgetCalMonth> {
  const cal: Record<string, WidgetCalMonth> = {}
  const first = parseDateKey(`${today.slice(0, 7)}-01`)
  for (let m = 0; m < 2; m++) {
    const start = addMonths(first, m)
    const ym = format(start, 'yyyy-MM')
    const last = format(endOfMonth(start), 'yyyy-MM-dd')
    const month: WidgetCalMonth = { s: {}, e: {}, d: {}, h: [] }
    for (const key of holidaysBetween(`${ym}-01`, last).keys()) month.h.push(Number(key.slice(8)))
    cal[ym] = month
    if (locked) continue
    for (const t of transactions) {
      if (t.type !== 'EXPENSE' || t.date.slice(0, 7) !== ym) continue
      const d = String(Number(t.date.slice(8)))
      month.s[d] = (month.s[d] ?? 0) + t.amount
    }
    for (const dy of diaries) if (dy.date.slice(0, 7) === ym) month.d[String(Number(dy.date.slice(8)))] = dy.color || '#1d8fe1'
    const n = getDaysInMonth(start)
    for (let day = 1; day <= n; day++) {
      const key = `${ym}-${String(day).padStart(2, '0')}`
      const on = events.filter((e) => e.startDate <= key && e.endDate >= key)
      if (on.length > 0) month.e[String(day)] = [on.length, ...on.slice(0, CAL_EVENT_LINES.large).map((e) => e.title)]
    }
  }
  return cal
}

/** 위젯용 내역 · 일정을 읽을 범위: [이번 달 1일, 다다음 달 1일) — 달력 위젯이 다음 달까지 쓴다 */
export function widgetRange(today: string): [string, string] {
  const first = parseDateKey(`${today.slice(0, 7)}-01`)
  return [`${today.slice(0, 7)}-01`, format(addMonths(first, 2), 'yyyy-MM-dd')]
}

/** 위젯 한 장에 보이는 내용. 안드로이드 TidyWidget.java 도 같은 규칙으로 그린다 */
export interface WidgetView {
  /** "11월 10일 화요일" */
  dateLabel: string
  /** 요약이 너무 오래돼 오늘 칸이 없다 (앱을 열면 새로 고쳐진다) */
  stale: boolean
  locked: boolean
  done: number
  total: number
  items: { t: string; d: 0 | 1 }[]
  /** 보이지 않는 나머지 할 일 수 */
  more: number
  /** "오늘 지출 12,300원 · 11월 523,000원". 잠금 중이면 null */
  money: string | null
}

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function dateLabelOf(today: string): string {
  const date = parseDateKey(today)
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`
}

export function widgetView(s: WidgetSummary | null, today: string): WidgetView {
  const date = parseDateKey(today)
  const dateLabel = dateLabelOf(today)
  const day = s?.days[today]
  if (!s || !day) return { dateLabel, stale: true, locked: s?.locked ?? false, done: 0, total: 0, items: [], more: 0, money: null }
  const month = s.months[today.slice(0, 7)]
  const money = s.locked || day.spend === null ? null : `오늘 지출 ${day.spend.toLocaleString('ko-KR')}원 · ${date.getMonth() + 1}월 ${(month ?? 0).toLocaleString('ko-KR')}원`
  const items = day.items.slice(0, WIDGET_ITEMS)
  return { dateLabel, stale: false, locked: s.locked, done: day.done, total: day.total, items, more: s.locked ? 0 : day.total - items.length, money }
}

/** '할 일' 위젯 */
export interface TodoWidgetView {
  stale: boolean
  locked: boolean
  done: number
  total: number
  items: { t: string; d: 0 | 1 }[]
  more: number
}

export function todoWidgetView(s: WidgetSummary | null, today: string): TodoWidgetView {
  const day = s?.days[today]
  if (!s || !day) return { stale: true, locked: s?.locked ?? false, done: 0, total: 0, items: [], more: 0 }
  return { stale: false, locked: s.locked, done: day.done, total: day.total, items: day.items, more: s.locked ? 0 : day.total - day.items.length }
}

/** '가계부' 위젯 */
export interface MoneyWidgetView {
  stale: boolean
  locked: boolean
  /** "11월" */
  monthLabel: string
  today: number
  month: number
  /** 한 달 예산이 없으면 null */
  budget: number | null
  /** 남은 예산 (넘으면 음수) */
  left: number
  /** 예산 중 쓴 비율 (0~100으로 자른다) */
  pct: number
}

export function moneyWidgetView(s: WidgetSummary | null, today: string): MoneyWidgetView {
  const monthLabel = `${parseDateKey(today).getMonth() + 1}월`
  const day = s?.days[today]
  const empty = { monthLabel, today: 0, month: 0, budget: null, left: 0, pct: 0 }
  if (!s || !day) return { stale: true, locked: s?.locked ?? false, ...empty }
  if (s.locked || day.spend === null) return { stale: false, locked: true, ...empty }
  const month = s.months[today.slice(0, 7)] ?? 0
  const budget = s.budget ?? null
  const pct = budget ? Math.min(100, Math.round((month / budget) * 100)) : 0
  return { stale: false, locked: false, monthLabel, today: day.spend, month, budget, left: budget ? budget - month : 0, pct }
}

/** '일정' 위젯: 오늘부터 남은 날의 일정을 차례로 */
export interface EventWidgetView {
  stale: boolean
  locked: boolean
  /** 오늘 일정 수 (잠금 중에도 센다) */
  todayCount: number
  rows: { label: string; t: string; today: boolean }[]
}

/** 일정 위젯에 보여 줄 줄 수 */
export const WIDGET_EVENT_ROWS = 5

export function dayShortLabel(key: string, today: string): string {
  if (key === today) return '오늘'
  if (key === format(addDays(parseDateKey(today), 1), 'yyyy-MM-dd')) return '내일'
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()} ${WEEKDAYS[d.getDay()].slice(0, 1)}`
}

export function eventWidgetView(s: WidgetSummary | null, today: string): EventWidgetView {
  const day = s?.days[today]
  if (!s || !day) return { stale: true, locked: s?.locked ?? false, todayCount: 0, rows: [] }
  const rows: EventWidgetView['rows'] = []
  if (!s.locked) {
    for (const key of Object.keys(s.days).sort()) {
      if (key < today) continue
      for (const e of s.days[key].ev ?? []) {
        if (key !== today && e.f !== 1) continue
        if (rows.length < WIDGET_EVENT_ROWS) rows.push({ label: dayShortLabel(key, today), t: e.t, today: key === today })
      }
    }
  }
  return { stale: false, locked: s.locked, todayCount: day.evn ?? 0, rows }
}

/** '습관' 위젯 */
export interface HabitWidgetView {
  stale: boolean
  locked: boolean
  done: number
  total: number
  items: WidgetHabit[]
}

export function habitWidgetView(s: WidgetSummary | null, today: string): HabitWidgetView {
  const day = s?.days[today]
  if (!s || !day) return { stale: true, locked: s?.locked ?? false, done: 0, total: 0, items: [] }
  return { stale: false, locked: s.locked, done: day.hbd ?? 0, total: day.hbn ?? 0, items: day.hb ?? [] }
}

/** 달력 위젯에서 보는 것 */
export type CalendarMode = 'money' | 'diary' | 'event'

/** 달력 위젯 크기: 위젯 높이로 고른다 (안드로이드 CalendarWidget.sizeOf 와 같은 기준) */
export type CalendarSize = 'small' | 'medium' | 'large'

/** 크기마다 한 칸에 보여 줄 일정 줄 수 */
export const CAL_EVENT_LINES: Record<CalendarSize, number> = { small: 1, medium: 2, large: 4 }

/** 위젯 높이(dp)로 크기를 고른다: 300 미만 작게, 450 미만 보통, 그 이상 크게 (폰 화면 가득) */
export function calendarSizeOf(heightDp: number): CalendarSize {
  return heightDp < 300 ? 'small' : heightDp < 450 ? 'medium' : 'large'
}

export const CALENDAR_MODES: { mode: CalendarMode; label: string }[] = [
  { mode: 'money', label: '💰 돈' },
  { mode: 'diary', label: '📔 일기' },
  { mode: 'event', label: '📅 일정' },
]

export interface CalendarCell {
  day: number
  today: boolean
  /** 0 = 일요일 ~ 6 = 토요일 */
  weekday: number
  holiday: boolean
  /** 칸 아래 글자 줄 (지출 금액 한 줄, 일정 제목 여러 줄). 없으면 빈 배열 */
  lines: string[]
  /** 일기 모드: 일기 색 (쓴 날만) */
  dot: string | null
}

/** '달력' 위젯: 이번 달 칸 (주 단위로, 앞뒤 빈칸은 null) */
export interface CalendarWidgetView {
  stale: boolean
  locked: boolean
  /** "11월" */
  monthLabel: string
  /** 머리줄 오른쪽 요약: "지출 21.6만" · "일기 5일" · "일정 7개" */
  sum: string
  weeks: (CalendarCell | null)[][]
}

export function calendarWidgetView(s: WidgetSummary | null, today: string, mode: CalendarMode, size: CalendarSize = 'medium'): CalendarWidgetView {
  const ym = today.slice(0, 7)
  const first = parseDateKey(`${ym}-01`)
  const monthLabel = `${first.getMonth() + 1}월`
  const month = s?.cal?.[ym]
  const n = getDaysInMonth(first)
  const lead = getDay(first)
  const todayNum = Number(today.slice(8))
  const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= n; day++) {
    const k = String(day)
    let lines: string[] = []
    let dot: string | null = null
    if (month && !s!.locked) {
      if (mode === 'money' && month.s[k]) lines = [cellWon(month.s[k])]
      if (mode === 'event' && month.e[k]) lines = eventLines(month.e[k], CAL_EVENT_LINES[size])
      if (mode === 'diary') dot = month.d[k] ?? null
    }
    cells.push({ day, today: day === todayNum, weekday: (lead + day - 1) % 7, holiday: month?.h.includes(day) ?? false, lines, dot })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (CalendarCell | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  let sum = ''
  if (month && s && !s.locked) {
    if (mode === 'money') sum = `지출 ${cellWon(Object.values(month.s).reduce((a, b) => a + b, 0))}원`
    if (mode === 'diary') sum = `일기 ${Object.keys(month.d).length}일`
    if (mode === 'event') sum = `일정 있는 날 ${Object.keys(month.e).length}일`
  }
  return { stale: !month, locked: s?.locked ?? false, monthLabel, sum, weeks }
}

/** '메모' 위젯: 최근 메모. 안드로이드 MemoWidget.java 도 같은 규칙으로 그린다 */
export interface MemoWidgetView {
  locked: boolean
  total: number
  rows: { id: number; t: string; when: string; c: string; p: 0 | 1 }[]
}

/** 메모 위젯에 보여 줄 줄 수 */
export const WIDGET_MEMO_ROWS = 4

/** 오늘 쓴 것은 "오후 2:05", 아니면 "11/14" */
export function memoWhen(iso: string, today: string): string {
  const d = new Date(iso)
  if (format(d, 'yyyy-MM-dd') === today) return d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export function memoWidgetView(s: WidgetSummary | null, today: string): MemoWidgetView {
  if (!s) return { locked: false, total: 0, rows: [] }
  const rows = s.locked ? [] : (s.memos ?? []).slice(0, WIDGET_MEMO_ROWS).map((m) => ({ id: m.id, t: m.t, when: memoWhen(m.at, today), c: m.c, p: m.p }))
  return { locked: s.locked, total: s.memon ?? 0, rows }
}

/** 한 칸의 일정 줄: 넘치면 마지막 줄을 "+남은 수"로 (줄이 하나뿐이면 첫 제목만) */
export function eventLines(entry: [number, ...string[]], max: number): string[] {
  const [count, ...titles] = entry
  if (count <= max || max < 2) return titles.slice(0, max)
  return [...titles.slice(0, max - 1), `+${count - (max - 1)}`]
}

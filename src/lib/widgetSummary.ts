import { addDays, format } from 'date-fns'
import type { Budget, CalendarEvent, Habit, HabitCheck, Memo, MemoFolder, Todo, Transaction } from '../db/types'
import { parseDateKey } from './date'
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
  const folderColor = new Map((extras.memoFolders ?? []).map((f) => [f.id, f.color]))
  const memos = sortMemos(extras.memos ?? [])
    .slice(0, WIDGET_MEMOS)
    .map((m) => ({ id: m.id ?? 0, t: locked ? '' : memoTitle(m), at: m.createdAt, c: (m.folderId && folderColor.get(m.folderId)) || '', p: (m.pinned ? 1 : 0) as 0 | 1 }))
  return { v: 2, locked, days, months, budget: locked || !total ? null : total.amount, opacity: extras.opacity ?? defaultOpacity(), memos, memon: extras.memos?.length ?? 0 }
}

/** 위젯용 내역을 읽을 범위: [이번 달 1일, 오늘 + WIDGET_DAYS일) */
export function widgetRange(today: string): [string, string] {
  return [`${today.slice(0, 7)}-01`, format(addDays(parseDateKey(today), WIDGET_DAYS), 'yyyy-MM-dd')]
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

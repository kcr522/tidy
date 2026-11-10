import { addDays, format } from 'date-fns'
import type { Todo, Transaction } from '../db/types'
import { parseDateKey } from './date'
import { todayTodos } from './summary'

/** 홈 화면 위젯이 앱 없이 며칠 동안 맞게 보이도록 미리 계산해 두는 날 수 */
export const WIDGET_DAYS = 7
/** 하루에 위젯에 보여 줄 할 일 수 */
export const WIDGET_ITEMS = 4

export interface WidgetDay {
  /** 그날 할 일 중 끝낸 것 */
  done: number
  /** 그날 할 일 전체 (마감일이 그날 + 지났는데 못 끝낸 것) */
  total: number
  /** 앞에서부터 몇 개. 못 끝낸 것이 먼저. 잠금 중이면 비어 있다 */
  items: { t: string; d: 0 | 1 }[]
  /** 그날 지출. 잠금 중이면 null */
  spend: number | null
}

/**
 * 안드로이드 위젯에 넘기는 요약 (JSON으로 저장된다).
 * 위젯은 앱이 꺼져 있어도 날짜가 바뀌면 오늘 칸을 골라 보여 준다.
 */
export interface WidgetSummary {
  v: 1
  /** 잠금이 켜져 있으면 할 일 제목과 금액을 숨긴다 */
  locked: boolean
  /** YYYY-MM-DD → 그날 요약 (오늘부터 WIDGET_DAYS일) */
  days: Record<string, WidgetDay>
  /** YYYY-MM → 그달 지출 합계. 잠금 중이면 비어 있다 */
  months: Record<string, number>
}

/**
 * @param todos 모든 할 일
 * @param transactions 이번 달 1일부터 (오늘 + WIDGET_DAYS일)까지의 내역
 */
export function buildWidgetSummary(todos: Todo[], transactions: Transaction[], today: string, locked: boolean): WidgetSummary {
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
    days[key] = {
      done: list.filter((t) => t.isCompleted === 1).length,
      total: list.length,
      items: locked ? [] : list.slice(0, WIDGET_ITEMS).map((t) => ({ t: t.title, d: t.isCompleted })),
      spend: locked ? null : (spendByDate.get(key) ?? 0),
    }
  }
  return { v: 1, locked, days, months }
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

export function widgetView(s: WidgetSummary | null, today: string): WidgetView {
  const date = parseDateKey(today)
  const dateLabel = `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAYS[date.getDay()]}`
  const day = s?.days[today]
  if (!s || !day) return { dateLabel, stale: true, locked: s?.locked ?? false, done: 0, total: 0, items: [], more: 0, money: null }
  const month = s.months[today.slice(0, 7)]
  const money = s.locked || day.spend === null ? null : `오늘 지출 ${day.spend.toLocaleString('ko-KR')}원 · ${date.getMonth() + 1}월 ${(month ?? 0).toLocaleString('ko-KR')}원`
  return { dateLabel, stale: false, locked: s.locked, done: day.done, total: day.total, items: day.items, more: s.locked ? 0 : day.total - day.items.length, money }
}

import { differenceInCalendarDays } from 'date-fns'
import type { CalendarEvent, EventColor, PresetEventColor, Todo } from '../db/types'
import { parseDateKey } from './date'
import type { Holiday } from './holidays'

/** 일정 색: 막대 배경. 밝은 색은 글자를 어둡게 (eventFg) */
export const EVENT_COLORS: Record<PresetEventColor, { label: string; bg: string }> = {
  red: { label: '빨강', bg: '#e5484d' },
  coral: { label: '코랄', bg: '#ff7a6b' },
  orange: { label: '주황', bg: '#f0892b' },
  yellow: { label: '노랑', bg: '#f5c518' },
  lime: { label: '연두', bg: '#8fc93a' },
  green: { label: '초록', bg: '#2bab6c' },
  mint: { label: '민트', bg: '#3cc8b4' },
  teal: { label: '청록', bg: '#12a4a8' },
  sky: { label: '하늘', bg: '#4cb8f0' },
  blue: { label: '파랑', bg: '#3b95e8' },
  navy: { label: '남색', bg: '#2f4a8a' },
  indigo: { label: '인디고', bg: '#5b5fd6' },
  purple: { label: '보라', bg: '#8c6cf0' },
  lavender: { label: '라벤더', bg: '#b59cf5' },
  magenta: { label: '자홍', bg: '#d03fb8' },
  pink: { label: '핑크', bg: '#e8618c' },
  rose: { label: '연분홍', bg: '#f4a3b8' },
  brown: { label: '갈색', bg: '#a0704c' },
  olive: { label: '올리브', bg: '#8a8a3c' },
  gray: { label: '회색', bg: '#8b95a1' },
  black: { label: '검정', bg: '#333d4b' },
}

export const PRESET_EVENT_COLORS = Object.keys(EVENT_COLORS) as PresetEventColor[]

const HEX = /^#[0-9a-f]{6}$/i

/** 저장해도 되는 색인가 (이름 있는 색 또는 #rrggbb) */
export function isEventColor(v: unknown): v is EventColor {
  return typeof v === 'string' && (v in EVENT_COLORS || HEX.test(v))
}

/** 막대 배경색 */
export function eventBg(c: EventColor | undefined): string {
  if (c && c in EVENT_COLORS) return EVENT_COLORS[c as PresetEventColor].bg
  return c && HEX.test(c) ? c : EVENT_COLORS.pink.bg
}

/** 막대 글자색: 밝은 배경이면 진한 글씨, 아니면 흰 글씨 */
export function eventFg(c: EventColor | undefined): string {
  const hex = eventBg(c)
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
  return lum > 0.45 ? '#191f28' : '#ffffff'
}

/** 색 이름 (직접 고른 색은 '직접 고른 색') */
export function eventColorLabel(c: EventColor): string {
  return c in EVENT_COLORS ? EVENT_COLORS[c as PresetEventColor].label : '직접 고른 색'
}

/** 사진 없는 일기를 캘린더에 칠할 색 (아무거나 하나 고른다) */
export const DIARY_COLORS = ['#ffb3c7', '#ffd08a', '#a8e6a1', '#9fd8ff', '#c8b6ff', '#ffe27a', '#8ee3d6', '#f7a8f0']

export function randomDiaryColor(random: () => number = Math.random): string {
  return DIARY_COLORS[Math.floor(random() * DIARY_COLORS.length) % DIARY_COLORS.length]
}

/** 달력 한 줄(일주일)에 그릴 막대 한 개 */
export interface Bar {
  key: string
  kind: 'event' | 'todo' | 'holiday'
  title: string
  /** 이 주에서 시작하는 칸 (0=일요일) */
  col: number
  /** 몇 칸 차지하는지 */
  span: number
  /** 위에서 몇 번째 줄 */
  lane: number
  /** 지난주에서 이어짐 / 다음 주로 이어짐 (모서리를 평평하게) */
  fromPrev: boolean
  toNext: boolean
  event?: CalendarEvent
  todo?: Todo
  holiday?: Holiday
}

export interface WeekLayout {
  days: string[]
  bars: Bar[]
  /** 칸마다 다 못 그려서 숨긴 개수 */
  hidden: number[]
  /** 이 주에서 쓴 줄 수 (줄마다 높이가 글자 길이에 맞게 늘어난다) */
  lanes: number
}

/** 그날 일정이 있는가 (기간 포함) */
export function eventCovers(e: CalendarEvent, date: string): boolean {
  return e.startDate <= date && date <= e.endDate
}

/** 일정 기간 일수 (하루짜리 = 1) */
export function eventDays(e: Pick<CalendarEvent, 'startDate' | 'endDate'>): number {
  return differenceInCalendarDays(parseDateKey(e.endDate), parseDateKey(e.startDate)) + 1
}

/**
 * 달력 칸 목록(7의 배수)을 주 단위로 나누고, 일정과 할 일을 막대로 배치한다.
 * - 긴 일정이 위에, 같은 길이면 먼저 시작한 것이 위에 온다.
 * - 여러 주에 걸친 일정은 주마다 잘라서 이어 그린다 (스크린샷처럼).
 * - 할 일은 마감일 칸에 하루짜리로 일정 아래쪽에 들어간다.
 * - 칸마다 maxLanes 줄까지만 그리고 나머지는 hidden 개수로 센다.
 * - 공휴일은 맨 위 줄에 먼저 들어간다.
 */
export function layoutWeeks(gridDays: string[], events: CalendarEvent[], todos: Todo[], maxLanes: number, holidays?: Map<string, Holiday[]>): WeekLayout[] {
  const weeks: WeekLayout[] = []
  const sortedEvents = [...events].sort(
    (a, b) => eventDays(b) - eventDays(a) || a.startDate.localeCompare(b.startDate) || a.title.localeCompare(b.title),
  )
  const datedTodos = todos
    .filter((t) => t.dueDate)
    .sort((a, b) => a.isCompleted - b.isCompleted || a.createdAt.localeCompare(b.createdAt))

  for (let w = 0; w < gridDays.length; w += 7) {
    const days = gridDays.slice(w, w + 7)
    const first = days[0]
    const last = days[6]
    // lanes[줄][칸] = 차지했는가
    const lanes: boolean[][] = []
    const bars: Bar[] = []
    const hidden = Array(7).fill(0) as number[]

    const place = (col: number, span: number): number => {
      for (let lane = 0; lane < maxLanes; lane++) {
        lanes[lane] ??= Array(7).fill(false)
        let free = true
        for (let c = col; c < col + span; c++) if (lanes[lane][c]) free = false
        if (free) {
          for (let c = col; c < col + span; c++) lanes[lane][c] = true
          return lane
        }
      }
      return -1
    }

    days.forEach((d, col) => {
      for (const h of holidays?.get(d) ?? []) {
        const lane = place(col, 1)
        if (lane < 0) hidden[col] += 1
        else bars.push({ key: `h${d}-${h.name}`, kind: 'holiday', title: h.name, col, span: 1, lane, fromPrev: false, toNext: false, holiday: h })
      }
    })

    for (const e of sortedEvents) {
      if (e.endDate < first || e.startDate > last) continue
      const s = e.startDate < first ? first : e.startDate
      const en = e.endDate > last ? last : e.endDate
      const col = days.indexOf(s)
      const span = days.indexOf(en) - col + 1
      const lane = place(col, span)
      if (lane < 0) {
        for (let c = col; c < col + span; c++) hidden[c] += 1
        continue
      }
      bars.push({
        key: `e${e.id}-${first}`, kind: 'event', title: e.title, col, span, lane,
        fromPrev: e.startDate < first, toNext: e.endDate > last, event: e,
      })
    }

    for (const t of datedTodos) {
      const col = days.indexOf(t.dueDate!)
      if (col < 0) continue
      const lane = place(col, 1)
      if (lane < 0) {
        hidden[col] += 1
        continue
      }
      bars.push({ key: `t${t.id}`, kind: 'todo', title: t.title, col, span: 1, lane, fromPrev: false, toNext: false, todo: t })
    }

    weeks.push({ days, bars, hidden, lanes: bars.reduce((n, b) => Math.max(n, b.lane + 1), 0) })
  }
  return weeks
}

/** "11.5" 처럼 짧은 날짜 */
export function shortDate(key: string): string {
  return `${Number(key.slice(5, 7))}.${Number(key.slice(8))}`
}

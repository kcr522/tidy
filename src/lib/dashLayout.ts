/**
 * 대시보드 위젯 배치 (사용자 요청 2026-11-18)
 * 아이패드 홈 화면처럼 둥근 카드 위젯을 격자에 깔고, 꾹 누르면 옮기거나 크기를 바꾼다.
 * - 격자 칸 수는 화면 너비에 따라 다르다 (폰 4칸, 중간 8칸, 넓은 화면 12칸)
 * - 칸 수마다 배치를 따로 저장한다 (폰과 컴퓨터에서 모양이 다르게). 이 기기(localStorage)에만 둔다
 * - 위치는 순서로 정한다: 앞에서부터 빈 곳에 채워 넣는다 (CSS grid dense)
 */

export type DashWidgetKind = 'date' | 'timeline' | 'progress' | 'dday' | 'todos' | 'habitWeek' | 'tracker' | 'money' | 'ai' | 'payday' | 'scrap' | 'route' | 'timer' | 'mood' | 'weather'

export interface DashWidget {
  kind: DashWidgetKind
  /** 가로 칸 수 */
  w: number
  /** 세로 칸 수 */
  h: number
}

export const GRID_COLS = [4, 8, 12] as const
export type GridCols = (typeof GRID_COLS)[number]

/** 위젯 이름과 가장 작은 크기 (칸) */
export const WIDGET_INFO: Record<DashWidgetKind, { name: string; desc: string; minW: number; minH: number; isNew?: boolean }> = {
  date: { name: '날짜 · 달력', desc: '오늘 날짜와 이번 달 달력', minW: 2, minH: 2 },
  timeline: { name: '오늘 시간표', desc: '시간 정한 할 일과 시간별 일기', minW: 2, minH: 3 },
  progress: { name: '할 일 진행', desc: '오늘 할 일을 점으로', minW: 2, minH: 1 },
  dday: { name: '다가오는 일정', desc: '다음 일정까지 며칠 남았는지', minW: 2, minH: 1 },
  todos: { name: '할 일 목록', desc: '오늘 할 일 바로 체크', minW: 2, minH: 2 },
  habitWeek: { name: '습관 일주일', desc: '이번 주 습관을 동그라미로', minW: 2, minH: 2 },
  tracker: { name: '할 일 기록', desc: '끝낸 할 일로 칠한 잔디', minW: 3, minH: 2 },
  money: { name: '가계부', desc: '이번 달 수입 · 지출', minW: 2, minH: 3 },
  ai: { name: 'AI 한마디', desc: '이번 달 소비 이야기', minW: 2, minH: 2 },
  payday: { name: '월급날', desc: '다음 월급까지', minW: 2, minH: 2 },
  scrap: { name: '안 읽은 스크랩', desc: '저장해 둔 링크', minW: 2, minH: 3 },
  route: { name: '이동 기록', desc: '오늘 다닌 길을 지도에', minW: 2, minH: 2 },
  timer: { name: '집중 타이머', desc: '25분 집중 · 스톱워치', minW: 2, minH: 2, isNew: true },
  mood: { name: '오늘 기분', desc: '이모지 하나로 기분 남기기', minW: 2, minH: 2, isNew: true },
  weather: { name: '날씨', desc: '지금 기온과 오늘 비 소식', minW: 2, minH: 2, isNew: true },
}

export const ALL_KINDS = Object.keys(WIDGET_INFO) as DashWidgetKind[]

/** 가장 큰 세로 칸 수 */
export const MAX_H = 12

// 폰 기본 배치: 위젯을 한 줄씩 크게 (사용자가 고른 B안, 2026-11-18). 디데이는 날짜 위젯 안에 보인다
const PHONE: DashWidget[] = [
  { kind: 'date', w: 4, h: 4 },
  { kind: 'progress', w: 4, h: 1 },
  { kind: 'timeline', w: 4, h: 5 },
  { kind: 'route', w: 4, h: 4 },
  { kind: 'todos', w: 4, h: 4 },
  { kind: 'habitWeek', w: 4, h: 3 },
  { kind: 'tracker', w: 4, h: 2 },
  { kind: 'money', w: 4, h: 4 },
  { kind: 'ai', w: 4, h: 3 },
  { kind: 'payday', w: 4, h: 3 },
  { kind: 'scrap', w: 4, h: 4 },
]

const MID: DashWidget[] = [
  { kind: 'date', w: 3, h: 5 },
  { kind: 'timeline', w: 5, h: 8 },
  { kind: 'dday', w: 3, h: 3 },
  { kind: 'habitWeek', w: 8, h: 5 },
  { kind: 'progress', w: 4, h: 2 },
  { kind: 'todos', w: 4, h: 4 },
  { kind: 'tracker', w: 8, h: 4 },
  { kind: 'money', w: 4, h: 6 },
  { kind: 'ai', w: 4, h: 6 },
  { kind: 'payday', w: 4, h: 4 },
  { kind: 'scrap', w: 4, h: 4 },
  { kind: 'route', w: 4, h: 4 },
  { kind: 'weather', w: 4, h: 4 },
  { kind: 'timer', w: 4, h: 3 },
  { kind: 'mood', w: 4, h: 3 },
]

const WIDE: DashWidget[] = [
  { kind: 'date', w: 3, h: 6 },
  { kind: 'timeline', w: 3, h: 8 },
  { kind: 'habitWeek', w: 6, h: 5 },
  { kind: 'progress', w: 3, h: 3 },
  { kind: 'todos', w: 3, h: 3 },
  { kind: 'dday', w: 3, h: 2 },
  { kind: 'tracker', w: 6, h: 3 },
  { kind: 'payday', w: 3, h: 3 },
  { kind: 'mood', w: 3, h: 3 },
  { kind: 'money', w: 4, h: 5 },
  { kind: 'ai', w: 4, h: 5 },
  { kind: 'scrap', w: 4, h: 5 },
  { kind: 'route', w: 4, h: 5 },
  { kind: 'weather', w: 4, h: 5 },
  { kind: 'timer', w: 4, h: 5 },
]

/**
 * 기본 배치에 없는 위젯을 "추가" 로 넣을 때의 크기 (사용자 요청 2026-11-27)
 * 폰이 복잡해지지 않게 타이머 · 기분 · 날씨는 폰 기본 배치에 넣지 않고, 넣으면 타이머 · 기분은 반 칸(2×2) 작은 타일로 나란히, 날씨는 한 줄 낮은 띠(4×2)로 들어간다
 */
const ADD_SIZE: Record<GridCols, Partial<Record<DashWidgetKind, { w: number; h: number }>>> = {
  4: { timer: { w: 2, h: 2 }, mood: { w: 2, h: 2 }, weather: { w: 4, h: 2 }, dday: { w: 4, h: 1 } },
  8: {},
  12: {},
}

export function defaultLayout(cols: GridCols): DashWidget[] {
  return (cols === 4 ? PHONE : cols === 8 ? MID : WIDE).map((w) => ({ ...w }))
}

/** 창 너비(px)에 맞는 격자 칸 수 */
export function colsForWidth(width: number): GridCols {
  if (width >= 900) return 12
  if (width >= 560) return 8
  return 4
}

/** 가장 작은 크기 */
export function minSize(kind: DashWidgetKind, cols: GridCols): { w: number; h: number } {
  const { minW, minH } = WIDGET_INFO[kind]
  return { w: Math.min(cols, minW), h: minH }
}

export function clampSize(kind: DashWidgetKind, cols: GridCols, w: number, h: number): { w: number; h: number } {
  const min = minSize(kind, cols)
  return {
    w: Math.min(cols, Math.max(min.w, Math.round(w))),
    h: Math.min(MAX_H, Math.max(min.h, Math.round(h))),
  }
}

/** 저장된 값을 믿지 않고 다듬는다: 모르는 위젯·겹친 위젯을 빼고 크기를 칸 안으로 */
export function cleanLayout(raw: unknown, cols: GridCols): DashWidget[] | null {
  if (!Array.isArray(raw)) return null
  const seen = new Set<DashWidgetKind>()
  const out: DashWidget[] = []
  for (const item of raw) {
    const kind = (item as DashWidget | null)?.kind
    if (!kind || !(kind in WIDGET_INFO) || seen.has(kind)) continue
    seen.add(kind)
    const { w, h } = item as DashWidget
    out.push({ kind, ...clampSize(kind, cols, Number(w) || 0, Number(h) || 0) })
  }
  return out
}

/** from 자리의 위젯을 to 자리로 옮긴다 (그 사이 위젯은 한 칸씩 밀린다) */
export function moveWidget(list: DashWidget[], from: number, to: number): DashWidget[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function resizeWidget(list: DashWidget[], kind: DashWidgetKind, cols: GridCols, w: number, h: number): DashWidget[] {
  return list.map((x) => (x.kind === kind ? { ...x, ...clampSize(kind, cols, w, h) } : x))
}

export function removeWidget(list: DashWidget[], kind: DashWidgetKind): DashWidget[] {
  return list.filter((x) => x.kind !== kind)
}

/** 빠진 위젯을 기본 크기로 맨 앞에 다시 넣는다 */
export function addWidget(list: DashWidget[], kind: DashWidgetKind, cols: GridCols): DashWidget[] {
  if (list.some((x) => x.kind === kind)) return list
  const size = ADD_SIZE[cols][kind]
  const base = defaultLayout(cols).find((x) => x.kind === kind) ?? (size ? { kind, ...size } : { kind, w: cols, h: WIDGET_INFO[kind].minH })
  return [{ ...base }, ...list]
}

// ───────────── 저장 ─────────────

const KEY = 'tidy.dashboard.layout.v1'
const EVENT = 'tidy-dash-layout'

type Saved = Partial<Record<GridCols, DashWidget[]>>

function readAll(): Saved {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Saved | null) ?? {}
  } catch {
    return {}
  }
}

export function loadLayout(cols: GridCols): DashWidget[] {
  return cleanLayout(readAll()[cols], cols) ?? defaultLayout(cols)
}

export function saveLayout(cols: GridCols, list: DashWidget[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...readAll(), [cols]: list }))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // 저장 공간이 없으면 이번만 바뀐 채로 둔다
  }
}

/** 저장해 둔 모든 배치(폰 · 중간 · 넓은 화면)에 이 위젯이 없으면 맨 앞에 넣는다 (이동 기록을 켤 때) */
export function addWidgetEverywhere(kind: DashWidgetKind): void {
  const all = readAll()
  let changed = false
  for (const cols of GRID_COLS) {
    const list = cleanLayout(all[cols], cols)
    if (!list || list.some((x) => x.kind === kind)) continue
    all[cols] = addWidget(list, kind, cols)
    changed = true
  }
  if (!changed) return
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
    window.dispatchEvent(new Event(EVENT))
  } catch {
    // 무시
  }
}

export function resetLayout(cols: GridCols): DashWidget[] {
  const all = readAll()
  delete all[cols]
  try {
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // 무시
  }
  return defaultLayout(cols)
}

// ───────────── 디데이 ─────────────

/** 오늘에서 date 까지 남은 날 (지났으면 음수) */
export function daysUntil(today: string, date: string): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))
  const b = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))
  return Math.round((b - a) / 86400000)
}

/** D-3, D-DAY, D+2 */
export function ddayLabel(days: number): string {
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${-days}`
}

/** 할 일 기록 잔디: 날짜 → 그날 끝낸 할 일 수 */
export function doneByDay(todos: { isCompleted: number; completedAt: string | null }[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const t of todos) {
    if (t.isCompleted !== 1 || !t.completedAt) continue
    const d = new Date(t.completedAt)
    if (Number.isNaN(d.getTime())) continue
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

/** 잔디 칸 진하기 0~4 */
export function heatLevel(n: number): 0 | 1 | 2 | 3 | 4 {
  if (n <= 0) return 0
  if (n === 1) return 1
  if (n <= 3) return 2
  if (n <= 5) return 3
  return 4
}

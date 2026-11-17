/**
 * 홈 화면 위젯 설정: 위젯 종류마다 바탕 투명도.
 * 이 기기(localStorage)에만 두고, 위젯 요약(widgetSummary)에 함께 실어 안드로이드 위젯에 보낸다.
 */

/** 위젯 종류. 안드로이드 쪽 클래스: TidyWidget, TodoWidget, MoneyWidget, EventWidget, HabitWidget */
export type WidgetKind = 'today' | 'todo' | 'money' | 'event' | 'habit'

export const WIDGET_KINDS: { kind: WidgetKind; name: string; desc: string; size: string }[] = [
  { kind: 'today', name: '오늘', desc: '오늘 할 일과 지출을 한눈에', size: '4×2' },
  { kind: 'todo', name: '할 일', desc: '오늘 할 일 목록을 길게', size: '2×2' },
  { kind: 'money', name: '가계부', desc: '이번 달 지출과 남은 예산', size: '2×2' },
  { kind: 'event', name: '일정', desc: '오늘부터 일주일 일정', size: '4×2' },
  { kind: 'habit', name: '습관', desc: '오늘 할 습관과 체크', size: '2×2' },
]

/** 바탕이 얼마나 보이는지 (%). 0 = 완전히 투명, 100 = 불투명 */
export type WidgetOpacity = Record<WidgetKind, number>

export const DEFAULT_OPACITY = 100

const KEY = 'tidy-widget-opacity'
const EVENT = 'tidy-widget-settings'

const clamp = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DEFAULT_OPACITY)

export function loadWidgetOpacity(): WidgetOpacity {
  let saved: Partial<Record<WidgetKind, number>> = {}
  try {
    saved = (JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<WidgetKind, number>> | null) ?? {}
  } catch {
    saved = {}
  }
  return Object.fromEntries(WIDGET_KINDS.map(({ kind }) => [kind, clamp(saved[kind])])) as WidgetOpacity
}

export function saveWidgetOpacity(kind: WidgetKind, value: number): void {
  const next = { ...loadWidgetOpacity(), [kind]: clamp(value) }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // 저장이 막혀도 이번 실행에서는 그대로 쓴다
  }
  window.dispatchEvent(new Event(EVENT))
}

export function onWidgetSettingsChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

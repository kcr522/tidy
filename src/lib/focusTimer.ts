/**
 * 대시보드 집중 타이머 · 스톱워치 (사용자 요청 2026-11-27)
 * 시작한 시각만 저장해서, 앱을 닫았다 열어도 시간이 이어진다. 이 기기(localStorage)에만 둔다
 */

export type TimerMode = 'timer' | 'stopwatch'

export interface TimerState {
  mode: TimerMode
  /** 타이머 길이 (ms) */
  duration: number
  /** 타이머가 끝나는 시각 (돌아가는 중일 때만) */
  endAt: number | null
  /** 멈춘 타이머의 남은 시간 (ms). 시작 전이면 null */
  left: number | null
  /** 스톱워치를 다시 시작한 시각 (돌아가는 중일 때만) */
  startAt: number | null
  /** 스톱워치에 쌓인 시간 (ms, 멈춘 동안) */
  spent: number
}

/** 고를 수 있는 타이머 길이 (분) */
export const TIMER_PRESETS = [5, 15, 25, 50] as const
/** 처음 길이: 집중 25분 */
export const DEFAULT_MINUTES = 25

export const MIN = 60 * 1000

export const freshTimer = (mode: TimerMode = 'timer', minutes: number = DEFAULT_MINUTES): TimerState => ({ mode, duration: minutes * MIN, endAt: null, left: null, startAt: null, spent: 0 })

export const isRunning = (s: TimerState): boolean => (s.mode === 'timer' ? s.endAt != null : s.startAt != null)

/** 타이머 남은 시간 (ms, 0 아래로는 안 내려감) */
export function timeLeft(s: TimerState, now: number): number {
  if (s.endAt != null) return Math.max(0, s.endAt - now)
  return s.left ?? s.duration
}

/** 스톱워치 흐른 시간 (ms) */
export function timeSpent(s: TimerState, now: number): number {
  return s.spent + (s.startAt != null ? Math.max(0, now - s.startAt) : 0)
}

/** 화면에 보일 숫자: 25:00, 1:02:03 */
export function clockText(ms: number): string {
  const total = Math.ceil(ms / 1000 - 1e-9)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  return h ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm.padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** 0~1: 타이머가 얼마나 지났는지 (동그라미 채우기) */
export function timerRatio(s: TimerState, now: number): number {
  if (s.mode !== 'timer' || s.duration <= 0) return 0
  return Math.min(1, Math.max(0, 1 - timeLeft(s, now) / s.duration))
}

export function start(s: TimerState, now: number): TimerState {
  if (isRunning(s)) return s
  if (s.mode === 'stopwatch') return { ...s, startAt: now }
  const left = s.left != null && s.left > 0 ? s.left : s.duration
  return { ...s, endAt: now + left, left }
}

export function pause(s: TimerState, now: number): TimerState {
  if (!isRunning(s)) return s
  if (s.mode === 'stopwatch') return { ...s, spent: timeSpent(s, now), startAt: null }
  return { ...s, left: timeLeft(s, now), endAt: null }
}

export function reset(s: TimerState): TimerState {
  return { ...freshTimer(s.mode, s.duration / MIN) }
}

/** 타이머 길이를 바꾼다 (돌아가던 것은 멈추고 처음부터) */
export function setMinutes(minutes: number): TimerState {
  return freshTimer('timer', Math.min(24 * 60, Math.max(1, Math.round(minutes))))
}

export function setMode(s: TimerState, mode: TimerMode): TimerState {
  if (s.mode === mode) return s
  return freshTimer(mode, s.duration / MIN)
}

/** 타이머가 다 됐는지 (돌아가던 중에 끝나는 시각이 지남) */
export const isDone = (s: TimerState, now: number): boolean => s.mode === 'timer' && s.endAt != null && s.endAt <= now

/** 다 된 타이머를 "끝남" 상태로 (남은 시간 0, 다시 누르면 처음부터) */
export function finish(s: TimerState): TimerState {
  return { ...s, endAt: null, left: 0 }
}

// ───────────── 저장 ─────────────

const KEY = 'tidy.timer.v1'
export const TIMER_EVENT = 'tidy-timer'

export function loadTimer(): TimerState {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as TimerState | null
    if (s && (s.mode === 'timer' || s.mode === 'stopwatch') && Number.isFinite(s.duration) && s.duration > 0) {
      return { mode: s.mode, duration: s.duration, endAt: s.endAt ?? null, left: s.left ?? null, startAt: s.startAt ?? null, spent: Number(s.spent) || 0 }
    }
  } catch {
    // 무시
  }
  return freshTimer()
}

export function saveTimer(s: TimerState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // 저장 공간이 없으면 이번만
  }
  window.dispatchEvent(new Event(TIMER_EVENT))
}

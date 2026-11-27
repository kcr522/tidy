import { useMemo, useSyncExternalStore } from 'react'
import type { Bookmark } from '../../db/types'
import { parseDateKey, toDateKey } from '../date'
import { isTime } from '../todoAlarms'

/**
 * 안 본 스크랩 다시 보기 (사용자 요청 2026-11-27)
 * 저장만 하고 한 번도 열어 보지 않은 스크랩을 가끔 다시 꺼내 보여 준다.
 * - "본 적 있음" = isRead 1. 링크를 열거나 스크랩 자세히 보기를 열면 1이 된다 (안 읽음 버튼은 PR #69에서 없앴다)
 * - 저장하고 며칠(MIN_AGE_DAYS) 지난 것만. 방금 저장한 건 아직 볼 생각이 있을 테니까
 * - 날마다 다른 스크랩이 뽑히게 (날짜 + id 로 섞는다). 같은 날에는 몇 번 열어도 같은 것
 * - "나중에"를 누르면 SNOOZE_DAYS 동안 안 꺼낸다. "이제 됐어요"는 본 것으로 표시
 */

/** 저장하고 이만큼 지나야 다시 꺼낸다 */
export const MIN_AGE_DAYS = 3
/** "나중에" 누르면 이만큼 쉬었다가 */
export const SNOOZE_DAYS = 7
/** 폰에 미리 예약해 두는 알림 수 */
export const NOTIFY_AHEAD = 3

export type ResurfaceEvery = 1 | 3 | 7

export interface ResurfaceSettings {
  /** 대시보드 · 스크랩 화면에 "다시 볼 스크랩" 보여 주기 (기본: 켬) */
  card: boolean
  /** 폰 알림으로도 알려 주기 (기본: 끔. 켤 때 알림 허용을 묻는다) */
  notify: boolean
  /** 며칠마다 알릴지 */
  every: ResurfaceEvery
  /** 알릴 시각 'HH:mm' */
  time: string
}

export const DEFAULT_RESURFACE: ResurfaceSettings = { card: true, notify: false, every: 3, time: '20:00' }
export const EVERY_OPTIONS: { value: ResurfaceEvery; label: string }[] = [
  { value: 1, label: '매일' },
  { value: 3, label: '3일마다' },
  { value: 7, label: '일주일마다' },
]

/** 스크랩 id → 이 날짜(포함)까지는 꺼내지 않음 */
export type Snoozes = Record<string, string>

const daysBetween = (from: string, to: string) => Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86400000)

function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** 저장한 날 (기기 시간 기준) */
const savedDay = (b: Pick<Bookmark, 'createdAt'>) => {
  const d = new Date(b.createdAt)
  return Number.isNaN(d.getTime()) ? null : toDateKey(d)
}

/** 날짜 + id 로 만든 섞기 값 (같은 날엔 늘 같다) */
function mix(id: number, day: string): number {
  let h = 2166136261
  for (const ch of `${day}:${id}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/** 다시 꺼낼 수 있는 스크랩: 안 봤고, 며칠 지났고, "나중에"로 쉬는 중이 아닌 것 */
export function resurfaceCandidates(list: Bookmark[], day: string, snoozes: Snoozes = {}): Bookmark[] {
  return list.filter((b) => {
    if (b.id == null || b.isRead === 1) return false
    const saved = savedDay(b)
    if (!saved || daysBetween(saved, day) < MIN_AGE_DAYS) return false
    const until = snoozes[String(b.id)]
    return !until || until < day
  })
}

/** 그날 다시 볼 스크랩 (max개). 날마다 바뀐다 */
export function pickResurface(list: Bookmark[], day: string, snoozes: Snoozes = {}, max = 1): Bookmark[] {
  return resurfaceCandidates(list, day, snoozes)
    .sort((a, b) => mix(a.id!, day) - mix(b.id!, day))
    .slice(0, max)
}

/** "3일 전에 저장했어요" */
export function savedAgoLabel(b: Pick<Bookmark, 'createdAt'>, today: string): string {
  const saved = savedDay(b)
  if (!saved) return ''
  const n = daysBetween(saved, today)
  if (n >= 365) return `${Math.floor(n / 365)}년 전에 저장했어요`
  if (n >= 30) return `${Math.floor(n / 30)}달 전에 저장했어요`
  if (n >= 7) return `${Math.floor(n / 7)}주 전에 저장했어요`
  return `${n}일 전에 저장했어요`
}

/**
 * 앞으로 알림을 울릴 날짜와 시각 (가까운 순, count개).
 * 기준일(anchor, 처음 켠 날)부터 every 일마다. 오늘 시각이 이미 지났으면 다음 차례부터
 */
export function nextNotifyTimes(now: Date, s: Pick<ResurfaceSettings, 'every' | 'time'>, anchor: string, count = NOTIFY_AHEAD): Date[] {
  const [h, m] = (isTime(s.time) ? s.time : DEFAULT_RESURFACE.time).split(':').map(Number)
  const today = toDateKey(now)
  const gap = daysBetween(anchor, today)
  // 오늘이나 그 뒤 첫 차례
  let day = gap <= 0 ? anchor : addDays(today, (s.every - (gap % s.every)) % s.every)
  const out: Date[] = []
  while (out.length < count) {
    const at = parseDateKey(day)
    at.setHours(h, m, 0, 0)
    if (at.getTime() > now.getTime()) out.push(at)
    day = addDays(day, s.every)
  }
  return out
}

/** 알림 날짜마다 다른 스크랩을 하나씩 (앞에서 고른 건 빼고). 꺼낼 게 없는 날은 빠진다 */
export function planNotifications(list: Bookmark[], times: Date[], snoozes: Snoozes = {}): { at: Date; item: Bookmark }[] {
  const used = new Set<number>()
  const out: { at: Date; item: Bookmark }[] = []
  for (const at of times) {
    const day = toDateKey(at)
    const item = pickResurface(list.filter((b) => !used.has(b.id!)), day, snoozes)[0]
    if (!item) continue
    used.add(item.id!)
    out.push({ at, item })
  }
  return out
}

export const notifyTitle = () => '🔁 저장해 두고 안 본 스크랩이 있어요'
export const notifyBody = (b: Pick<Bookmark, 'title' | 'url'>) => b.title?.trim() || b.url

// ───────────── 저장 (이 기기에만) ─────────────

const SETTINGS_KEY = 'tidy.scrap.resurface'
const SNOOZE_KEY = 'tidy.scrap.resurfaceSnooze'
const ANCHOR_KEY = 'tidy.scrap.resurfaceAnchor'
const EVENT = 'tidy-scrap-resurface'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // 저장이 막힌 브라우저에서는 이번 실행 동안만
  }
  window.dispatchEvent(new Event(EVENT))
}

/** 저장된 값을 믿지 않고 다듬는다 */
export function cleanSettings(raw: unknown): ResurfaceSettings {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Partial<ResurfaceSettings>
  return {
    card: typeof v.card === 'boolean' ? v.card : DEFAULT_RESURFACE.card,
    notify: typeof v.notify === 'boolean' ? v.notify : DEFAULT_RESURFACE.notify,
    every: v.every === 1 || v.every === 3 || v.every === 7 ? v.every : DEFAULT_RESURFACE.every,
    time: isTime(v.time) ? v.time : DEFAULT_RESURFACE.time,
  }
}

function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export const loadResurface = () => cleanSettings(parse(read(SETTINGS_KEY)))

export function saveResurface(next: ResurfaceSettings) {
  // 알림을 처음 켠 날부터 every 일마다 울린다
  if (next.notify && !loadResurface().notify) write(ANCHOR_KEY, toDateKey(new Date()))
  write(SETTINGS_KEY, JSON.stringify(cleanSettings(next)))
}

export const resurfaceAnchor = () => {
  const v = read(ANCHOR_KEY)
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : toDateKey(new Date())
}

export function loadSnoozes(): Snoozes {
  const v = parse(read(SNOOZE_KEY))
  return v && typeof v === 'object' ? (v as Snoozes) : {}
}

/** "나중에": 오늘부터 SNOOZE_DAYS 동안 안 꺼낸다. 지난 기록은 정리 */
export function snoozeScrap(id: number, today: string) {
  const all = Object.fromEntries(Object.entries(loadSnoozes()).filter(([, until]) => until >= today))
  all[String(id)] = addDays(today, SNOOZE_DAYS - 1)
  write(SNOOZE_KEY, JSON.stringify(all))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function useResurfaceSettings(): [ResurfaceSettings, (next: ResurfaceSettings) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(SETTINGS_KEY))
  const settings = useMemo(() => cleanSettings(parse(raw)), [raw])
  return [settings, saveResurface]
}

export function useSnoozes(): Snoozes {
  const raw = useSyncExternalStore(subscribe, () => read(SNOOZE_KEY))
  return useMemo(() => {
    const v = parse(raw)
    return v && typeof v === 'object' ? (v as Snoozes) : {}
  }, [raw])
}

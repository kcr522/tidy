import { addDays, format } from 'date-fns'
import type { CalendarEvent, Todo } from '../db/types'
import { parseDateKey } from './date'

/**
 * Tidy → 구글 캘린더 보내기에서 구글 쪽 일정 하나.
 * 구글 일정 id 는 Tidy 의 id 로 정해서(같은 일정은 항상 같은 id) 다시 보내도 겹치지 않는다.
 */
export interface PushItem {
  /** 구글 일정 id: base32hex(0-9, a-v), 5자 이상 */
  id: string
  body: GoogleEventBody
  /** 내용이 바뀌었는지 보는 값 (구글 일정의 extendedProperties.private.tidy 에 같이 저장) */
  hash: string
}

export interface GoogleEventBody {
  summary: string
  description?: string
  start: { date: string } | { dateTime: string; timeZone: string }
  end: { date: string } | { dateTime: string; timeZone: string }
}

export interface PushOptions {
  /** 마감일 있는 할 일도 보낼지 */
  todos: boolean
  /** 시간이 있는 할 일을 넣을 시간대 (예: Asia/Seoul) */
  timeZone: string
}

const nextDay = (d: string) => format(addDays(parseDateKey(d), 1), 'yyyy-MM-dd')

export function eventGoogleId(id: number): string {
  return `tde${String(id).padStart(4, '0')}`
}

export function todoGoogleId(id: number): string {
  return `tdt${String(id).padStart(4, '0')}`
}

/** 구글이 받는 id 인지 (Tidy 가 만든 것만 지우려고 쓴다) */
export function isTidyGoogleId(id: string): boolean {
  return /^td[et]\d{4,}$/.test(id)
}

/** 짧은 해시 (djb2). 같은 내용이면 같은 값 */
export function hashOf(v: unknown): string {
  const s = JSON.stringify(v)
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

function addMinutes(date: string, time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number)
  const d = parseDateKey(date)
  d.setHours(h, m + minutes, 0, 0)
  return format(d, "yyyy-MM-dd'T'HH:mm:ss")
}

/**
 * 구글에 있어야 할 일정 목록.
 * - Tidy 일정 (구글에서 가져온 일정은 빼고): 하루 종일, 여러 날이면 길게
 * - 끝내지 않은 마감일 있는 할 일: 알림 시각이 있으면 그 시각부터 30분, 없으면 하루 종일
 */
export function buildPushItems(events: CalendarEvent[], todos: Todo[], opts: PushOptions): PushItem[] {
  const out: PushItem[] = []
  const add = (id: string, body: GoogleEventBody) => out.push({ id, body, hash: hashOf(body) })
  for (const e of events) {
    if (e.id == null || e.source === 'google') continue
    add(eventGoogleId(e.id), {
      summary: e.title,
      ...(e.memo && { description: e.memo }),
      start: { date: e.startDate },
      end: { date: nextDay(e.endDate < e.startDate ? e.startDate : e.endDate) },
    })
  }
  if (opts.todos) {
    for (const t of todos) {
      if (t.id == null || !t.dueDate || t.isCompleted === 1) continue
      const timed = t.remindAt && /^\d{2}:\d{2}$/.test(t.remindAt)
      add(todoGoogleId(t.id), {
        summary: `☐ ${t.title}`,
        description: 'Tidy 할 일',
        start: timed ? { dateTime: addMinutes(t.dueDate, t.remindAt!, 0), timeZone: opts.timeZone } : { date: t.dueDate },
        end: timed ? { dateTime: addMinutes(t.dueDate, t.remindAt!, 30), timeZone: opts.timeZone } : { date: nextDay(t.dueDate) },
      })
    }
  }
  return out
}

/** 구글 Tidy 캘린더에 지금 있는 일정 (id 와 저장해 둔 해시) */
export interface RemoteItem {
  id: string
  hash?: string
}

export interface PushPlan {
  insert: PushItem[]
  update: PushItem[]
  remove: string[]
}

/** 지금 구글에 있는 것과 있어야 할 것을 비교해서 할 일을 정한다 */
export function planPush(want: PushItem[], remote: RemoteItem[]): PushPlan {
  const have = new Map(remote.map((r) => [r.id, r.hash]))
  const wantIds = new Set(want.map((w) => w.id))
  return {
    insert: want.filter((w) => !have.has(w.id)),
    update: want.filter((w) => have.has(w.id) && have.get(w.id) !== w.hash),
    // Tidy 캘린더라도 사용자가 구글에서 직접 넣은 일정은 건드리지 않는다
    remove: remote.filter((r) => !wantIds.has(r.id) && isTidyGoogleId(r.id)).map((r) => r.id),
  }
}

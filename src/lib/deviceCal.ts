import type { CalendarEvent, EventColor } from '../db/types'
import { hashOf } from './gcalPush'

/**
 * 폰 캘린더(삼성 캘린더) 연동에서 쓰는 순수 계산. 폰을 부르는 부분은 src/platform/deviceCalendar.ts
 * - 가져오기: 폰 일정 → Tidy 일정(source 'device'), 바뀐 것만 넣고 고치고 지운다 (동기화 기록이 덜 쌓이게)
 * - 보내기: Tidy 에서 만든 일정만 폰의 "Tidy" 캘린더에 넣는다. 할 일, 구글·폰에서 가져온 일정은 보내지 않는다
 */

/** 폰에 있는 캘린더 하나 */
export interface DeviceCalendar {
  id: string
  name: string
  account: string
  accountType: string
  /** #rrggbb */
  color: string
  writable: boolean
  visible: boolean
}

/** 폰 캘린더 일정 하나 (반복 일정은 날마다 따로) */
export interface DeviceEvent {
  /** 일정 id + ':' + 시작 시각 */
  key: string
  calendarId: string
  title: string
  startDate: string
  endDate: string
  startTime?: string
  endTime?: string
  allDay: boolean
  memo: string
  location: string
}

/** Tidy 가 폰에 만든 캘린더와, Tidy 가 구글에 만든 캘린더 (둘 다 Tidy 일정이라 가져오면 두 번 보인다) */
export function isTidyCalendar(c: Pick<DeviceCalendar, 'name' | 'account' | 'accountType'>): boolean {
  if (c.accountType === 'LOCAL' && c.account === 'Tidy') return true
  return c.accountType === 'com.google' && c.name === 'Tidy'
}

export function isGoogleCalendar(c: Pick<DeviceCalendar, 'accountType'>): boolean {
  return c.accountType === 'com.google'
}

/** 화면에 보일 계정 이름: 삼성 계정, 내 휴대전화, 구글 메일 주소 등 */
export function accountLabel(c: Pick<DeviceCalendar, 'account' | 'accountType'>): string {
  if (c.accountType === 'com.osp.app.signin') return '삼성 계정'
  if (c.accountType === 'LOCAL') return '내 휴대전화'
  if (c.accountType === 'com.google') return `구글 · ${c.account}`
  return c.account || '폰'
}

/**
 * 처음 켤 때 고를 캘린더: Tidy 캘린더는 빼고, 구글 캘린더는 이미 구글 연동으로 보일 수 있어서 꺼 둔다.
 * 숨긴 캘린더(삼성 캘린더에서 안 보이게 한 것)도 꺼 둔다.
 */
export function defaultPicks(list: DeviceCalendar[]): string[] {
  return list.filter((c) => !isTidyCalendar(c) && !isGoogleCalendar(c) && c.visible).map((c) => c.id)
}

/** 다른 기기와 calId 가 겹치지 않게 기기 표시를 붙인다 (폰마다 캘린더 번호가 1부터라서) */
export function deviceCalId(device: string, calendarId: string): string {
  return `d:${device}:${calendarId}`
}

const sameKey = (title: string, start: string, end: string) => `${title.trim()}|${start}|${end}`

/** 시간 · 장소 · 메모를 Tidy 메모 한 칸에 */
export function memoOf(e: Pick<DeviceEvent, 'allDay' | 'startTime' | 'endTime' | 'location' | 'memo'>): string {
  const time = !e.allDay && e.startTime ? (e.endTime && e.endTime !== e.startTime ? `${e.startTime} ~ ${e.endTime}` : e.startTime) : ''
  return [time, e.location.trim() && `📍 ${e.location.trim()}`, e.memo.trim()].filter(Boolean).join('\n')
}

export interface ImportPlan {
  add: CalendarEvent[]
  update: { id: number; changes: Partial<CalendarEvent> }[]
  remove: number[]
}

/**
 * 폰에서 읽은 일정과 Tidy 에 이미 있는 일정을 비교한다.
 * - 이 기기에서 가져온 일정만 다룬다 (다른 폰에서 가져와 동기화로 들어온 건 그대로)
 * - Tidy 일정이나 구글에서 가져온 일정과 제목 · 날짜가 같으면 두 번 보이지 않게 건너뛴다
 */
export function planImport(existing: CalendarEvent[], incoming: DeviceEvent[], colors: Record<string, EventColor>, device: string, stamp: string): ImportPlan {
  const prefix = `d:${device}:`
  const mine = new Map<string, CalendarEvent>()
  const others = new Set<string>()
  for (const e of existing) {
    if (e.source === 'device') {
      if (e.calId?.startsWith(prefix) && e.uid) mine.set(`${e.calId}|${e.uid}`, e)
    } else others.add(sameKey(e.title, e.startDate, e.endDate))
  }
  const plan: ImportPlan = { add: [], update: [], remove: [] }
  const seen = new Set<string>()
  for (const d of incoming) {
    const color = colors[d.calendarId]
    if (!color) continue
    const title = d.title.trim() || '(제목 없음)'
    if (others.has(sameKey(title, d.startDate, d.endDate))) continue
    const calId = deviceCalId(device, d.calendarId)
    const k = `${calId}|${d.key}`
    if (seen.has(k)) continue
    seen.add(k)
    const row = { title, startDate: d.startDate, endDate: d.endDate < d.startDate ? d.startDate : d.endDate, color, memo: memoOf(d) }
    const old = mine.get(k)
    if (!old) plan.add.push({ ...row, source: 'device', calId, uid: d.key, createdAt: stamp, updatedAt: stamp })
    else if (old.id != null && (old.title !== row.title || old.startDate !== row.startDate || old.endDate !== row.endDate || old.memo !== row.memo || old.color !== row.color)) plan.update.push({ id: old.id, changes: { ...row, updatedAt: stamp } })
  }
  for (const [k, e] of mine) if (!seen.has(k) && e.id != null) plan.remove.push(e.id)
  return plan
}

/** 폰 Tidy 캘린더에 들어갈 일정 하나 */
export interface TidyPushItem {
  /** tidy-<Tidy 일정 id> (폰 일정의 _SYNC_ID) */
  key: string
  hash: string
  title: string
  memo: string
  startDate: string
  endDate: string
}

/** 폰 Tidy 캘린더에 지금 있는 일정 */
export interface TidyRemote {
  eventId: string
  key: string
  hash: string
}

/** Tidy 에서 직접 만든 일정만 (할 일 · 구글 · 폰에서 가져온 일정은 빼고) */
export function buildDevicePush(events: CalendarEvent[]): TidyPushItem[] {
  const out: TidyPushItem[] = []
  for (const e of events) {
    if (e.id == null || e.source) continue
    const body = { title: e.title, memo: e.memo ?? '', startDate: e.startDate, endDate: e.endDate < e.startDate ? e.startDate : e.endDate }
    out.push({ key: `tidy-${e.id}`, hash: hashOf(body), ...body })
  }
  return out
}

export interface DevicePushPlan {
  insert: TidyPushItem[]
  update: (TidyPushItem & { eventId: string })[]
  remove: string[]
}

/** 폰에 있는 것과 있어야 할 것 비교. 사용자가 삼성 캘린더에서 Tidy 캘린더에 직접 넣은 일정은 건드리지 않는다 */
export function planDevicePush(want: TidyPushItem[], remote: TidyRemote[]): DevicePushPlan {
  const have = new Map<string, TidyRemote>()
  const remove: string[] = []
  for (const r of remote) {
    if (!r.key.startsWith('tidy-')) continue
    // 같은 key 가 두 개면 (넣다가 끊긴 경우) 하나만 남긴다
    if (have.has(r.key)) remove.push(r.eventId)
    else have.set(r.key, r)
  }
  const wantKeys = new Set(want.map((w) => w.key))
  const insert: TidyPushItem[] = []
  const update: (TidyPushItem & { eventId: string })[] = []
  for (const w of want) {
    const r = have.get(w.key)
    if (!r) insert.push(w)
    else if (r.hash !== w.hash) update.push({ ...w, eventId: r.eventId })
  }
  for (const [k, r] of have) if (!wantKeys.has(k)) remove.push(r.eventId)
  return { insert, update, remove }
}

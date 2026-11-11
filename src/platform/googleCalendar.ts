import { CapacitorHttp } from '@capacitor/core'
import { addMonths } from 'date-fns'
import { db } from '../db/database'
import type { CalendarEvent, EventColor } from '../db/types'
import { nowIso } from '../lib/date'
import { EVENT_COLORS } from '../lib/eventLayout'
import { parseIcs } from '../lib/ical'
import { isNativeApp } from './native'

/** 연결한 구글 캘린더 하나 ("iCal 형식의 비공개 주소", 이 기기에만 저장) */
export interface GoogleCal {
  id: string
  /** 회사, 개인 등. 일정을 누르면 보인다 */
  name: string
  url: string
  /** 이 캘린더에서 가져온 일정 색 */
  color: EventColor
  /** 마지막으로 가져온 시각 */
  last?: string
  /** 가져온 일정 수 */
  count?: number
}

const KEY = 'tidy-google-cal'
const EVENT = 'tidy:google-cal'
/** 앱을 열 때 이만큼 지났으면 다시 가져온다 */
export const REFRESH_MS = 6 * 60 * 60 * 1000
/** 연결할 수 있는 캘린더 수 */
export const MAX_CALS = 5
const COLORS = Object.keys(EVENT_COLORS) as EventColor[]

function isColor(v: unknown): v is EventColor {
  return typeof v === 'string' && v in EVENT_COLORS
}

function clean(v: Partial<GoogleCal> | null | undefined, i: number): GoogleCal | null {
  if (!v || typeof v.url !== 'string') return null
  return {
    id: typeof v.id === 'string' && v.id ? v.id : `g${i + 1}`,
    name: typeof v.name === 'string' && v.name.trim() ? v.name : '구글 캘린더',
    url: v.url,
    color: isColor(v.color) ? v.color : 'blue',
    ...(typeof v.last === 'string' && { last: v.last }),
    ...(typeof v.count === 'number' && { count: v.count }),
  }
}

/**
 * 연결한 캘린더 목록. 예전에는 캘린더 하나만 { url, last, count } 로 저장했어서,
 * 그건 파란색 "구글 캘린더" 하나로 읽는다.
 */
export function loadGoogleCals(): GoogleCal[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as unknown
    const list = Array.isArray(v) ? v : v && typeof v === 'object' && 'url' in v ? [v] : []
    return list.map((c, i) => clean(c as Partial<GoogleCal>, i)).filter((c): c is GoogleCal => c !== null)
  } catch {
    return []
  }
}

function save(list: GoogleCal[]) {
  if (list.length) localStorage.setItem(KEY, JSON.stringify(list))
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(EVENT))
}

function patch(id: string, change: Partial<GoogleCal>) {
  save(loadGoogleCals().map((c) => (c.id === id ? { ...c, ...change } : c)))
}

export function onGoogleCalChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** 새 캘린더에 줄 색: 아직 안 쓴 색 중 첫 번째 (파랑부터) */
export function nextColor(used: EventColor[]): EventColor {
  const order: EventColor[] = ['blue', ...COLORS.filter((c) => c !== 'blue')]
  return order.find((c) => !used.includes(c)) ?? 'blue'
}

/** 일정이 어느 캘린더에서 왔는지 (calId 가 없는 예전 일정은 첫 캘린더) */
export function calOf(e: CalendarEvent, cals: GoogleCal[]): GoogleCal | undefined {
  return cals.find((c) => c.id === e.calId) ?? (e.calId ? undefined : cals[0])
}

/** webcal:// 도 받는다. https 주소가 아니면 null */
export function normalizeIcsUrl(input: string): string | null {
  const v = input.trim().replace(/^webcal:\/\//i, 'https://')
  try {
    const u = new URL(v)
    return u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

export class CalendarFetchError extends Error {}

async function fetchText(url: string): Promise<string> {
  if (isNativeApp()) {
    const res = await CapacitorHttp.get({
      url,
      responseType: 'text',
      connectTimeout: 15000,
      readTimeout: 30000,
    })
    if (res.status === 404) throw new CalendarFetchError('주소를 찾을 수 없어요. 비공개 주소를 다시 복사해 주세요')
    if (res.status >= 400) throw new CalendarFetchError(`가져오지 못했어요 (${res.status})`)
    return typeof res.data === 'string' ? res.data : String(res.data ?? '')
  }
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    // 구글은 웹 페이지에서 바로 읽는 걸 막아 둔다 (CORS)
    throw new CalendarFetchError('웹에서는 구글이 막아서 못 가져와요. 갤럭시 앱에서 연결해 주세요')
  }
  if (!res.ok) throw new CalendarFetchError(`가져오지 못했어요 (${res.status})`)
  return res.text()
}

/** 이 캘린더에서 가져온 일정 (calId 가 없는 예전 일정은 첫 캘린더 것) */
async function eventKeysOf(id: string): Promise<number[]> {
  const first = loadGoogleCals()[0]?.id
  return (await db.events.filter((e) => e.source === 'google' && (e.calId === id || (!e.calId && id === first))).primaryKeys()) as number[]
}

/** 가져와서 바꿔 넣는다 (이 캘린더에서 예전에 가져온 일정은 지우고 새로). 3달 전 ~ 1년 뒤 */
export async function syncGoogleCalendar(cal: Pick<GoogleCal, 'id' | 'url' | 'color'>, now = new Date()): Promise<number> {
  const text = await fetchText(cal.url)
  if (!text.includes('BEGIN:VCALENDAR')) throw new CalendarFetchError('캘린더 주소가 아니에요. "iCal 형식의 비공개 주소"를 넣어 주세요')
  const list = parseIcs(text, addMonths(now, -3), addMonths(now, 12))
  const stamp = nowIso(now)
  const rows: CalendarEvent[] = list.map((e) => ({
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    color: cal.color,
    memo: e.memo,
    source: 'google',
    calId: cal.id,
    uid: e.uid,
    createdAt: stamp,
    updatedAt: stamp,
  }))
  const old = await eventKeysOf(cal.id)
  await db.transaction('rw', db.events, async () => {
    await db.events.bulkDelete(old)
    await db.events.bulkAdd(rows)
  })
  patch(cal.id, { last: stamp, count: rows.length })
  return rows.length
}

/** 새 캘린더 연결: 먼저 가져와 보고 되면 목록에 넣는다 */
export async function addGoogleCalendar(input: { name: string; url: string; color: EventColor }, now = new Date()): Promise<number> {
  const list = loadGoogleCals()
  if (list.length >= MAX_CALS) throw new CalendarFetchError(`캘린더는 ${MAX_CALS}개까지 연결할 수 있어요`)
  if (list.some((c) => c.url === input.url)) throw new CalendarFetchError('이미 연결한 주소예요')
  const id = `g${now.getTime().toString(36)}`
  const name = input.name.trim() || (list.length ? `구글 캘린더 ${list.length + 1}` : '구글 캘린더')
  // 가져오기가 끝나야 count 를 적을 수 있어서 먼저 넣어 둔다. 실패하면 뺀다
  save([...list, { id, name, url: input.url, color: input.color }])
  try {
    return await syncGoogleCalendar({ id, url: input.url, color: input.color }, now)
  } catch (err) {
    save(loadGoogleCals().filter((c) => c.id !== id))
    throw err
  }
}

/** 색 바꾸기: 다시 가져오지 않고 이미 가져온 일정 색도 바로 바꾼다 */
export async function setGoogleCalColor(id: string, color: EventColor): Promise<void> {
  const keys = await eventKeysOf(id)
  await db.events.where(':id').anyOf(keys).modify({ color, calId: id })
  patch(id, { color })
}

export function renameGoogleCal(id: string, name: string) {
  if (name.trim()) patch(id, { name: name.trim() })
}

/** 연결 끊기: 이 캘린더에서 가져온 일정도 지운다 */
export async function disconnectGoogleCalendar(id: string): Promise<void> {
  const keys = await eventKeysOf(id)
  await db.events.bulkDelete(keys)
  save(loadGoogleCals().filter((c) => c.id !== id))
}

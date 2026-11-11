import { CapacitorHttp } from '@capacitor/core'
import { addMonths } from 'date-fns'
import { db } from '../db/database'
import type { CalendarEvent } from '../db/types'
import { nowIso } from '../lib/date'
import { parseIcs } from '../lib/ical'
import { isNativeApp } from './native'

/** 구글 캘린더 "비공개 주소(iCal 형식)" 연결 정보 (이 기기에만) */
export interface GoogleCalSettings {
  url: string
  /** 마지막으로 가져온 시각 */
  last?: string
  /** 가져온 일정 수 */
  count?: number
}

const KEY = 'tidy-google-cal'
const EVENT = 'tidy:google-cal'
/** 앱을 열 때 이만큼 지났으면 다시 가져온다 */
export const REFRESH_MS = 6 * 60 * 60 * 1000

export function loadGoogleCal(): GoogleCalSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GoogleCalSettings> | null
    return v && typeof v.url === 'string' ? { url: v.url, ...(typeof v.last === 'string' && { last: v.last }), ...(typeof v.count === 'number' && { count: v.count }) } : null
  } catch {
    return null
  }
}

function save(v: GoogleCalSettings | null) {
  if (v) localStorage.setItem(KEY, JSON.stringify(v))
  else localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function onGoogleCalChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
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
    const res = await CapacitorHttp.get({ url, responseType: 'text', connectTimeout: 15000, readTimeout: 30000 })
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

/** 가져와서 바꿔 넣는다 (예전에 가져온 구글 일정은 지우고 새로). 3달 전 ~ 1년 뒤 */
export async function syncGoogleCalendar(url: string, now = new Date()): Promise<number> {
  const text = await fetchText(url)
  if (!text.includes('BEGIN:VCALENDAR')) throw new CalendarFetchError('캘린더 주소가 아니에요. "iCal 형식의 비공개 주소"를 넣어 주세요')
  const list = parseIcs(text, addMonths(now, -3), addMonths(now, 12))
  const stamp = nowIso(now)
  const rows: CalendarEvent[] = list.map((e) => ({ title: e.title, startDate: e.startDate, endDate: e.endDate, color: 'blue', memo: e.memo, source: 'google', uid: e.uid, createdAt: stamp, updatedAt: stamp }))
  await db.transaction('rw', db.events, async () => {
    const old = await db.events.filter((e) => e.source === 'google').primaryKeys()
    await db.events.bulkDelete(old)
    await db.events.bulkAdd(rows)
  })
  save({ url, last: stamp, count: rows.length })
  return rows.length
}

/** 연결 끊기: 가져온 일정도 지운다 */
export async function disconnectGoogleCalendar(): Promise<void> {
  const old = await db.events.filter((e) => e.source === 'google').primaryKeys()
  await db.events.bulkDelete(old)
  save(null)
}

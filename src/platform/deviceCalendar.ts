import { registerPlugin } from '@capacitor/core'
import { addMonths } from 'date-fns'
import { db } from '../db/database'
import type { EventColor } from '../db/types'
import { nowIso } from '../lib/date'
import { buildDevicePush, defaultPicks, isTidyCalendar, planDevicePush, planImport, type DeviceCalendar, type DeviceEvent, type TidyRemote } from '../lib/deviceCal'
import { isNativeApp } from './native'

/**
 * 삼성 캘린더(폰 캘린더) 연동 (폰 앱만, DeviceCalendarPlugin.java)
 * - 가져오기: 고른 폰 캘린더 일정을 Tidy 달력과 달력 위젯에 보인다 (읽기만, 고치려면 삼성 캘린더에서)
 * - 보내기: Tidy 에서 넣은 일정을 폰에 만든 "Tidy" 캘린더에 넣는다. 삼성 캘린더에서 바로 보인다. 할 일은 보내지 않는다
 * 설정은 이 기기에만 저장한다 (폰마다 캘린더가 다르니까)
 */
interface DeviceCalendarPlugin {
  permission(): Promise<{ granted: boolean }>
  requestPermission(): Promise<{ granted: boolean }>
  calendars(): Promise<{ calendars: DeviceCalendar[] }>
  events(o: { ids: string[]; from: number; to: number }): Promise<{ events: DeviceEvent[] }>
  tidyCalendar(o: { create: boolean }): Promise<{ id?: string }>
  tidyEvents(o: { id: string }): Promise<{ events: TidyRemote[] }>
  applyTidy(o: { id: string; insert: unknown[]; update: unknown[]; remove: string[] }): Promise<{ count: number }>
  removeTidyCalendar(): Promise<void>
}
const Native = registerPlugin<DeviceCalendarPlugin>('DeviceCalendar')

/** 고른 캘린더 (이름 · 색은 목록을 다시 읽을 때 새로 적는다) */
export interface PickedCal {
  id: string
  name: string
  color: string
}

export interface DeviceCalSettings {
  /** 이 기기 표시 (가져온 일정 calId 에 붙는다) */
  device: string
  /** 폰 일정 가져오기 */
  pull: boolean
  picked: PickedCal[]
  /** Tidy 일정을 폰 Tidy 캘린더에 넣기 */
  push: boolean
  last?: string
  count?: number
  pushCount?: number
  error?: string
}

const KEY = 'tidy-device-cal'
const EVENT = 'tidy:device-cal'
export const DEVICE_REFRESH_MS = 5 * 60 * 1000

export const deviceCalAvailable = () => isNativeApp()

export function loadDeviceCal(): DeviceCalSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<DeviceCalSettings> | null
    if (!v || typeof v.device !== 'string') return null
    return {
      device: v.device,
      pull: v.pull === true,
      push: v.push === true,
      picked: Array.isArray(v.picked) ? v.picked.filter((p) => p && typeof p.id === 'string') : [],
      ...(typeof v.last === 'string' && { last: v.last }),
      ...(typeof v.count === 'number' && { count: v.count }),
      ...(typeof v.pushCount === 'number' && { pushCount: v.pushCount }),
      ...(typeof v.error === 'string' && { error: v.error }),
    }
  } catch {
    return null
  }
}

function save(v: DeviceCalSettings) {
  localStorage.setItem(KEY, JSON.stringify(v))
  window.dispatchEvent(new CustomEvent(EVENT))
}

function patch(change: Partial<DeviceCalSettings>, drop: (keyof DeviceCalSettings)[] = []) {
  const next: DeviceCalSettings = { ...(loadDeviceCal() ?? fresh()), ...change }
  for (const k of drop) delete next[k]
  save(next)
}

const fresh = (): DeviceCalSettings => ({ device: Math.random().toString(36).slice(2, 8), pull: false, push: false, picked: [] })

export function onDeviceCalChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

export class DeviceCalError extends Error {}

export async function hasCalendarPermission(): Promise<boolean> {
  if (!deviceCalAvailable()) return false
  try {
    return (await Native.permission()).granted
  } catch {
    return false
  }
}

/** 권한 창을 띄운다. 예전에 "거부"를 두 번 눌렀으면 창이 안 뜨고 false */
export async function askCalendarPermission(): Promise<boolean> {
  if (!deviceCalAvailable()) return false
  try {
    return (await Native.requestPermission()).granted
  } catch {
    // 캘린더 기능이 없는 옛 버전 앱
    throw new DeviceCalError('앱을 새 버전으로 업데이트해 주세요')
  }
}

/** 고를 수 있는 폰 캘린더 (Tidy 가 만든 캘린더는 뺀다) */
export async function listDeviceCalendars(): Promise<DeviceCalendar[]> {
  const { calendars } = await Native.calendars()
  return calendars.filter((c) => !isTidyCalendar(c))
}

/** 이 기기에서 가져온 일정 */
async function mineKeys(device: string): Promise<number[]> {
  const prefix = `d:${device}:`
  return (await db.events.filter((e) => e.source === 'device' && !!e.calId?.startsWith(prefix)).primaryKeys()) as number[]
}

/** 폰 일정 다시 읽어서 바뀐 것만 반영. 3달 전 ~ 1년 뒤 */
export async function pullDeviceCalendar(now = new Date()): Promise<number> {
  const s = loadDeviceCal()
  if (!s?.pull) return 0
  // 캘린더 이름 · 색이 삼성 캘린더에서 바뀌었으면 따라간다. 지워진 캘린더는 뺀다
  const all = await listDeviceCalendars()
  const picked = s.picked.flatMap((p) => {
    const c = all.find((x) => x.id === p.id)
    return c ? [{ id: c.id, name: c.name, color: c.color }] : []
  })
  const { events } = picked.length ? await Native.events({ ids: picked.map((p) => p.id), from: addMonths(now, -3).getTime(), to: addMonths(now, 12).getTime() }) : { events: [] }
  const colors: Record<string, EventColor> = Object.fromEntries(picked.map((p) => [p.id, (/^#[0-9a-f]{6}$/i.test(p.color) ? p.color.toLowerCase() : 'blue') as EventColor]))
  const stamp = nowIso(now)
  const existing = await db.events.toArray()
  const plan = planImport(existing, events, colors, s.device, stamp)
  if (plan.add.length || plan.update.length || plan.remove.length) {
    await db.transaction('rw', db.events, async () => {
      if (plan.remove.length) await db.events.bulkDelete(plan.remove)
      for (const u of plan.update) await db.events.update(u.id, u.changes)
      if (plan.add.length) await db.events.bulkAdd(plan.add)
    })
  }
  const count = (await mineKeys(s.device)).length
  patch({ picked, last: stamp, count }, ['error'])
  return count
}

/** Tidy 일정을 폰 Tidy 캘린더에 맞춘다 */
export async function pushDeviceCalendar(): Promise<number> {
  const s = loadDeviceCal()
  if (!s?.push) return 0
  const { id } = await Native.tidyCalendar({ create: true })
  if (!id) throw new DeviceCalError('Tidy 캘린더를 만들지 못했어요')
  const want = buildDevicePush(await db.events.toArray())
  const { events: remote } = await Native.tidyEvents({ id })
  const plan = planDevicePush(want, remote)
  if (plan.insert.length || plan.update.length || plan.remove.length) await Native.applyTidy({ id, ...plan })
  patch({ pushCount: want.length, last: nowIso() }, ['error'])
  return want.length
}

export function deviceCalErrorText(err: unknown): string {
  if (err instanceof DeviceCalError) return err.message
  const msg = err instanceof Error ? err.message : ''
  if (/권한|permission/i.test(msg)) return '캘린더 권한이 꺼져 있어요. 폰 설정 > 애플리케이션 > Tidy > 권한에서 캘린더를 허용해 주세요'
  return msg || '삼성 캘린더와 맞추지 못했어요'
}

let running: Promise<void> | null = null

/** 켜 둔 것만 조용히 맞춘다 (가져오기 → 보내기). 이미 도는 중이면 그걸 기다린다 */
export function syncDeviceCalendar(): Promise<void> {
  if (running) return running
  running = (async () => {
    const s = loadDeviceCal()
    if (!s || (!s.pull && !s.push)) return
    if (!(await hasCalendarPermission())) {
      patch({ error: '캘린더 권한이 꺼져 있어요. 폰 설정 > 애플리케이션 > Tidy > 권한에서 캘린더를 허용해 주세요' })
      return
    }
    try {
      await pullDeviceCalendar()
      await pushDeviceCalendar()
    } catch (err) {
      patch({ error: deviceCalErrorText(err) })
    }
  })().finally(() => {
    running = null
  })
  return running
}

/** 가져오기 켜기: 권한 → 캘린더 고르기 결과 저장 → 바로 가져오기 */
export async function setDevicePull(on: boolean, picked?: PickedCal[]): Promise<number> {
  const s = loadDeviceCal() ?? fresh()
  if (!on) {
    await db.events.bulkDelete(await mineKeys(s.device))
    patch({ pull: false, count: 0 })
    return 0
  }
  if (!(await askCalendarPermission())) throw new DeviceCalError('캘린더 권한을 허용해야 가져올 수 있어요')
  let list = picked
  if (!list) {
    const all = await listDeviceCalendars()
    const ids = s.picked.length ? s.picked.map((p) => p.id) : defaultPicks(all)
    list = all.filter((c) => ids.includes(c.id)).map((c) => ({ id: c.id, name: c.name, color: c.color }))
  }
  save({ ...s, pull: true, picked: list })
  return pullDeviceCalendar()
}

/** 보내기 켜기 / 끄기. 끌 때 removeCalendar 면 폰의 Tidy 캘린더도 지운다 */
export async function setDevicePush(on: boolean, removeCalendar = false): Promise<number> {
  const s = loadDeviceCal() ?? fresh()
  if (!on) {
    save({ ...s, push: false })
    if (removeCalendar && (await hasCalendarPermission())) await Native.removeTidyCalendar()
    return 0
  }
  if (!(await askCalendarPermission())) throw new DeviceCalError('캘린더 권한을 허용해야 넣을 수 있어요')
  save({ ...s, push: true })
  return pushDeviceCalendar()
}

/** 일정이 어느 폰 캘린더에서 왔는지 (이름) */
export function deviceCalName(calId: string | undefined, s: DeviceCalSettings | null): string | undefined {
  if (!calId || !s) return undefined
  const id = calId.split(':')[2]
  return s.picked.find((p) => p.id === id)?.name
}

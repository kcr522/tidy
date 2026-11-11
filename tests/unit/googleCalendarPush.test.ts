import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/database'
import type { CalendarEvent, Todo } from '../../src/db/types'

vi.mock('../../src/platform/googleAuth', async (orig) => ({
  ...(await orig<typeof import('../../src/platform/googleAuth')>()),
  getGoogleToken: vi.fn(async () => 'tok'),
  forgetGoogleToken: vi.fn(),
  dropGoogleToken: vi.fn(),
}))

const { connectGooglePush, disconnectGooglePush, loadGooglePush, pushNow, setPushTodos } = await import('../../src/platform/googleCalendarPush')

/** 구글 캘린더 API 흉내: 캘린더별 일정, 지운 일정은 status=cancelled 로 남는다 */
type Ev = { id: string; status: string; summary: string; extendedProperties?: { private?: { tidy?: string } } }
let cals: Map<string, Map<string, Ev>>
let calls: string[]

function fakeFetch(input: string, init: RequestInit = {}) {
  const url = new URL(input)
  const method = init.method ?? 'GET'
  const body = init.body ? JSON.parse(String(init.body)) : undefined
  calls.push(`${method} ${url.pathname.replace('/calendar/v3', '')}`)
  const json = (status: number, v: unknown) => new Response(v === null ? '' : JSON.stringify(v), { status })
  if (url.pathname.endsWith('/userinfo')) return json(200, { email: 'me@example.com' })
  if (url.pathname === '/calendar/v3/calendars' && method === 'POST') {
    const id = `cal${cals.size + 1}@group.calendar.google.com`
    cals.set(id, new Map())
    return json(200, { id })
  }
  const m = url.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)(?:\/events(?:\/([^/]+))?)?$/)
  if (!m) return json(404, null)
  const cal = cals.get(decodeURIComponent(m[1]))
  if (!cal) return json(404, { error: { message: 'Not Found' } })
  const [, , eid] = m
  if (!url.pathname.includes('/events')) {
    if (method === 'DELETE') cals.delete(decodeURIComponent(m[1]))
    return json(204, null)
  }
  if (!eid && method === 'GET') return json(200, { items: [...cal.values()].filter((e) => e.status !== 'cancelled') })
  if (!eid && method === 'POST') {
    if (cal.has(body.id)) return json(409, { error: { message: 'The requested identifier already exists.' } })
    cal.set(body.id, { status: 'confirmed', ...body })
    return json(200, body)
  }
  if (method === 'PUT') {
    cal.set(eid, { status: 'confirmed', ...body, id: eid })
    return json(200, body)
  }
  if (method === 'DELETE') {
    const e = cal.get(eid)
    if (!e || e.status === 'cancelled') return json(410, null)
    e.status = 'cancelled'
    return json(204, null)
  }
  return json(400, null)
}

const ev = (title: string, startDate: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ title, startDate, endDate: startDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
const todo = (title: string, dueDate: string, extra: Partial<Todo> = {}): Todo => ({ title, isCompleted: 0, completedAt: null, dueDate, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...extra })
const live = (cal: string) => [...cals.get(cal)!.values()].filter((e) => e.status !== 'cancelled').map((e) => e.summary).sort()

beforeEach(() => {
  cals = new Map()
  calls = []
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('CustomEvent', class extends Event {})
  vi.stubGlobal('fetch', async (u: string, i?: RequestInit) => fakeFetch(u, i))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all([db.events.clear(), db.todos.clear()])
})

describe('구글 캘린더에 Tidy 일정 보내기', () => {
  it('연결하면 Tidy 캘린더를 만들고 일정과 할 일을 넣는다 (구글에서 가져온 일정과 끝낸 할 일은 빼고)', async () => {
    await db.events.bulkAdd([ev('엄마 생신', '2026-11-15'), ev('구글 일정', '2026-11-16', { source: 'google' })])
    await db.todos.bulkAdd([todo('보고서', '2026-11-12'), todo('끝냄', '2026-11-12', { isCompleted: 1 })])
    expect(await connectGooglePush()).toBe(2)
    const s = loadGooglePush()!
    expect(s).toMatchObject({ calendarId: 'cal1@group.calendar.google.com', email: 'me@example.com', todos: true, count: 2 })
    expect(live(s.calendarId)).toEqual(['☐ 보고서', '엄마 생신'])
  })

  it('고치고 지우면 그대로 따라가고, 바뀐 게 없으면 다시 보내지 않는다', async () => {
    const [a, b] = (await db.events.bulkAdd([ev('A', '2026-11-12'), ev('B', '2026-11-13')], { allKeys: true })) as number[]
    await connectGooglePush()
    const cal = loadGooglePush()!.calendarId
    await db.events.update(a, { title: 'A2' })
    await db.events.delete(b)
    await db.events.add(ev('C', '2026-11-14'))
    calls = []
    await pushNow()
    expect(live(cal)).toEqual(['A2', 'C'])
    expect(calls.filter((c) => !c.startsWith('GET'))).toHaveLength(3)
    calls = []
    await pushNow()
    expect(calls.every((c) => c.startsWith('GET'))).toBe(true)
  })

  it('지웠던 일정이 같은 id 로 다시 생기면 되살린다 (구글 409)', async () => {
    const id = await db.events.add(ev('A', '2026-11-12'))
    await connectGooglePush()
    const cal = loadGooglePush()!.calendarId
    await db.events.delete(id)
    await pushNow()
    expect(live(cal)).toEqual([])
    await db.events.add({ ...ev('A 다시', '2026-11-12'), id })
    await pushNow()
    expect(live(cal)).toEqual(['A 다시'])
  })

  it('할 일 보내기를 끄면 구글에서 할 일만 빠지고, 사용자가 구글에서 직접 넣은 일정은 그대로', async () => {
    await db.events.add(ev('A', '2026-11-12'))
    await db.todos.add(todo('보고서', '2026-11-12'))
    await connectGooglePush()
    const cal = loadGooglePush()!.calendarId
    cals.get(cal)!.set('mine123', { id: 'mine123', status: 'confirmed', summary: '내가 구글에서 넣음' })
    setPushTodos(false)
    await pushNow()
    expect(live(cal)).toEqual(['A', '내가 구글에서 넣음'])
  })

  it('구글에서 Tidy 캘린더를 지웠으면 새로 만든다', async () => {
    await db.events.add(ev('A', '2026-11-12'))
    await connectGooglePush()
    cals.clear()
    await pushNow()
    const s = loadGooglePush()!
    expect(s.calendarId).toBe('cal1@group.calendar.google.com')
    expect(live(s.calendarId)).toEqual(['A'])
  })

  it('실패하면 오류를 적어 두고, 다음에 되면 지운다', async () => {
    await db.events.add(ev('A', '2026-11-12'))
    await connectGooglePush()
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'x' } }), { status: 401 }))
    await pushNow()
    expect(loadGooglePush()!.error).toBe('구글 권한이 끊겼어요. 다시 연결해 주세요')
    vi.stubGlobal('fetch', async (u: string, i?: RequestInit) => fakeFetch(u, i))
    await pushNow()
    expect(loadGooglePush()!.error).toBeUndefined()
  })

  it('끊을 때 구글 캘린더도 지울 수 있다', async () => {
    await connectGooglePush()
    await disconnectGooglePush(true)
    expect(loadGooglePush()).toBeNull()
    expect(cals.size).toBe(0)
  })
})

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
type GoogleEvent = { id: string; status: string; summary: string; extendedProperties?: { private?: { tidy?: string } } }
let cals: Map<string, Map<string, GoogleEvent>>
let calls: string[]

function fakeFetch(input: string, init: RequestInit = {}) {
  const url = new URL(input)
  const method = init.method ?? 'GET'
  const body = init.body ? JSON.parse(String(init.body)) : undefined
  calls.push(`${method} ${url.pathname.replace('/calendar/v3', '')}`)
  const json = (status: number, value: unknown) => new Response(value === null ? '' : JSON.stringify(value), { status })
  if (url.pathname.endsWith('/userinfo')) return json(200, { email: 'me@example.com' })
  if (url.pathname === '/calendar/v3/calendars' && method === 'POST') {
    const id = `cal${cals.size + 1}@group.calendar.google.com`
    cals.set(id, new Map())
    return json(200, { id })
  }
  const match = url.pathname.match(/^\/calendar\/v3\/calendars\/([^/]+)(?:\/events(?:\/([^/]+))?)?$/)
  if (!match) return json(404, null)
  const calId = decodeURIComponent(match[1])
  const cal = cals.get(calId)
  if (!cal) return json(404, { error: { message: 'Not Found' } })
  const eid = match[2]
  if (!url.pathname.includes('/events')) {
    if (method === 'DELETE') cals.delete(calId)
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
    const found = cal.get(eid)
    if (!found || found.status === 'cancelled') return json(410, null)
    found.status = 'cancelled'
    return json(204, null)
  }
  return json(400, null)
}

const event = (title: string, startDate: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ title, startDate, endDate: startDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
const todo = (title: string, dueDate: string, extra: Partial<Todo> = {}): Todo => ({ title, isCompleted: 0, completedAt: null, dueDate, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...extra })
/** 구글 캘린더에 지금 살아 있는 일정 제목들 */
const liveTitles = (calId: string) => [...cals.get(calId)!.values()].filter((item) => item.status !== 'cancelled').map((item) => item.summary).sort()
const writes = () => calls.filter((call) => !call.startsWith('GET'))
const FIRST_CAL = 'cal1@group.calendar.google.com'
const DONE = { isCompleted: 1 as const }

beforeEach(() => {
  cals = new Map()
  calls = []
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => void store.set(key, value), removeItem: (key: string) => void store.delete(key) })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('CustomEvent', class extends Event {})
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => fakeFetch(url, init))
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await Promise.all([db.events.clear(), db.todos.clear()])
})

describe('구글 캘린더에 Tidy 일정 보내기', () => {
  it('연결하면 Tidy 캘린더를 만들고 Tidy 일정만 넣는다 (할 일 · 구글에서 가져온 일정은 빼고)', async () => {
    await db.events.bulkAdd([event('엄마 생신', '2026-11-15'), event('구글 일정', '2026-11-16', { source: 'google' })])
    await db.todos.bulkAdd([todo('보고서', '2026-11-12'), todo('끝냄', '2026-11-12', DONE)])

    const sent = await connectGooglePush()

    expect(sent).toBe(1)
    const settings = loadGooglePush()!
    expect(settings).toMatchObject({ calendarId: FIRST_CAL, email: 'me@example.com', todos: false, count: 1 })
    expect(liveTitles(settings.calendarId)).toEqual(['엄마 생신'])
  })

  it('"할 일도 보내기" 를 켜면 끝내지 않은 할 일도 ☐ 를 붙여 보낸다', async () => {
    await db.events.add(event('엄마 생신', '2026-11-15'))
    await db.todos.bulkAdd([todo('보고서', '2026-11-12'), todo('끝냄', '2026-11-12', DONE)])
    await connectGooglePush()

    setPushTodos(true)
    const sent = await pushNow()

    expect(sent).toBe(2)
    expect(liveTitles(loadGooglePush()!.calendarId)).toEqual(['☐ 보고서', '엄마 생신'])
  })

  it('예전에 저장된 설정(todos: true)은 할 일 보내기 끔으로 읽는다', () => {
    localStorage.setItem('tidy-google-push', JSON.stringify({ calendarId: 'x', todos: true }))

    expect(loadGooglePush()?.todos).toBe(false)
  })

  it('Tidy 에서 고치고 · 지우고 · 넣은 일정을 구글에도 그대로 따라 한다', async () => {
    const [first, second] = (await db.events.bulkAdd([event('A', '2026-11-12'), event('B', '2026-11-13')], { allKeys: true })) as number[]
    await connectGooglePush()
    await db.events.update(first, { title: 'A2' })
    await db.events.delete(second)
    await db.events.add(event('C', '2026-11-14'))
    calls = []

    await pushNow()

    expect(liveTitles(loadGooglePush()!.calendarId)).toEqual(['A2', 'C'])
    expect(writes()).toHaveLength(3) // 고치기 1 + 지우기 1 + 넣기 1
  })

  it('바뀐 게 없으면 구글에 다시 보내지 않고 읽기만 한다', async () => {
    await db.events.add(event('A', '2026-11-12'))
    await connectGooglePush()
    calls = []

    await pushNow()

    expect(writes()).toEqual([])
  })

  it('지웠던 일정이 같은 id 로 다시 생기면 되살린다 (구글 409)', async () => {
    const id = await db.events.add(event('A', '2026-11-12'))
    await connectGooglePush()
    const calId = loadGooglePush()!.calendarId
    await db.events.delete(id)
    await pushNow()
    expect(liveTitles(calId)).toEqual([])

    await db.events.add({ ...event('A 다시', '2026-11-12'), id })
    await pushNow()

    expect(liveTitles(calId)).toEqual(['A 다시'])
  })

  it('할 일 보내기를 끄면 구글에서 할 일만 빠지고, 사용자가 구글에서 직접 넣은 일정은 그대로다', async () => {
    await db.events.add(event('A', '2026-11-12'))
    await db.todos.add(todo('보고서', '2026-11-12'))
    await connectGooglePush()
    const calId = loadGooglePush()!.calendarId
    cals.get(calId)!.set('mine123', { id: 'mine123', status: 'confirmed', summary: '내가 구글에서 넣음' })

    setPushTodos(false)
    await pushNow()

    expect(liveTitles(calId)).toEqual(['A', '내가 구글에서 넣음'])
  })

  it('구글에서 Tidy 캘린더를 지웠으면 새로 만들어 다시 넣는다', async () => {
    await db.events.add(event('A', '2026-11-12'))
    await connectGooglePush()
    cals.clear()

    await pushNow()

    const settings = loadGooglePush()!
    expect(settings.calendarId).toBe(FIRST_CAL)
    expect(liveTitles(settings.calendarId)).toEqual(['A'])
  })

  it('보내기가 401 로 실패하면 다시 연결하라는 오류를 적어 둔다', async () => {
    await db.events.add(event('A', '2026-11-12'))
    await connectGooglePush()
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ error: { message: 'x' } }), { status: 401 }))

    await pushNow()

    expect(loadGooglePush()!.error).toBe('구글 권한이 끊겼어요. 다시 연결해 주세요')
  })

  it('실패한 뒤 다음 보내기가 되면 적어 둔 오류를 지운다', async () => {
    await db.events.add(event('A', '2026-11-12'))
    await connectGooglePush()
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 401 }))
    await pushNow()
    vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => fakeFetch(url, init))

    await pushNow()

    expect(loadGooglePush()!.error).toBeUndefined()
  })

  it('연결을 끊을 때 구글의 Tidy 캘린더도 지울 수 있다', async () => {
    await connectGooglePush()
    const alsoDeleteCalendar = true

    await disconnectGooglePush(alsoDeleteCalendar)

    expect(loadGooglePush()).toBeNull()
    expect(cals.size).toBe(0)
  })
})

import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/database'
import type { CalendarEvent } from '../../src/db/types'
import { addGoogleCalendar, calOf, disconnectGoogleCalendar, loadGoogleCals, nextColor, setGoogleCalColor, syncGoogleCalendar } from '../../src/platform/googleCalendar'

const ics = (...titles: string[]) =>
  ['BEGIN:VCALENDAR', ...titles.flatMap((t, i) => ['BEGIN:VEVENT', `UID:${t}-${i}`, 'DTSTART;VALUE=DATE:20261112', 'DTEND;VALUE=DATE:20261113', `SUMMARY:${t}`, 'END:VEVENT']), 'END:VCALENDAR'].join(
    '\r\n',
  )

const feeds: Record<string, string> = {}
const now = new Date('2026-11-11T09:00:00+09:00')

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  vi.stubGlobal('window', new EventTarget())
  vi.stubGlobal('CustomEvent', class extends Event {})
  // 웹에서는 /api/ical?url=… 로 우리 서버가 대신 읽는다
  vi.stubGlobal('fetch', async (req: string) => {
    const url = new URL(req, 'http://localhost').searchParams.get('url') ?? ''
    return feeds[url] ? new Response(feeds[url]) : new Response(JSON.stringify({ error: '주소를 찾을 수 없어요' }), { status: 404 })
  })
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await db.events.clear()
})

const google = () => db.events.filter((e) => e.source === 'google').toArray()

describe('구글 캘린더 여러 개', () => {
  it('예전에 하나만 저장한 연결은 파란색 캘린더 하나로 읽는다', () => {
    localStorage.setItem(
      'tidy-google-cal',
      JSON.stringify({
        url: 'https://a/basic.ics',
        last: '2026-11-10T00:00:00Z',
        count: 3,
      }),
    )
    expect(loadGoogleCals()).toEqual([
      {
        id: 'g1',
        name: '구글 캘린더',
        url: 'https://a/basic.ics',
        color: 'blue',
        last: '2026-11-10T00:00:00Z',
        count: 3,
      },
    ])
  })

  it('새 캘린더 색은 아직 안 쓴 색부터', () => {
    expect(nextColor([])).toBe('blue')
    expect(nextColor(['blue'])).toBe('pink')
    expect(nextColor(['blue', 'pink', 'orange', 'green', 'purple', 'red'])).toBe('blue')
  })

  it('캘린더마다 고른 색으로 가져오고, 다시 가져와도 다른 캘린더 일정은 그대로', async () => {
    feeds['https://a/basic.ics'] = ics('회의', '출장')
    feeds['https://b/basic.ics'] = ics('필라테스')
    expect(await addGoogleCalendar({ name: '회사', url: 'https://a/basic.ics', color: 'purple' }, now)).toBe(2)
    expect(await addGoogleCalendar({ name: '개인', url: 'https://b/basic.ics', color: 'green' }, new Date(now.getTime() + 1))).toBe(1)
    const cals = loadGoogleCals()
    expect(cals.map((c) => [c.name, c.color, c.count])).toEqual([
      ['회사', 'purple', 2],
      ['개인', 'green', 1],
    ])

    const list = await google()
    expect(list.map((e) => [e.title, e.color]).sort()).toEqual([
      ['출장', 'purple'],
      ['필라테스', 'green'],
      ['회의', 'purple'],
    ])
    expect(calOf(list.find((e) => e.title === '필라테스')!, cals)?.name).toBe('개인')

    feeds['https://a/basic.ics'] = ics('회의')
    await syncGoogleCalendar(cals[0], now)
    expect((await google()).map((e) => e.title).sort()).toEqual(['필라테스', '회의'])
  })

  it('색을 바꾸면 이미 가져온 일정 색도 바로 바뀐다', async () => {
    feeds['https://a/basic.ics'] = ics('회의')
    feeds['https://b/basic.ics'] = ics('필라테스')
    await addGoogleCalendar({ name: '회사', url: 'https://a/basic.ics', color: 'blue' }, now)
    await addGoogleCalendar({ name: '개인', url: 'https://b/basic.ics', color: 'green' }, new Date(now.getTime() + 1))
    await setGoogleCalColor(loadGoogleCals()[0].id, 'red')
    expect(loadGoogleCals()[0].color).toBe('red')
    expect((await google()).map((e) => [e.title, e.color]).sort()).toEqual([
      ['필라테스', 'green'],
      ['회의', 'red'],
    ])
  })

  it('끊으면 그 캘린더 일정만 지운다', async () => {
    feeds['https://a/basic.ics'] = ics('회의')
    feeds['https://b/basic.ics'] = ics('필라테스')
    await addGoogleCalendar({ name: '회사', url: 'https://a/basic.ics', color: 'blue' }, now)
    await addGoogleCalendar({ name: '개인', url: 'https://b/basic.ics', color: 'green' }, new Date(now.getTime() + 1))
    await disconnectGoogleCalendar(loadGoogleCals()[0].id)
    expect(loadGoogleCals().map((c) => c.name)).toEqual(['개인'])
    expect((await google()).map((e) => e.title)).toEqual(['필라테스'])
  })

  it('예전에 가져온 일정(calId 없음)은 첫 캘린더 것으로 보고 색을 바꾼다', async () => {
    localStorage.setItem('tidy-google-cal', JSON.stringify({ url: 'https://a/basic.ics' }))
    const old: CalendarEvent = {
      title: '예전 일정',
      startDate: '2026-11-12',
      endDate: '2026-11-12',
      color: 'blue',
      memo: '',
      source: 'google',
      createdAt: '',
      updatedAt: '',
    }
    await db.events.add(old)
    await setGoogleCalColor('g1', 'orange')
    expect((await google())[0]).toMatchObject({ color: 'orange', calId: 'g1' })
  })

  it('가져오지 못하면 목록에 넣지 않고, 같은 주소는 두 번 연결하지 않는다', async () => {
    await expect(addGoogleCalendar({ name: '', url: 'https://none/basic.ics', color: 'blue' }, now)).rejects.toThrow()
    expect(loadGoogleCals()).toEqual([])
    feeds['https://a/basic.ics'] = ics('회의')
    await addGoogleCalendar({ name: '', url: 'https://a/basic.ics', color: 'blue' }, now)
    expect(loadGoogleCals()[0].name).toBe('구글 캘린더')
    await expect(addGoogleCalendar({ name: '', url: 'https://a/basic.ics', color: 'red' }, now)).rejects.toThrow('이미 연결한 주소예요')
  })
})

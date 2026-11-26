import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../../src/db/database'
import type { CalendarEvent, EventColor } from '../../src/db/types'
import { addGoogleCalendar, calOf, disconnectGoogleCalendar, loadGoogleCals, nextColor, setGoogleCalColor, syncGoogleCalendar } from '../../src/platform/googleCalendar'

/** 제목마다 11월 12일 하루 종일 일정 하나씩 든 iCal 글 */
const ics = (...titles: string[]) =>
  ['BEGIN:VCALENDAR', ...titles.flatMap((title, i) => ['BEGIN:VEVENT', `UID:${title}-${i}`, 'DTSTART;VALUE=DATE:20261112', 'DTEND;VALUE=DATE:20261113', `SUMMARY:${title}`, 'END:VEVENT']), 'END:VCALENDAR'].join(
    '\r\n',
  )

const feeds: Record<string, string> = {}
const now = new Date('2026-11-11T09:00:00+09:00')
const aMomentLater = new Date(now.getTime() + 1)
const WORK_URL = 'https://a/basic.ics'
const HOME_URL = 'https://b/basic.ics'

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
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

const googleEvents = () => db.events.filter((event) => event.source === 'google').toArray()
const titlesAndColors = async () => (await googleEvents()).map((event) => [event.title, event.color]).sort()

/** 회사(회의) · 개인(필라테스) 캘린더 두 개를 연결한다 */
async function connectTwo(workColor: EventColor = 'blue') {
  feeds[WORK_URL] = ics('회의')
  feeds[HOME_URL] = ics('필라테스')
  await addGoogleCalendar({ name: '회사', url: WORK_URL, color: workColor }, now)
  await addGoogleCalendar({ name: '개인', url: HOME_URL, color: 'green' }, aMomentLater)
}

describe('구글 캘린더 여러 개', () => {
  it('예전에 하나만 저장한 연결은 파란색 캘린더 하나로 읽는다', () => {
    localStorage.setItem('tidy-google-cal', JSON.stringify({ url: WORK_URL, last: '2026-11-10T00:00:00Z', count: 3 }))

    const cals = loadGoogleCals()

    expect(cals).toEqual([{ id: 'g1', name: '구글 캘린더', url: WORK_URL, color: 'blue', last: '2026-11-10T00:00:00Z', count: 3 }])
  })

  it.each([
    ['아무 색도 안 썼으면 파랑', [], 'blue'],
    ['파랑을 썼으면 분홍', ['blue'], 'pink'],
    ['원래 6색을 다 써도 다음 색(코랄) — 색이 21가지로 늘어서', ['blue', 'pink', 'orange', 'green', 'purple', 'red'], 'coral'],
  ])('새 캘린더 색: %s', (_case, used, color) => {
    expect(nextColor(used as EventColor[])).toBe(color)
  })

  it('캘린더마다 고른 색으로 가져오고 가져온 일정 수를 센다', async () => {
    feeds[WORK_URL] = ics('회의', '출장')
    feeds[HOME_URL] = ics('필라테스')

    const workCount = await addGoogleCalendar({ name: '회사', url: WORK_URL, color: 'purple' }, now)
    const homeCount = await addGoogleCalendar({ name: '개인', url: HOME_URL, color: 'green' }, aMomentLater)

    expect([workCount, homeCount]).toEqual([2, 1])
    expect(loadGoogleCals().map((cal) => [cal.name, cal.color, cal.count])).toEqual([
      ['회사', 'purple', 2],
      ['개인', 'green', 1],
    ])
    expect(await titlesAndColors()).toEqual([
      ['출장', 'purple'],
      ['필라테스', 'green'],
      ['회의', 'purple'],
    ])
  })

  it('가져온 일정이 어느 캘린더 것인지 알아본다', async () => {
    await connectTwo()

    const pilates = (await googleEvents()).find((event) => event.title === '필라테스')!

    expect(calOf(pilates, loadGoogleCals())?.name).toBe('개인')
  })

  it('한 캘린더를 다시 가져와도 다른 캘린더 일정은 그대로다', async () => {
    feeds[WORK_URL] = ics('회의', '출장')
    feeds[HOME_URL] = ics('필라테스')
    await addGoogleCalendar({ name: '회사', url: WORK_URL, color: 'purple' }, now)
    await addGoogleCalendar({ name: '개인', url: HOME_URL, color: 'green' }, aMomentLater)
    feeds[WORK_URL] = ics('회의')

    await syncGoogleCalendar(loadGoogleCals()[0], now)

    expect((await googleEvents()).map((event) => event.title).sort()).toEqual(['필라테스', '회의'])
  })

  it('색을 바꾸면 이미 가져온 일정 색도 바로 바뀐다', async () => {
    await connectTwo()

    await setGoogleCalColor(loadGoogleCals()[0].id, 'red')

    expect(loadGoogleCals()[0].color).toBe('red')
    expect(await titlesAndColors()).toEqual([
      ['필라테스', 'green'],
      ['회의', 'red'],
    ])
  })

  it('연결을 끊으면 그 캘린더와 그 일정만 지운다', async () => {
    await connectTwo()

    await disconnectGoogleCalendar(loadGoogleCals()[0].id)

    expect(loadGoogleCals().map((cal) => cal.name)).toEqual(['개인'])
    expect((await googleEvents()).map((event) => event.title)).toEqual(['필라테스'])
  })

  it('예전에 가져온 일정(calId 없음)은 첫 캘린더 것으로 보고 색을 바꾼다', async () => {
    localStorage.setItem('tidy-google-cal', JSON.stringify({ url: WORK_URL }))
    const oldEvent: CalendarEvent = { title: '예전 일정', startDate: '2026-11-12', endDate: '2026-11-12', color: 'blue', memo: '', source: 'google', createdAt: '', updatedAt: '' }
    await db.events.add(oldEvent)

    await setGoogleCalColor('g1', 'orange')

    expect((await googleEvents())[0]).toMatchObject({ color: 'orange', calId: 'g1' })
  })

  it('가져오지 못한 주소는 목록에 넣지 않는다', async () => {
    const missingUrl = 'https://none/basic.ics'

    await expect(addGoogleCalendar({ name: '', url: missingUrl, color: 'blue' }, now)).rejects.toThrow()

    expect(loadGoogleCals()).toEqual([])
  })

  it('이름을 비우면 "구글 캘린더" 로 부르고, 같은 주소는 두 번 연결하지 않는다', async () => {
    feeds[WORK_URL] = ics('회의')
    await addGoogleCalendar({ name: '', url: WORK_URL, color: 'blue' }, now)

    const again = addGoogleCalendar({ name: '', url: WORK_URL, color: 'red' }, now)

    expect(loadGoogleCals()[0].name).toBe('구글 캘린더')
    await expect(again).rejects.toThrow('이미 연결한 주소예요')
  })
})

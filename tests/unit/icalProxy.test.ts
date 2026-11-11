import { describe, expect, it } from 'vitest'
import { fetchIcal, isAllowedIcalUrl } from '../../src/lib/icalProxy'

const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'
const GOOD = 'https://calendar.google.com/calendar/ical/abc%40gmail.com/private-123/basic.ics'

describe('웹 구글 캘린더 대신 읽기', () => {
  it('구글 캘린더 iCal 주소만 받는다', () => {
    expect(isAllowedIcalUrl(GOOD)).toBe(true)
    for (const bad of ['http://calendar.google.com/calendar/ical/a/basic.ics', 'https://evil.com/calendar/ical/a.ics', 'https://calendar.google.com.evil.com/calendar/ical/a', 'https://calendar.google.com/other', 'https://u:p@calendar.google.com/calendar/ical/a', 'not a url'])
      expect(isAllowedIcalUrl(bad)).toBe(false)
  })

  it('읽어서 돌려주고, 다른 주소로 넘기지 않는다', async () => {
    let init: RequestInit | undefined
    expect(await fetchIcal(GOOD, async (_u, i) => ((init = i), new Response(ICS)))).toBe(ICS)
    expect(init?.redirect).toBe('manual')
    await expect(fetchIcal(GOOD, async () => new Response('', { status: 302, headers: { location: 'https://evil.com' } }))).rejects.toMatchObject({ status: 502 })
  })

  it('오류를 알기 쉽게 알려 준다', async () => {
    await expect(fetchIcal('https://evil.com/x', async () => new Response(ICS))).rejects.toMatchObject({ status: 400 })
    await expect(fetchIcal(GOOD, async () => new Response('', { status: 404 }))).rejects.toMatchObject({ status: 404 })
    await expect(fetchIcal(GOOD, async () => new Response('<html>'))).rejects.toMatchObject({ status: 422 })
    await expect(fetchIcal(GOOD, async () => { throw new Error('net') })).rejects.toMatchObject({ status: 502 })
  })
})

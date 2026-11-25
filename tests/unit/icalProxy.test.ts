import { describe, expect, it } from 'vitest'
import { fetchIcal, isAllowedIcalUrl } from '../../src/lib/icalProxy'

const ICS = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR'
const GOOD = 'https://calendar.google.com/calendar/ical/abc%40gmail.com/private-123/basic.ics'
const reply = (body: string, init?: ResponseInit) => async () => new Response(body, init)

describe('웹 구글 캘린더 대신 읽기', () => {
  it('구글 캘린더 https iCal 주소는 받는다', () => {
    expect(isAllowedIcalUrl(GOOD)).toBe(true)
  })

  it.each([
    ['http 주소', 'http://calendar.google.com/calendar/ical/a/basic.ics'],
    ['다른 사이트', 'https://evil.com/calendar/ical/a.ics'],
    ['구글처럼 보이는 다른 도메인', 'https://calendar.google.com.evil.com/calendar/ical/a'],
    ['iCal 이 아닌 구글 주소', 'https://calendar.google.com/other'],
    ['아이디 · 비밀번호가 든 주소', 'https://u:p@calendar.google.com/calendar/ical/a'],
    ['주소가 아닌 글', 'not a url'],
  ])('%s 는 받지 않는다', (_case, url) => {
    expect(isAllowedIcalUrl(url)).toBe(false)
  })

  it('읽은 글을 그대로 돌려주고, 다른 주소로 넘어가지 않게 묻는다', async () => {
    let sentInit: RequestInit | undefined
    const fetchSpy = async (_url: string, init?: RequestInit) => {
      sentInit = init
      return new Response(ICS)
    }

    const text = await fetchIcal(GOOD, fetchSpy)

    expect(text).toBe(ICS)
    expect(sentInit?.redirect).toBe('manual')
  })

  it.each([
    ['다른 주소로 넘기려 하면(302)', GOOD, reply('', { status: 302, headers: { location: 'https://evil.com' } }), 502],
    ['허용하지 않는 주소면', 'https://evil.com/x', reply(ICS), 400],
    ['구글이 404 면', GOOD, reply('', { status: 404 }), 404],
    ['iCal 이 아닌 HTML 이 오면', GOOD, reply('<html>'), 422],
    [
      '연결이 끊기면',
      GOOD,
      async () => {
        throw new Error('net')
      },
      502,
    ],
  ])('%s $3 오류로 알려 준다', async (_case, url, fakeFetch, status) => {
    await expect(fetchIcal(url, fakeFetch)).rejects.toMatchObject({ status })
  })
})

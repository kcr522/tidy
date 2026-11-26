import { describe, expect, it } from 'vitest'
import type { CalendarEvent, EventColor } from '../../src/db/types'
import { buildDevicePush, defaultPicks, isTidyCalendar, memoOf, planDevicePush, planImport, type DeviceCalendar, type DeviceEvent } from '../../src/lib/deviceCal'

/** Tidy 일정 하나 */
const tidyEvent = (id: number, title: string, startDate: string, endDate = startDate, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
/** 폰(삼성) 캘린더 일정 하나 — 기본은 3번 캘린더의 하루 종일 일정 */
const phoneEvent = (key: string, title: string, startDate: string, extra: Partial<DeviceEvent> = {}): DeviceEvent => ({ key, calendarId: '3', title, startDate, endDate: startDate, allDay: true, memo: '', location: '', ...extra })
const phoneCalendar = (id: string, accountType: string, extra: Partial<DeviceCalendar> = {}): DeviceCalendar => ({ id, name: '내 캘린더', account: 'a', accountType, color: '#ff0000', writable: true, visible: true, ...extra })

const DEVICE = 'abc' // 이 폰의 기기 id
const NOW = 'now'
const PICKED: Record<string, EventColor> = { '3': '#ff0000' } // 고른 캘린더 id → 색
const fromThisPhone = (uid: string) => ({ source: 'device' as const, calId: `d:${DEVICE}:3`, uid, color: '#ff0000' as EventColor })

describe('삼성 캘린더 가져오기', () => {
  it('처음에는 Tidy · 구글 · 숨긴 캘린더는 빼고 고른다', () => {
    const samsung = phoneCalendar('1', 'com.osp.app.signin')
    const google = phoneCalendar('2', 'com.google')
    const tidy = phoneCalendar('3', 'LOCAL', { account: 'Tidy', name: 'Tidy' })
    const local = phoneCalendar('4', 'LOCAL')
    const hidden = phoneCalendar('5', 'com.osp.app.signin', { visible: false })

    expect(defaultPicks([samsung, google, tidy, local, hidden])).toEqual(['1', '4'])
  })

  it('구글 계정 안에 있어도 이름이 Tidy 면 Tidy 캘린더로 본다', () => {
    expect(isTidyCalendar({ name: 'Tidy', account: 'me@gmail.com', accountType: 'com.google' })).toBe(true)
  })

  it('시간 · 장소 · 메모를 줄을 나눠 메모 칸에 모은다', () => {
    const timed = { allDay: false, startTime: '15:00', endTime: '16:30', location: '강남역', memo: '책 챙기기' }

    expect(memoOf(timed)).toBe('15:00 ~ 16:30\n📍 강남역\n책 챙기기')
  })

  it('하루 종일 일정에 장소 · 메모가 없으면 메모 칸은 비운다', () => {
    expect(memoOf({ allDay: true, location: '', memo: '' })).toBe('')
  })

  it('새 일정은 넣고, 바뀐 것만 고치고, 폰에서 없어진 것은 지운다 (다른 폰 것은 그대로)', () => {
    const existing = [
      tidyEvent(1, '그대로', '2026-11-20', '2026-11-20', fromThisPhone('k1')),
      tidyEvent(2, '옛 제목', '2026-11-21', '2026-11-21', fromThisPhone('k2')),
      tidyEvent(3, '없어짐', '2026-11-22', '2026-11-22', fromThisPhone('k3')),
      tidyEvent(4, '다른 폰 것', '2026-11-22', '2026-11-22', { source: 'device', calId: 'd:zzz:3', uid: 'k3' }),
    ]
    const onPhone = [phoneEvent('k1', '그대로', '2026-11-20'), phoneEvent('k2', '새 제목', '2026-11-21'), phoneEvent('k4', '새 일정', '2026-11-23')]

    const plan = planImport(existing, onPhone, PICKED, DEVICE, NOW)

    expect(plan.add.map((event) => [event.title, event.source, event.calId, event.uid])).toEqual([['새 일정', 'device', 'd:abc:3', 'k4']])
    expect(plan.update).toEqual([{ id: 2, changes: expect.objectContaining({ title: '새 제목' }) }])
    expect(plan.remove).toEqual([3])
  })

  it('Tidy 일정이나 구글에서 가져온 일정과 같은 날 같은 제목이면 두 번 보이지 않게 건너뛴다', () => {
    const existing = [tidyEvent(1, '치과', '2026-11-20'), tidyEvent(2, '회의', '2026-11-21', '2026-11-21', { source: 'google' })]
    const onPhone = [phoneEvent('a', '치과', '2026-11-20'), phoneEvent('b', ' 회의 ', '2026-11-21'), phoneEvent('c', '치과', '2026-11-25')]

    const plan = planImport(existing, onPhone, { '3': 'blue' }, DEVICE, NOW)

    expect(plan.add.map((event) => event.startDate)).toEqual(['2026-11-25'])
  })

  it('고르지 않은 캘린더 일정은 넣지 않는다', () => {
    const notPicked = phoneEvent('a', '모임', '2026-11-20', { calendarId: '9' })

    const plan = planImport([], [notPicked], { '3': 'blue' }, DEVICE, NOW)

    expect(plan.add).toEqual([])
  })
})

describe('Tidy 일정을 삼성 캘린더에 넣기', () => {
  it('Tidy 에서 만든 일정만 보낸다 (구글 · 폰에서 가져온 일정은 빼고)', () => {
    const trip = tidyEvent(1, '여행', '2026-11-20', '2026-11-22')
    const fromGoogle = tidyEvent(2, '구글 일정', '2026-11-20', '2026-11-20', { source: 'google' })
    const fromPhone = tidyEvent(3, '폰 일정', '2026-11-20', '2026-11-20', { source: 'device' })

    const items = buildDevicePush([trip, fromGoogle, fromPhone])

    expect(items.map((item) => [item.key, item.startDate, item.endDate])).toEqual([['tidy-1', '2026-11-20', '2026-11-22']])
  })

  it('없는 것은 넣고, 바뀐 것은 고치고, 사라졌거나 두 번 들어간 것은 지우고, 사용자가 직접 넣은 일정은 남긴다', () => {
    const want = buildDevicePush([tidyEvent(1, 'a', '2026-11-20'), tidyEvent(2, 'b', '2026-11-21'), tidyEvent(3, 'c', '2026-11-22')])
    const onPhone = [
      { eventId: '10', key: 'tidy-1', hash: want[0].hash }, // 그대로
      { eventId: '11', key: 'tidy-2', hash: 'old' }, // 바뀜
      { eventId: '12', key: 'tidy-9', hash: 'x' }, // Tidy 에서 지움
      { eventId: '13', key: '', hash: '' }, // 사용자가 직접 넣음
      { eventId: '14', key: 'tidy-1', hash: want[0].hash }, // 두 번 들어감
    ]

    const plan = planDevicePush(want, onPhone)

    expect(plan.insert.map((item) => item.key)).toEqual(['tidy-3'])
    expect(plan.update.map((item) => [item.key, item.eventId])).toEqual([['tidy-2', '11']])
    expect(plan.remove.sort()).toEqual(['12', '14'])
  })
})

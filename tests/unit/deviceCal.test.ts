import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '../../src/db/types'
import { buildDevicePush, defaultPicks, isTidyCalendar, memoOf, planDevicePush, planImport, type DeviceCalendar, type DeviceEvent } from '../../src/lib/deviceCal'

const ev = (id: number, title: string, startDate: string, endDate = startDate, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
const dev = (key: string, title: string, startDate: string, extra: Partial<DeviceEvent> = {}): DeviceEvent => ({ key, calendarId: '3', title, startDate, endDate: startDate, allDay: true, memo: '', location: '', ...extra })
const cal = (id: string, accountType: string, extra: Partial<DeviceCalendar> = {}): DeviceCalendar => ({ id, name: '내 캘린더', account: 'a', accountType, color: '#ff0000', writable: true, visible: true, ...extra })

describe('삼성 캘린더 가져오기', () => {
  it('처음에는 Tidy · 구글 · 숨긴 캘린더는 빼고 고른다', () => {
    const list = [cal('1', 'com.osp.app.signin'), cal('2', 'com.google'), cal('3', 'LOCAL', { account: 'Tidy', name: 'Tidy' }), cal('4', 'LOCAL'), cal('5', 'com.osp.app.signin', { visible: false })]
    expect(defaultPicks(list)).toEqual(['1', '4'])
    expect(isTidyCalendar({ name: 'Tidy', account: 'me@gmail.com', accountType: 'com.google' })).toBe(true)
  })

  it('시간 · 장소 · 메모를 메모 칸에 모은다', () => {
    expect(memoOf({ allDay: false, startTime: '15:00', endTime: '16:30', location: '강남역', memo: '책 챙기기' })).toBe('15:00 ~ 16:30\n📍 강남역\n책 챙기기')
    expect(memoOf({ allDay: true, location: '', memo: '' })).toBe('')
  })

  it('새 것은 넣고, 바뀐 것만 고치고, 없어진 것은 지운다', () => {
    const existing = [
      ev(1, '그대로', '2026-11-20', '2026-11-20', { source: 'device', calId: 'd:abc:3', uid: 'k1', color: '#ff0000' }),
      ev(2, '옛 제목', '2026-11-21', '2026-11-21', { source: 'device', calId: 'd:abc:3', uid: 'k2', color: '#ff0000' }),
      ev(3, '없어짐', '2026-11-22', '2026-11-22', { source: 'device', calId: 'd:abc:3', uid: 'k3', color: '#ff0000' }),
      ev(4, '다른 폰 것', '2026-11-22', '2026-11-22', { source: 'device', calId: 'd:zzz:3', uid: 'k3' }),
    ]
    const plan = planImport(existing, [dev('k1', '그대로', '2026-11-20'), dev('k2', '새 제목', '2026-11-21'), dev('k4', '새 일정', '2026-11-23')], { '3': '#ff0000' }, 'abc', 'now')
    expect(plan.add.map((e) => [e.title, e.source, e.calId, e.uid])).toEqual([['새 일정', 'device', 'd:abc:3', 'k4']])
    expect(plan.update).toEqual([{ id: 2, changes: expect.objectContaining({ title: '새 제목' }) }])
    expect(plan.remove).toEqual([3])
  })

  it('Tidy 일정이나 구글에서 가져온 일정과 같으면 두 번 보이지 않게 건너뛴다', () => {
    const existing = [ev(1, '치과', '2026-11-20'), ev(2, '회의', '2026-11-21', '2026-11-21', { source: 'google' })]
    const plan = planImport(existing, [dev('a', '치과', '2026-11-20'), dev('b', ' 회의 ', '2026-11-21'), dev('c', '치과', '2026-11-25')], { '3': 'blue' }, 'abc', 'now')
    expect(plan.add.map((e) => e.startDate)).toEqual(['2026-11-25'])
  })

  it('고르지 않은 캘린더 일정은 넣지 않는다', () => {
    const plan = planImport([], [dev('a', 'x', '2026-11-20', { calendarId: '9' })], { '3': 'blue' }, 'abc', 'now')
    expect(plan.add).toEqual([])
  })
})

describe('Tidy 일정을 삼성 캘린더에 넣기', () => {
  it('Tidy 에서 만든 일정만 보낸다 (가져온 일정은 빼고)', () => {
    const items = buildDevicePush([ev(1, '여행', '2026-11-20', '2026-11-22'), ev(2, 'g', '2026-11-20', '2026-11-20', { source: 'google' }), ev(3, 'd', '2026-11-20', '2026-11-20', { source: 'device' })])
    expect(items.map((i) => [i.key, i.startDate, i.endDate])).toEqual([['tidy-1', '2026-11-20', '2026-11-22']])
  })

  it('넣기 · 고치기 · 지우기를 정하고, 사용자가 직접 넣은 일정은 남긴다', () => {
    const want = buildDevicePush([ev(1, 'a', '2026-11-20'), ev(2, 'b', '2026-11-21'), ev(3, 'c', '2026-11-22')])
    const remote = [
      { eventId: '10', key: 'tidy-1', hash: want[0].hash },
      { eventId: '11', key: 'tidy-2', hash: 'old' },
      { eventId: '12', key: 'tidy-9', hash: 'x' },
      { eventId: '13', key: '', hash: '' },
      { eventId: '14', key: 'tidy-1', hash: want[0].hash },
    ]
    const plan = planDevicePush(want, remote)
    expect(plan.insert.map((i) => i.key)).toEqual(['tidy-3'])
    expect(plan.update.map((i) => [i.key, i.eventId])).toEqual([['tidy-2', '11']])
    expect(plan.remove.sort()).toEqual(['12', '14'])
  })
})

import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Todo } from '../../src/db/types'
import { buildPushItems, eventGoogleId, isTidyGoogleId, planPush, todoGoogleId } from '../../src/lib/gcalPush'

const ev = (id: number, title: string, startDate: string, endDate = startDate, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
const todo = (id: number, title: string, dueDate: string | null, extra: Partial<Todo> = {}): Todo => ({ id, title, isCompleted: 0, completedAt: null, dueDate, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...extra })
const opts = { todos: true, timeZone: 'Asia/Seoul' }

describe('구글로 보낼 일정 만들기', () => {
  it('구글 id 는 base32hex 이고 Tidy 것만 알아본다', () => {
    expect(eventGoogleId(7)).toBe('tde0007')
    expect(todoGoogleId(12345)).toBe('tdt12345')
    for (const id of [eventGoogleId(7), todoGoogleId(12345)]) expect(id).toMatch(/^[0-9a-v]{5,}$/)
    expect(isTidyGoogleId('tde0007')).toBe(true)
    expect(isTidyGoogleId('abc123googleid')).toBe(false)
  })

  it('일정은 하루 종일, 끝 날짜는 다음 날 (구글 규칙). 구글에서 가져온 일정은 빼요', () => {
    const items = buildPushItems([ev(1, '여행', '2026-11-20', '2026-11-22', { memo: '제주' }), ev(2, '구글 일정', '2026-11-12', '2026-11-12', { source: 'google' })], [], opts)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ id: 'tde0001', body: { summary: '여행', description: '제주', start: { date: '2026-11-20' }, end: { date: '2026-11-23' } } })
  })

  it('끝내지 않은 마감일 있는 할 일만, 알림 시각이 있으면 그 시각에 30분', () => {
    const items = buildPushItems([], [todo(1, '보고서', '2026-11-12', { remindAt: '14:00' }), todo(2, '장보기', '2026-11-13'), todo(3, '끝냄', '2026-11-12', { isCompleted: 1 }), todo(4, '언젠가', null)], opts)
    expect(items.map((i) => i.id)).toEqual(['tdt0001', 'tdt0002'])
    expect(items[0].body).toMatchObject({ summary: '☐ 보고서', start: { dateTime: '2026-11-12T14:00:00', timeZone: 'Asia/Seoul' }, end: { dateTime: '2026-11-12T14:30:00' } })
    expect(items[1].body).toMatchObject({ start: { date: '2026-11-13' }, end: { date: '2026-11-14' } })
    expect(buildPushItems([], [todo(1, '보고서', '2026-11-12')], { ...opts, todos: false })).toEqual([])
  })

  it('밤 11시 50분 할 일은 다음 날로 넘어가게 끝난다', () => {
    const [item] = buildPushItems([], [todo(1, '마감', '2026-11-30', { remindAt: '23:50' })], opts)
    expect(item.body.end).toEqual({ dateTime: '2026-12-01T00:20:00', timeZone: 'Asia/Seoul' })
  })

  it('새로 넣을 것, 바뀐 것, 지울 것을 고른다 (구글에서 직접 넣은 일정은 그대로)', () => {
    const want = buildPushItems([ev(1, 'A', '2026-11-12'), ev(2, 'B', '2026-11-13'), ev(3, 'C', '2026-11-14')], [], opts)
    const plan = planPush(want, [
      { id: 'tde0001', hash: want[0].hash },
      { id: 'tde0002', hash: 'old' },
      { id: 'tde0009', hash: 'x' },
      { id: 'mygoogleevent', hash: undefined },
    ])
    expect(plan.insert.map((i) => i.id)).toEqual(['tde0003'])
    expect(plan.update.map((i) => i.id)).toEqual(['tde0002'])
    expect(plan.remove).toEqual(['tde0009'])
  })
})

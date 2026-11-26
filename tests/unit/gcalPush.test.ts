import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Todo } from '../../src/db/types'
import { buildPushItems, eventGoogleId, isTidyGoogleId, planPush, todoGoogleId } from '../../src/lib/gcalPush'

const event = (id: number, title: string, startDate: string, endDate = startDate, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id, title, startDate, endDate, color: 'pink', memo: '', createdAt: '', updatedAt: '', ...extra })
const todo = (id: number, title: string, dueDate: string | null, extra: Partial<Todo> = {}): Todo => ({ id, title, isCompleted: 0, completedAt: null, dueDate, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...extra })
const SEOUL = 'Asia/Seoul'
const withTodos = { todos: true, timeZone: SEOUL }
const noTodos = { todos: false, timeZone: SEOUL }
const BASE32HEX = /^[0-9a-v]{5,}$/ // 구글 일정 id 규칙

describe('구글로 보낼 일정 만들기', () => {
  it.each([
    ['일정 7', eventGoogleId(7), 'tde0007'],
    ['할 일 12345', todoGoogleId(12345), 'tdt12345'],
  ])('%s 의 구글 id 는 %s 이고 base32hex 글자만 쓴다', (_case, id, expected) => {
    expect(id).toBe(expected)
    expect(id).toMatch(BASE32HEX)
  })

  it.each([
    ['tde0007', true],
    ['abc123googleid', false],
  ])('구글 id %s 가 Tidy 가 만든 것인가: %s', (id, isTidy) => {
    expect(isTidyGoogleId(id)).toBe(isTidy)
  })

  it('일정은 하루 종일로, 끝 날짜는 다음 날로 보낸다 (구글 규칙)', () => {
    const trip = event(1, '여행', '2026-11-20', '2026-11-22', { memo: '제주' })

    const [item] = buildPushItems([trip], [], withTodos)

    expect(item).toMatchObject({ id: 'tde0001', body: { summary: '여행', description: '제주', start: { date: '2026-11-20' }, end: { date: '2026-11-23' } } })
  })

  it('구글에서 가져온 일정은 다시 보내지 않는다', () => {
    const fromGoogle = event(2, '구글 일정', '2026-11-12', '2026-11-12', { source: 'google' })

    expect(buildPushItems([fromGoogle], [], withTodos)).toEqual([])
  })

  it('끝내지 않았고 마감일 있는 할 일만 보낸다', () => {
    const todos = [todo(1, '보고서', '2026-11-12'), todo(2, '장보기', '2026-11-13'), todo(3, '끝냄', '2026-11-12', { isCompleted: 1 }), todo(4, '언젠가', null)]

    const items = buildPushItems([], todos, withTodos)

    expect(items.map((item) => item.id)).toEqual(['tdt0001', 'tdt0002'])
  })

  it('알림 시각이 있는 할 일은 그 시각부터 30분짜리 일정으로 보낸다', () => {
    const [item] = buildPushItems([], [todo(1, '보고서', '2026-11-12', { remindAt: '14:00' })], withTodos)

    expect(item.body).toMatchObject({ summary: '☐ 보고서', start: { dateTime: '2026-11-12T14:00:00', timeZone: SEOUL }, end: { dateTime: '2026-11-12T14:30:00' } })
  })

  it('알림 시각이 없는 할 일은 마감일 하루 종일 일정으로 보낸다', () => {
    const [item] = buildPushItems([], [todo(2, '장보기', '2026-11-13')], withTodos)

    expect(item.body).toMatchObject({ start: { date: '2026-11-13' }, end: { date: '2026-11-14' } })
  })

  it('할 일 보내기를 끄면 할 일은 보내지 않는다', () => {
    expect(buildPushItems([], [todo(1, '보고서', '2026-11-12')], noTodos)).toEqual([])
  })

  it('밤 11시 50분 할 일은 30분 뒤인 다음 날 0시 20분에 끝난다', () => {
    const [item] = buildPushItems([], [todo(1, '마감', '2026-11-30', { remindAt: '23:50' })], withTodos)

    expect(item.body.end).toEqual({ dateTime: '2026-12-01T00:20:00', timeZone: SEOUL })
  })

  it('새로 넣을 것, 바뀐 것, 지울 것을 고르고, 구글에서 직접 넣은 일정은 그대로 둔다', () => {
    const want = buildPushItems([event(1, 'A', '2026-11-12'), event(2, 'B', '2026-11-13'), event(3, 'C', '2026-11-14')], [], withTodos)
    const inGoogle = [
      { id: 'tde0001', hash: want[0].hash }, // 그대로
      { id: 'tde0002', hash: 'old' }, // 바뀜
      { id: 'tde0009', hash: 'x' }, // Tidy 에서 지움
      { id: 'mygoogleevent', hash: undefined }, // 구글에서 직접 넣음
    ]

    const plan = planPush(want, inGoogle)

    expect(plan.insert.map((item) => item.id)).toEqual(['tde0003'])
    expect(plan.update.map((item) => item.id)).toEqual(['tde0002'])
    expect(plan.remove).toEqual(['tde0009'])
  })
})

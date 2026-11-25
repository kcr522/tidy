import { describe, expect, it } from 'vitest'
import type { Todo } from '../../src/db/types'
import { missedTodayAlarms, timeLabel, todoAlarmAt, upcomingTodoAlarms } from '../../src/lib/todoAlarms'

const NOT_DONE = 0 as const
const DONE = 1 as const
const TODAY = '2026-11-10'
const NOW = new Date(2026, 10, 10, 14, 0) // 11월 10일 오후 2시

let seq = 0
/** 오늘 마감인 안 끝낸 할 일 하나에서 필요한 칸만 바꾼다 */
const okTodo = (over: Partial<Todo>): Todo => ({ id: ++seq, title: `일 ${seq}`, isCompleted: NOT_DONE, completedAt: null, dueDate: TODAY, priority: 'MEDIUM', createdAt: '', updatedAt: '', ...over })

describe('할 일 알림', () => {
  it('마감일 + 알림 시각에 울린다', () => {
    expect(todoAlarmAt(okTodo({ remindAt: '18:30' }))).toEqual(new Date(2026, 10, 10, 18, 30))
  })

  it.each([
    ['끝낸 일', { remindAt: '18:30', isCompleted: DONE }],
    ['알림 시각이 없는 일', {}],
    ['마감일이 없는 일', { dueDate: null, remindAt: '09:00' }],
    ['있을 수 없는 시각(25시)', { remindAt: '25:00' }],
  ] as [string, Partial<Todo>][])('%s 은 울리지 않는다', (_case, over) => {
    expect(todoAlarmAt(okTodo(over))).toBeNull()
  })

  it('앞으로 울릴 알림만 가까운 순으로 놓고 지난 것은 뺀다', () => {
    const tomorrow = okTodo({ dueDate: '2026-11-11', remindAt: '09:00' })
    const soon = okTodo({ remindAt: '18:00' })
    const past = okTodo({ remindAt: '09:00' })

    const list = upcomingTodoAlarms([tomorrow, past, soon], NOW)

    expect(list.map((alarm) => alarm.todo)).toEqual([soon, tomorrow])
  })

  it('앞으로 울릴 알림은 정한 개수(1개)까지만 낸다', () => {
    const LIMIT = 1
    const tomorrow = okTodo({ dueDate: '2026-11-11', remindAt: '09:00' })
    const soon = okTodo({ remindAt: '18:00' })

    expect(upcomingTodoAlarms([tomorrow, soon], NOW, LIMIT).map((alarm) => alarm.todo)).toEqual([soon])
  })

  it('늦게 열면 오늘 지난 알림 중 안 끝낸 것만 알려 준다 (어제 것 · 아직 안 온 것은 빼고)', () => {
    const missed = okTodo({ remindAt: '09:00' })
    const yesterday = okTodo({ dueDate: '2026-11-09', remindAt: '09:00' })
    const done = okTodo({ remindAt: '10:00', isCompleted: DONE })
    const tonight = okTodo({ remindAt: '20:00' })

    expect(missedTodayAlarms([missed, yesterday, done, tonight], NOW)).toEqual([missed])
  })

  it.each([
    ['09:05', '오전 9:05'],
    ['12:00', '오후 12:00'],
    ['00:30', '오전 12:30'],
    ['21:00', '오후 9:00'],
  ])('알림 시각 %s 은 "%s" 로 보여 준다', (time, label) => {
    expect(timeLabel(time)).toBe(label)
  })
})

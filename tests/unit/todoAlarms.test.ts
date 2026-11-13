import { describe, expect, it } from 'vitest'
import type { Todo } from '../../src/db/types'
import { missedTodayAlarms, timeLabel, todoAlarmAt, upcomingTodoAlarms } from '../../src/lib/todoAlarms'

let seq = 0
const todo = (p: Partial<Todo>): Todo => ({ id: ++seq, title: `일 ${seq}`, isCompleted: 0, completedAt: null, dueDate: '2026-11-10', priority: 'MEDIUM', createdAt: '', updatedAt: '', ...p })
const NOW = new Date(2026, 10, 10, 14, 0) // 11월 10일 오후 2시

describe('할 일 알림', () => {
  it('마감일 + 알림 시각에 울리고, 끝낸 일·시각 없는 일·날짜 없는 일은 안 울린다', () => {
    expect(todoAlarmAt(todo({ remindAt: '18:30' }))).toEqual(new Date(2026, 10, 10, 18, 30))
    expect(todoAlarmAt(todo({ remindAt: '18:30', isCompleted: 1 }))).toBeNull()
    expect(todoAlarmAt(todo({}))).toBeNull()
    expect(todoAlarmAt(todo({ dueDate: null, remindAt: '09:00' }))).toBeNull()
    expect(todoAlarmAt(todo({ remindAt: '25:00' }))).toBeNull()
  })

  it('앞으로 울릴 알림만 가까운 순으로 (지난 것은 빼고, 개수 제한)', () => {
    const later = todo({ dueDate: '2026-11-11', remindAt: '09:00' })
    const soon = todo({ remindAt: '18:00' })
    const past = todo({ remindAt: '09:00' })
    const list = upcomingTodoAlarms([later, past, soon], NOW)
    expect(list.map((x) => x.todo)).toEqual([soon, later])
    expect(upcomingTodoAlarms([later, soon], NOW, 1).map((x) => x.todo)).toEqual([soon])
  })

  it('늦게 열면 오늘 지난 알림 중 안 끝낸 것만 알려 준다 (어제 것은 빼고)', () => {
    const missed = todo({ remindAt: '09:00' })
    const yesterday = todo({ dueDate: '2026-11-09', remindAt: '09:00' })
    const done = todo({ remindAt: '10:00', isCompleted: 1 })
    expect(missedTodayAlarms([missed, yesterday, done, todo({ remindAt: '20:00' })], NOW)).toEqual([missed])
  })

  it('시간 표시', () => {
    expect(timeLabel('09:05')).toBe('오전 9:05')
    expect(timeLabel('12:00')).toBe('오후 12:00')
    expect(timeLabel('00:30')).toBe('오전 12:30')
    expect(timeLabel('21:00')).toBe('오후 9:00')
  })
})

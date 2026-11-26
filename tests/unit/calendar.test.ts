import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { dayMarks, dayTitle, expenseOn, monthGrid, shiftMonth, todosOn } from '../../src/lib/calendar'

const okTodo = (over: Partial<Todo>): Todo => ({
  title: '장보기', isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
})
const DONE = 1 as const
const WEEK = 7

describe('calendar', () => {
  it('2026년 11월 달력은 일요일 11/1부터 토요일 12/5까지 35칸이다', () => {
    const grid = monthGrid('2026-11')

    expect(grid.length).toBe(35)
    expect(grid[0]).toBe('2026-11-01')
    expect(grid.at(-1)).toBe('2026-12-05')
  })

  it('1일이 일요일이 아닌 달은 앞달 날짜로 시작하고 칸 수는 7의 배수다', () => {
    const grid = monthGrid('2026-12')

    expect(grid[0]).toBe('2026-11-29')
    expect(grid.length % WEEK).toBe(0)
  })

  it.each([
    ['2026-12', 1, '2027-01'],
    ['2026-01', -1, '2025-12'],
  ])('%s 에서 %i 달 옮기면 해를 넘겨 %s 이 된다', (month, step, shifted) => {
    expect(shiftMonth(month, step)).toBe(shifted)
  })

  it('날짜 점은 남은 할 일이면 open, 모두 끝냈으면 done, 지난 날 남은 할 일이면 overdue 이고 마감일 없는 할 일은 빠진다', () => {
    const todos = [
      okTodo({ dueDate: '2026-11-15' }),
      okTodo({ dueDate: '2026-11-15', isCompleted: DONE }),
      okTodo({ dueDate: '2026-11-12', isCompleted: DONE }),
      okTodo({ dueDate: '2026-11-03' }),
      okTodo({ dueDate: null }),
    ]

    const marks = dayMarks(todos, '2026-11-10')

    expect(marks.get('2026-11-15')).toEqual({ mark: 'open', total: 2, open: 1 })
    expect(marks.get('2026-11-12')?.mark).toBe('done')
    expect(marks.get('2026-11-03')?.mark).toBe('overdue')
    expect(marks.size).toBe(3)
  })

  it('그날 할 일만 고르고 끝내지 않은 것을 먼저 놓는다', () => {
    const todos = [okTodo({ title: '끝낸 일', dueDate: '2026-11-15', isCompleted: DONE }), okTodo({ title: '남은 일', dueDate: '2026-11-15' }), okTodo({ title: '다음 날 일', dueDate: '2026-11-16' })]

    const list = todosOn(todos, '2026-11-15')

    expect(list.map((todo) => todo.title)).toEqual(['남은 일', '끝낸 일'])
  })

  it('그날 지출 합계는 수입과 다른 날을 빼고 센다', () => {
    const row = (type: 'INCOME' | 'EXPENSE', amount: number, date: string) => ({ type, amount, date, category: '', memo: '', createdAt: '', updatedAt: '' }) as Transaction
    const rows = [row('EXPENSE', 6500, '2026-11-15'), row('INCOME', 1000, '2026-11-15'), row('EXPENSE', 3000, '2026-11-14')]

    expect(expenseOn(rows, '2026-11-15')).toBe(6500)
  })

  it('날짜 제목은 "11월 15일 (일)" 처럼 요일을 붙인다', () => {
    expect(dayTitle('2026-11-15')).toBe('11월 15일 (일)')
  })
})

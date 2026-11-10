import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { dayMarks, dayTitle, expenseOn, monthGrid, shiftMonth, todosOn } from '../../src/lib/calendar'

const todo = (over: Partial<Todo>): Todo => ({
  title: 't', isCompleted: 0, completedAt: null, dueDate: null, priority: 'MEDIUM',
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
})

describe('calendar', () => {
  it('2026년 11월 달력은 일요일 11/1부터 토요일 12/5까지 35칸', () => {
    const g = monthGrid('2026-11')
    expect(g.length).toBe(35)
    expect(g[0]).toBe('2026-11-01')
    expect(g.at(-1)).toBe('2026-12-05')
  })

  it('앞달 날짜로 시작하는 달도 7의 배수', () => {
    const g = monthGrid('2026-12')
    expect(g[0]).toBe('2026-11-29')
    expect(g.length % 7).toBe(0)
  })

  it('달 이동은 해를 넘긴다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('점 표시: 미완료, 모두 완료, 지난 미완료', () => {
    const m = dayMarks(
      [
        todo({ dueDate: '2026-11-15' }),
        todo({ dueDate: '2026-11-15', isCompleted: 1 }),
        todo({ dueDate: '2026-11-12', isCompleted: 1 }),
        todo({ dueDate: '2026-11-03' }),
        todo({ dueDate: null }),
      ],
      '2026-11-10',
    )
    expect(m.get('2026-11-15')).toEqual({ mark: 'open', total: 2, open: 1 })
    expect(m.get('2026-11-12')?.mark).toBe('done')
    expect(m.get('2026-11-03')?.mark).toBe('overdue')
    expect(m.size).toBe(3)
  })

  it('그날 할 일은 미완료가 먼저', () => {
    const list = todosOn(
      [todo({ title: 'a', dueDate: '2026-11-15', isCompleted: 1 }), todo({ title: 'b', dueDate: '2026-11-15' }), todo({ title: 'c', dueDate: '2026-11-16' })],
      '2026-11-15',
    )
    expect(list.map((t) => t.title)).toEqual(['b', 'a'])
  })

  it('그날 지출 합계와 제목', () => {
    const tx = (type: 'INCOME' | 'EXPENSE', amount: number, date: string) =>
      ({ type, amount, date, category: '', memo: '', createdAt: '', updatedAt: '' }) as Transaction
    expect(expenseOn([tx('EXPENSE', 6500, '2026-11-15'), tx('INCOME', 1000, '2026-11-15'), tx('EXPENSE', 3000, '2026-11-14')], '2026-11-15')).toBe(6500)
    expect(dayTitle('2026-11-15')).toBe('11월 15일 (일)')
  })
})

import { describe, expect, it } from 'vitest'
import type { Todo, Transaction } from '../../src/db/types'
import { buildWidgetSummary, widgetRange, widgetView, WIDGET_DAYS } from '../../src/lib/widgetSummary'

const todo = (title: string, dueDate: string | null, done = false): Todo => ({
  title,
  dueDate,
  isCompleted: done ? 1 : 0,
  completedAt: null,
  priority: 'MEDIUM',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
})
const tx = (date: string, amount: number, type: Transaction['type'] = 'EXPENSE'): Transaction => ({
  type,
  amount,
  date,
  category: '식비',
  memo: '',
  createdAt: '',
  updatedAt: '',
})

const todos = [todo('장보기', '2026-11-10'), todo('운동', '2026-11-10', true), todo('밀린 일', '2026-11-08'), todo('내일 일', '2026-11-11'), todo('날짜 없음', null)]
const txs = [tx('2026-11-01', 10000), tx('2026-11-10', 12300), tx('2026-11-10', 500000, 'INCOME'), tx('2026-11-12', 7000)]

describe('buildWidgetSummary', () => {
  const s = buildWidgetSummary(todos, txs, '2026-11-10', false)

  it('오늘부터 7일 칸을 만든다', () => {
    expect(Object.keys(s.days)).toHaveLength(WIDGET_DAYS)
    expect(Object.keys(s.days)[0]).toBe('2026-11-10')
    expect(Object.keys(s.days)[6]).toBe('2026-11-16')
  })

  it('오늘 할 일 = 오늘 마감 + 지난 미완료, 못 끝낸 것이 먼저', () => {
    const d = s.days['2026-11-10']
    expect(d.total).toBe(3)
    expect(d.done).toBe(1)
    expect(d.items.map((i) => i.t)).toEqual(['밀린 일', '장보기', '운동'])
  })

  it('다음 날에는 그 전에 못 끝낸 할 일도 함께 센다', () => {
    expect(s.days['2026-11-11'].items.map((i) => i.t)).toEqual(['밀린 일', '장보기', '내일 일'])
  })

  it('지출만 더한다 (날짜별, 달별)', () => {
    expect(s.days['2026-11-10'].spend).toBe(12300)
    expect(s.days['2026-11-12'].spend).toBe(7000)
    expect(s.months['2026-11']).toBe(29300)
  })

  it('잠금 중이면 제목과 금액을 넣지 않는다', () => {
    const l = buildWidgetSummary(todos, txs, '2026-11-10', true)
    expect(l.days['2026-11-10']).toEqual({ done: 1, total: 3, items: [], spend: null })
    expect(l.months).toEqual({})
    expect(JSON.stringify(l)).not.toContain('장보기')
  })

  it('달이 넘어가는 주에는 다음 달 합계도 0부터 둔다', () => {
    const e = buildWidgetSummary([], [], '2026-11-28', false)
    expect(e.months).toEqual({ '2026-11': 0, '2026-12': 0 })
  })
})

describe('widgetRange', () => {
  it('이번 달 1일부터 7일 뒤까지', () => {
    expect(widgetRange('2026-11-28')).toEqual(['2026-11-01', '2026-12-05'])
  })
})

describe('widgetView', () => {
  const s = buildWidgetSummary(todos, txs, '2026-11-10', false)

  it('오늘 칸을 보여 준다', () => {
    const v = widgetView(s, '2026-11-10')
    expect(v.dateLabel).toBe('11월 10일 화요일')
    expect(v).toMatchObject({ stale: false, done: 1, total: 3, more: 0, money: '오늘 지출 12,300원 · 11월 29,300원' })
  })

  it('앱을 안 열고 날이 바뀌어도 그날 칸을 고른다', () => {
    expect(widgetView(s, '2026-11-12').money).toBe('오늘 지출 7,000원 · 11월 29,300원')
  })

  it('7일이 지나면 앱을 열어 달라고 한다', () => {
    expect(widgetView(s, '2026-11-20').stale).toBe(true)
    expect(widgetView(null, '2026-11-20').stale).toBe(true)
  })

  it('잠금 중이면 금액을 숨긴다', () => {
    const v = widgetView(buildWidgetSummary(todos, txs, '2026-11-10', true), '2026-11-10')
    expect(v).toMatchObject({ locked: true, money: null, items: [], total: 3 })
  })
})

import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Habit, Todo, Transaction } from '../../src/db/types'
import { buildWidgetSummary, calendarWidgetView, eventWidgetView, habitWidgetView, moneyWidgetView, todoWidgetView, widgetRange, widgetView, WIDGET_DAYS } from '../../src/lib/widgetSummary'

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
    expect(l.days['2026-11-10']).toMatchObject({ done: 1, total: 3, items: [], spend: null, ev: [] })
    expect(l.months).toEqual({})
    expect(JSON.stringify(l)).not.toContain('장보기')
  })

  it('달이 넘어가는 주에는 다음 달 합계도 0부터 둔다', () => {
    const e = buildWidgetSummary([], [], '2026-11-28', false)
    expect(e.months).toEqual({ '2026-11': 0, '2026-12': 0 })
  })
})

describe('widgetRange', () => {
  it('이번 달 1일부터 다다음 달 1일 전까지 (달력 위젯이 다음 달까지 쓴다)', () => {
    expect(widgetRange('2026-11-28')).toEqual(['2026-11-01', '2027-01-01'])
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

const ev = (title: string, startDate: string, endDate = startDate): CalendarEvent => ({ title, startDate, endDate, color: 'sky', memo: '', createdAt: '', updatedAt: '' })
const habit = (id: number, title: string, emoji: string, order: number, schedule?: Habit['schedule']): Habit => ({ id, title, emoji, order, schedule, createdAt: '', updatedAt: '' })

describe('위젯 여러 종류', () => {
  const many = Array.from({ length: 10 }, (_, i) => todo(`일 ${i + 1}`, '2026-11-10'))
  const extras = {
    events: [ev('여행', '2026-11-09', '2026-11-11'), ev('치과', '2026-11-12'), ev('회의', '2026-11-10')],
    habits: [habit(1, '물 마시기', '💧', 1), habit(2, '적금 넣기', '💰', 2, { freq: 'weekly' as const, weekday: 3 })],
    checks: [{ habitId: 1, date: '2026-11-10', createdAt: '' }],
    budgets: [{ category: '', amount: 20000, updatedAt: '' }, { category: '식비', amount: 5000, updatedAt: '' }],
    opacity: { today: 100, todo: 40, money: 0, event: 75, habit: 100, calendar: 50 },
  }
  const s = buildWidgetSummary(many, txs, '2026-11-10', false, extras)

  it("'오늘' 위젯은 4개만, '할 일' 위젯은 8개까지", () => {
    expect(widgetView(s, '2026-11-10')).toMatchObject({ more: 6 })
    expect(widgetView(s, '2026-11-10').items).toHaveLength(4)
    expect(todoWidgetView(s, '2026-11-10')).toMatchObject({ total: 10, more: 2 })
    expect(todoWidgetView(s, '2026-11-10').items).toHaveLength(8)
  })

  it('가계부: 이번 달 지출과 남은 예산 (전체 예산만 쓴다)', () => {
    expect(moneyWidgetView(s, '2026-11-10')).toMatchObject({ monthLabel: '11월', today: 12300, month: 29300, budget: 20000, left: -9300, pct: 100 })
    expect(moneyWidgetView(buildWidgetSummary([], txs, '2026-11-10', false), '2026-11-10').budget).toBeNull()
  })

  it('일정: 여러 날 일정은 오늘(또는 첫날)에만, 날짜 순으로', () => {
    const v = eventWidgetView(s, '2026-11-10')
    expect(v.todayCount).toBe(2)
    expect(v.rows.map((r) => `${r.label} ${r.t}`)).toEqual(['오늘 여행', '오늘 회의', '11/12 목 치과'])
    expect(eventWidgetView(s, '2026-11-11').rows.map((r) => `${r.label} ${r.t}`)).toEqual(['오늘 여행', '내일 치과'])
  })

  it('습관: 그날 할 습관만, 체크한 것', () => {
    expect(habitWidgetView(s, '2026-11-10')).toMatchObject({ done: 1, total: 1 })
    expect(habitWidgetView(s, '2026-11-11')).toMatchObject({ done: 0, total: 2 })
  })

  it('투명도를 함께 싣는다 (없으면 모두 100)', () => {
    expect(s.opacity).toEqual(extras.opacity)
    expect(buildWidgetSummary([], [], '2026-11-10', false).opacity).toEqual({ today: 100, todo: 100, money: 100, event: 100, habit: 100, calendar: 100, memo: 100 })
  })

  it('잠금 중이면 일정 제목, 습관 제목, 예산을 넣지 않는다', () => {
    const l = buildWidgetSummary(many, txs, '2026-11-10', true, extras)
    expect(l.budget).toBeNull()
    expect(JSON.stringify(l)).not.toContain('여행')
    expect(JSON.stringify(l)).not.toContain('물 마시기')
    expect(eventWidgetView(l, '2026-11-10')).toMatchObject({ locked: true, todayCount: 2, rows: [] })
  })
})

describe('달력 위젯', () => {
  const extras = {
    events: [ev('여행', '2026-11-09', '2026-11-11'), ev('회의', '2026-11-10'), ev('송년회', '2026-12-20')],
    diaries: [{ date: '2026-11-03', color: '#ffb3c7' }, { date: '2026-12-01', color: '#9fd8ff' }],
  }
  const s = buildWidgetSummary([], txs, '2026-11-10', false, extras)

  it('이번 달과 다음 달을 담는다', () => {
    expect(Object.keys(s.cal)).toEqual(['2026-11', '2026-12'])
    expect(s.cal['2026-11'].s).toEqual({ '1': 10000, '10': 12300, '12': 7000 })
    expect(s.cal['2026-11'].e['10']).toEqual(['여행', 2])
    expect(s.cal['2026-12'].e['20']).toEqual(['송년회', 1])
    expect(s.cal['2026-11'].d).toEqual({ '3': '#ffb3c7' })
    expect(s.cal['2026-12'].h).toContain(25)
  })

  it('돈 · 일기 · 일정 모드마다 칸 글자가 바뀐다', () => {
    const cell = (mode: 'money' | 'diary' | 'event', day: number) => calendarWidgetView(s, '2026-11-10', mode).weeks.flat().find((c) => c?.day === day)
    expect(cell('money', 10)?.text).toBe('1.2만')
    expect(cell('event', 10)?.text).toBe('여행 +1')
    expect(cell('diary', 3)?.dot).toBe('#ffb3c7')
    expect(cell('money', 10)?.today).toBe(true)
    expect(calendarWidgetView(s, '2026-11-10', 'money').sum).toBe('지출 2.9만원')
  })

  it('2026년 11월은 일요일에 시작해 5주', () => {
    const v = calendarWidgetView(s, '2026-11-10', 'money')
    expect(v.weeks).toHaveLength(5)
    expect(v.weeks[0][0]?.day).toBe(1)
  })

  it('앱을 안 열어도 다음 달까지 보이고, 잠금 중이면 숨긴다', () => {
    expect(calendarWidgetView(s, '2026-12-01', 'diary').stale).toBe(false)
    expect(calendarWidgetView(s, '2027-01-01', 'diary').stale).toBe(true)
    const l = buildWidgetSummary([], txs, '2026-11-10', true, extras)
    expect(JSON.stringify(l.cal)).not.toContain('여행')
    expect(calendarWidgetView(l, '2026-11-10', 'money').weeks.flat().every((c) => !c || c.text === '')).toBe(true)
  })
})

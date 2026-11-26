import { describe, expect, it } from 'vitest'
import type { CalendarEvent, Habit, Todo, Transaction } from '../../src/db/types'
import { buildWidgetSummary, calendarSizeOf, calendarWidgetView, eventLines, eventWidgetView, habitWidgetView, moneyWidgetView, todoWidgetView, widgetRange, widgetView, WIDGET_DAYS } from '../../src/lib/widgetSummary'

const TODAY = '2026-11-10'
const UNLOCKED = false
const LOCKED = true
const DONE = true

/** 정상 할 일 · 지출 하나 */
const okTodo = (title: string, dueDate: string | null, done = false): Todo => ({
  title,
  dueDate,
  isCompleted: done ? 1 : 0,
  completedAt: null,
  priority: 'MEDIUM',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
})
const okTx = (date: string, amount: number, type: Transaction['type'] = 'EXPENSE'): Transaction => ({
  type, amount, date, category: '식비', memo: '', createdAt: '', updatedAt: '',
})
const okEvent = (title: string, startDate: string, endDate = startDate): CalendarEvent => ({ title, startDate, endDate, color: 'sky', memo: '', createdAt: '', updatedAt: '' })
const okHabit = (id: number, title: string, emoji: string, order: number, schedule?: Habit['schedule']): Habit => ({ id, title, emoji, order, schedule, createdAt: '', updatedAt: '' })

const todos = [okTodo('장보기', TODAY), okTodo('운동', TODAY, DONE), okTodo('밀린 일', '2026-11-08'), okTodo('내일 일', '2026-11-11'), okTodo('날짜 없음', null)]
// 11월 지출: 10,000 + 12,300 + 7,000 = 29,300 (수입 50만은 빼고)
const txs = [okTx('2026-11-01', 10_000), okTx(TODAY, 12_300), okTx(TODAY, 500_000, 'INCOME'), okTx('2026-11-12', 7_000)]
const NOVEMBER_SPEND = 29_300

describe('위젯 요약 만들기 (buildWidgetSummary)', () => {
  const summary = buildWidgetSummary(todos, txs, TODAY, UNLOCKED)

  it('오늘부터 7일 칸을 만든다', () => {
    const days = Object.keys(summary.days)

    expect(days).toHaveLength(WIDGET_DAYS)
    expect([days[0], days[6]]).toEqual([TODAY, '2026-11-16'])
  })

  it('오늘 할 일은 오늘 마감 + 지난 미완료이고, 못 끝낸 것이 먼저다', () => {
    const today = summary.days[TODAY]

    expect([today.done, today.total]).toEqual([1, 3])
    expect(today.items.map((item) => item.t)).toEqual(['밀린 일', '장보기', '운동'])
  })

  it('다음 날에는 그 전에 못 끝낸 할 일도 함께 센다', () => {
    expect(summary.days['2026-11-11'].items.map((item) => item.t)).toEqual(['밀린 일', '장보기', '내일 일'])
  })

  it('수입은 빼고 지출만 날짜별 · 달별로 더한다', () => {
    expect(summary.days[TODAY].spend).toBe(12_300)
    expect(summary.days['2026-11-12'].spend).toBe(7_000)
    expect(summary.months['2026-11']).toBe(NOVEMBER_SPEND)
  })

  it('잠금 중이면 할 일 제목과 금액을 넣지 않고 개수만 남긴다', () => {
    const locked = buildWidgetSummary(todos, txs, TODAY, LOCKED)

    expect(locked.days[TODAY]).toMatchObject({ done: 1, total: 3, items: [], spend: null, ev: [] })
    expect(locked.months).toEqual({})
    expect(JSON.stringify(locked)).not.toContain('장보기')
  })

  it('달이 넘어가는 주에는 다음 달 합계도 0부터 둔다', () => {
    expect(buildWidgetSummary([], [], '2026-11-28', UNLOCKED).months).toEqual({ '2026-11': 0, '2026-12': 0 })
  })
})

describe('위젯이 읽을 기간 (widgetRange)', () => {
  it('이번 달 1일부터 다다음 달 1일 전까지 읽는다 (달력 위젯이 다음 달까지 쓴다)', () => {
    expect(widgetRange('2026-11-28')).toEqual(['2026-11-01', '2027-01-01'])
  })
})

describe('오늘 위젯 (widgetView)', () => {
  const summary = buildWidgetSummary(todos, txs, TODAY, UNLOCKED)

  it('오늘 칸의 날짜 · 할 일 수 · 지출을 보여 준다', () => {
    const view = widgetView(summary, TODAY)

    expect(view.dateLabel).toBe('11월 10일 화요일')
    expect(view).toMatchObject({ stale: false, done: 1, total: 3, more: 0, money: '오늘 지출 12,300원 · 11월 29,300원' })
  })

  it('앱을 안 열고 날이 바뀌어도 그날 칸을 고른다', () => {
    expect(widgetView(summary, '2026-11-12').money).toBe('오늘 지출 7,000원 · 11월 29,300원')
  })

  it.each([
    ['요약이 7일을 넘었으면', summary],
    ['요약이 아예 없으면', null],
  ])('%s 앱을 열어 달라고 한다', (_case, saved) => {
    expect(widgetView(saved, '2026-11-20').stale).toBe(true)
  })

  it('잠금 중이면 금액 · 제목을 숨기고 개수만 보여 준다', () => {
    const view = widgetView(buildWidgetSummary(todos, txs, TODAY, LOCKED), TODAY)

    expect(view).toMatchObject({ locked: true, money: null, items: [], total: 3 })
  })
})

describe('위젯 여러 종류', () => {
  const TODO_COUNT = 10
  const many = Array.from({ length: TODO_COUNT }, (_, i) => okTodo(`일 ${i + 1}`, TODAY))
  const WEDNESDAY = 3
  const TOTAL_BUDGET = ''
  const extras = {
    events: [okEvent('여행', '2026-11-09', '2026-11-11'), okEvent('치과', '2026-11-12'), okEvent('회의', TODAY)],
    habits: [okHabit(1, '물 마시기', '💧', 1), okHabit(2, '적금 넣기', '💰', 2, { freq: 'weekly' as const, weekday: WEDNESDAY })],
    checks: [{ habitId: 1, date: TODAY, createdAt: '' }],
    budgets: [{ category: TOTAL_BUDGET, amount: 20_000, updatedAt: '' }, { category: '식비', amount: 5_000, updatedAt: '' }],
    opacity: { today: 100, todo: 40, money: 0, event: 75, habit: 100, calendar: 50 },
  }
  const summary = buildWidgetSummary(many, txs, TODAY, UNLOCKED, extras)

  it("'오늘' 위젯은 할 일을 4개만 보이고 나머지는 +6 으로 센다", () => {
    const view = widgetView(summary, TODAY)

    expect(view.items).toHaveLength(4)
    expect(view.more).toBe(TODO_COUNT - 4)
  })

  it("'할 일' 위젯은 8개까지 보이고 나머지는 +2 로 센다", () => {
    const view = todoWidgetView(summary, TODAY)

    expect(view.items).toHaveLength(8)
    expect(view).toMatchObject({ total: TODO_COUNT, more: TODO_COUNT - 8 })
  })

  it('가계부 위젯은 이번 달 지출과 전체 예산에서 남은 돈을 보여 주고, 넘으면 100% 로 막는다', () => {
    expect(moneyWidgetView(summary, TODAY)).toMatchObject({ monthLabel: '11월', today: 12_300, month: NOVEMBER_SPEND, budget: 20_000, left: 20_000 - NOVEMBER_SPEND, pct: 100 })
  })

  it('전체 예산이 없으면 가계부 위젯의 예산은 비운다', () => {
    expect(moneyWidgetView(buildWidgetSummary([], txs, TODAY, UNLOCKED), TODAY).budget).toBeNull()
  })

  it('일정 위젯은 여러 날 일정을 오늘(또는 첫날)에만 넣고 날짜 순으로 놓는다', () => {
    const rowsOn = (day: string) => eventWidgetView(summary, day).rows.map((row) => `${row.label} ${row.t}`)

    expect(eventWidgetView(summary, TODAY).todayCount).toBe(2)
    expect(rowsOn(TODAY)).toEqual(['오늘 여행', '오늘 회의', '11/12 목 치과'])
    expect(rowsOn('2026-11-11')).toEqual(['오늘 여행', '내일 치과'])
  })

  it.each([
    ['화요일(매일 습관만)', TODAY, { done: 1, total: 1 }],
    ['수요일(매주 수요일 습관도)', '2026-11-11', { done: 0, total: 2 }],
  ])('습관 위젯은 그날 할 습관과 체크한 수를 센다: %s', (_case, day, counts) => {
    expect(habitWidgetView(summary, day)).toMatchObject(counts)
  })

  it('정한 투명도를 함께 싣는다', () => {
    expect(summary.opacity).toEqual(extras.opacity)
  })

  it('투명도를 정하지 않았으면 모두 100 으로 싣는다', () => {
    expect(buildWidgetSummary([], [], TODAY, UNLOCKED).opacity).toEqual({ today: 100, todo: 100, money: 100, event: 100, habit: 100, calendar: 100, memo: 100 })
  })

  it('잠금 중이면 일정 제목, 습관 제목, 예산을 넣지 않는다', () => {
    const locked = buildWidgetSummary(many, txs, TODAY, LOCKED, extras)

    expect(locked.budget).toBeNull()
    expect(JSON.stringify(locked)).not.toContain('여행')
    expect(JSON.stringify(locked)).not.toContain('물 마시기')
    expect(eventWidgetView(locked, TODAY)).toMatchObject({ locked: true, todayCount: 2, rows: [] })
  })
})

describe('달력 위젯', () => {
  const extras = {
    events: [okEvent('여행', '2026-11-09', '2026-11-11'), okEvent('회의', TODAY), okEvent('송년회', '2026-12-20')],
    diaries: [{ date: '2026-11-03', color: '#ffb3c7' }, { date: '2026-12-01', color: '#9fd8ff' }],
  }
  const summary = buildWidgetSummary([], txs, TODAY, UNLOCKED, extras)
  const cell = (mode: 'money' | 'diary' | 'event', day: number, size?: 'small' | 'medium' | 'large') => calendarWidgetView(summary, TODAY, mode, size).weeks.flat().find((c) => c?.day === day)

  it('이번 달과 다음 달의 지출 · 일정 · 일기 색 · 공휴일을 담는다', () => {
    const CHRISTMAS = 25

    expect(Object.keys(summary.cal)).toEqual(['2026-11', '2026-12'])
    expect(summary.cal['2026-11'].s).toEqual({ '1': 10_000, '10': 12_300, '12': 7_000 })
    expect(summary.cal['2026-11'].e['10']).toEqual([2, '여행', '회의'])
    expect(summary.cal['2026-12'].e['20']).toEqual([1, '송년회'])
    expect(summary.cal['2026-11'].d).toEqual({ '3': '#ffb3c7' })
    expect(summary.cal['2026-12'].h).toContain(CHRISTMAS)
  })

  it.each([
    ['돈 모드는 짧은 지출', 'money', undefined, ['1.2만']],
    ['작은 일정 모드는 한 줄', 'event', 'small', ['여행']],
    ['큰 일정 모드는 여러 줄', 'event', 'large', ['여행', '회의']],
  ] as const)('10일 칸 글자: %s', (_case, mode, size, lines) => {
    expect(cell(mode, 10, size)?.lines).toEqual(lines)
  })

  it('일기 모드는 그날 일기 색 점을 찍는다', () => {
    expect(cell('diary', 3)?.dot).toBe('#ffb3c7')
  })

  it('오늘 칸을 표시하고, 아래에 이번 달 지출 합계를 짧게 쓴다', () => {
    expect(cell('money', 10)?.today).toBe(true)
    expect(calendarWidgetView(summary, TODAY, 'money').sum).toBe('지출 2.9만원')
  })

  it.each([
    ['일정이 줄(2줄)보다 많으면 마지막 줄은 +남은 수', [5, 'a', 'b', 'c', 'd'], 2, ['a', '+4']],
    ['일정이 줄(4줄)에 다 들어가면 그대로', [4, 'a', 'b', 'c', 'd'], 4, ['a', 'b', 'c', 'd']],
  ])('%s', (_case, events, rows, lines) => {
    expect(eventLines(events as [number, ...string[]], rows)).toEqual(lines)
  })

  it.each([
    [200, 'small'],
    [320, 'medium'],
    [700, 'large'],
  ])('위젯 높이 %ipx 이면 %s 크기로 그린다', (height, size) => {
    expect(calendarSizeOf(height)).toBe(size)
  })

  it('2026년 11월은 일요일에 시작해 5주로 그린다', () => {
    const view = calendarWidgetView(summary, TODAY, 'money')

    expect(view.weeks).toHaveLength(5)
    expect(view.weeks[0][0]?.day).toBe(1)
  })

  it.each([
    ['다음 달 1일', '2026-12-01', false],
    ['다다음 달 1일', '2027-01-01', true],
  ])('앱을 안 열어도 다음 달까지 보인다: %s 에 앱을 열어 달라고 하는가: $2', (_case, day, isStale) => {
    expect(calendarWidgetView(summary, day, 'diary').stale).toBe(isStale)
  })

  it('잠금 중이면 일정 제목을 넣지 않고 칸 글자를 모두 비운다', () => {
    const locked = buildWidgetSummary([], txs, TODAY, LOCKED, extras)

    expect(JSON.stringify(locked.cal)).not.toContain('여행')
    expect(calendarWidgetView(locked, TODAY, 'money').weeks.flat().every((c) => !c || c.lines.length === 0)).toBe(true)
  })
})

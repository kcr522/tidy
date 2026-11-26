import { describe, expect, it } from 'vitest'
import { addWidget, cleanLayout, colsForWidth, daysUntil, ddayLabel, defaultLayout, doneByDay, heatLevel, moveWidget, removeWidget, resizeWidget } from '../../src/lib/dashLayout'

const PHONE_COLS = 4

describe('대시보드 위젯 배치', () => {
  it.each([
    [358, 4],
    [700, 8],
    [1100, 12],
  ])('창 너비 %ipx 이면 격자를 %i칸으로 나눈다', (width, cols) => {
    expect(colsForWidth(width)).toBe(cols)
  })

  it.each([4, 8, 12] as const)('%i칸 기본 배치의 위젯은 칸 수보다 넓지 않다', (cols) => {
    const widths = defaultLayout(cols).map((widget) => widget.w)

    expect(Math.max(...widths)).toBeLessThanOrEqual(cols)
  })

  it('저장된 배치에서 모르는 위젯 · 겹친 위젯을 빼고 크기를 칸 안으로 맞춘다', () => {
    const saved = [{ kind: 'date', w: 9, h: 0 }, { kind: 'nope', w: 2, h: 2 }, { kind: 'date', w: 2, h: 2 }, { kind: 'todos', w: 1, h: 40 }]

    const cleaned = cleanLayout(saved, PHONE_COLS)

    expect(cleaned).toEqual([
      { kind: 'date', w: 4, h: 2 },
      { kind: 'todos', w: 2, h: 12 },
    ])
  })

  it('저장된 배치가 목록이 아니면 버린다', () => {
    expect(cleanLayout('x', PHONE_COLS)).toBeNull()
  })

  it('위젯을 옮기면 사이에 있던 위젯이 한 칸씩 밀린다', () => {
    const layout = defaultLayout(PHONE_COLS)

    const moved = moveWidget(layout, 0, 2)

    expect(moved.map((widget) => widget.kind).slice(0, 3)).toEqual([layout[1].kind, layout[2].kind, layout[0].kind])
  })

  it('없는 자리로 옮기면 배치를 바꾸지 않는다', () => {
    const layout = defaultLayout(PHONE_COLS)
    const outOfRange = 99

    expect(moveWidget(layout, 0, outOfRange)).toBe(layout)
  })

  it('너무 작게 줄이면 그 위젯의 가장 작은 크기로 맞춘다', () => {
    const layout = resizeWidget(defaultLayout(PHONE_COLS), 'timeline', PHONE_COLS, 1, 1)

    expect(layout.find((widget) => widget.kind === 'timeline')).toMatchObject({ w: 2, h: 3 }) // 타임라인 가장 작은 크기
  })

  it('뺀 위젯은 목록에서 사라지고, 다시 넣으면 맨 앞에 들어간다', () => {
    const removed = removeWidget(defaultLayout(PHONE_COLS), 'dday')

    const added = addWidget(removed, 'dday', PHONE_COLS)

    expect(removed.some((widget) => widget.kind === 'dday')).toBe(false)
    expect(added[0]).toMatchObject({ kind: 'dday' })
  })

  it.each([
    ['2026-11-18', '2026-11-24', 6],
    ['2026-12-31', '2027-01-01', 1], // 해를 넘겨도 하루
  ])('%s 에서 %s 까지는 %i일 남았다', (today, target, days) => {
    expect(daysUntil(today, target)).toBe(days)
  })

  it.each([
    [0, 'D-DAY'],
    [-2, 'D+2'],
  ])('남은 날이 %i 이면 "%s" 로 보여 준다', (days, label) => {
    expect(ddayLabel(days)).toBe(label)
  })

  it('잔디는 끝낸 할 일을 끝낸 날짜별로 센다', () => {
    const todos = [
      { isCompleted: 1, completedAt: new Date(2026, 10, 18, 9).toISOString() },
      { isCompleted: 1, completedAt: new Date(2026, 10, 18, 20).toISOString() },
      { isCompleted: 0, completedAt: null },
    ]

    const byDay = doneByDay(todos)

    expect(byDay.get('2026-11-18')).toBe(2)
  })

  it.each([
    [0, 0],
    [1, 1],
    [2, 2],
    [4, 3],
    [9, 4],
  ])('하루에 %i개 끝내면 잔디 진하기는 %i 단계다', (count, level) => {
    expect(heatLevel(count)).toBe(level)
  })
})

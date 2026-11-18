import { describe, expect, it } from 'vitest'
import { addWidget, cleanLayout, colsForWidth, daysUntil, ddayLabel, defaultLayout, doneByDay, heatLevel, moveWidget, removeWidget, resizeWidget } from '../../src/lib/dashLayout'

describe('대시보드 위젯 배치', () => {
  it('창 너비로 격자 칸 수를 고른다', () => {
    expect(colsForWidth(358)).toBe(4)
    expect(colsForWidth(700)).toBe(8)
    expect(colsForWidth(1100)).toBe(12)
  })

  it('기본 배치는 칸 수를 넘지 않는다', () => {
    for (const cols of [4, 8, 12] as const) for (const w of defaultLayout(cols)) expect(w.w).toBeLessThanOrEqual(cols)
  })

  it('저장된 값을 다듬는다: 모르는 위젯·겹친 위젯을 빼고 크기를 칸 안으로', () => {
    const raw = [{ kind: 'date', w: 9, h: 0 }, { kind: 'nope', w: 2, h: 2 }, { kind: 'date', w: 2, h: 2 }, { kind: 'todos', w: 1, h: 40 }]
    expect(cleanLayout(raw, 4)).toEqual([
      { kind: 'date', w: 4, h: 2 },
      { kind: 'todos', w: 2, h: 12 },
    ])
    expect(cleanLayout('x', 4)).toBeNull()
  })

  it('옮기면 사이 위젯이 한 칸씩 밀린다', () => {
    const l = defaultLayout(4)
    const moved = moveWidget(l, 0, 2)
    expect(moved.map((w) => w.kind).slice(0, 3)).toEqual([l[1].kind, l[2].kind, l[0].kind])
    expect(moveWidget(l, 0, 99)).toBe(l)
  })

  it('크기는 가장 작은 크기와 칸 수 사이로', () => {
    const l = resizeWidget(defaultLayout(4), 'timeline', 4, 1, 1)
    expect(l.find((w) => w.kind === 'timeline')).toMatchObject({ w: 2, h: 3 })
  })

  it('뺀 위젯을 다시 넣으면 맨 앞에 기본 크기로', () => {
    const l = removeWidget(defaultLayout(4), 'dday')
    expect(l.some((w) => w.kind === 'dday')).toBe(false)
    expect(addWidget(l, 'dday', 4)[0]).toMatchObject({ kind: 'dday' })
  })

  it('디데이와 잔디', () => {
    expect(daysUntil('2026-11-18', '2026-11-24')).toBe(6)
    expect(daysUntil('2026-12-31', '2027-01-01')).toBe(1)
    expect(ddayLabel(0)).toBe('D-DAY')
    expect(ddayLabel(-2)).toBe('D+2')
    const map = doneByDay([
      { isCompleted: 1, completedAt: new Date(2026, 10, 18, 9).toISOString() },
      { isCompleted: 1, completedAt: new Date(2026, 10, 18, 20).toISOString() },
      { isCompleted: 0, completedAt: null },
    ])
    expect(map.get('2026-11-18')).toBe(2)
    expect([0, 1, 2, 4, 9].map(heatLevel)).toEqual([0, 1, 2, 3, 4])
  })
})

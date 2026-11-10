import { describe, expect, it } from 'vitest'
import { defaultCustomization, parseCustomization, withFixedColors } from '../../src/lib/customize'
import { pickTheme } from '../../src/lib/palette'

describe('꾸미기 (customize)', () => {
  it('저장된 값이 없거나 깨졌으면 기본값', () => {
    expect(parseCustomization(null)).toEqual(defaultCustomization())
    expect(parseCustomization('x')).toEqual(defaultCustomization())
  })

  it('틀린 색, 사진, 범위를 벗어난 투명도는 고친다', () => {
    const c = parseCustomization({
      background: { color: 'fixed', fixed: 'red', photo: 'javascript:alert(1)', clear: 140, cardClear: 99 },
      sections: { money: { color: 'fixed', colors: ['#111111', '#222222', '#333333'], photo: 'data:image/jpeg;base64,AA', clear: -5 } },
    })
    expect(c.background).toMatchObject({ color: 'fixed', fixed: '#c9e7ff', photo: null, clear: 100, cardClear: 70 })
    expect(c.sections.money).toMatchObject({ color: 'fixed', photo: 'data:image/jpeg;base64,AA', clear: 0 })
  })

  it('고정한 구역만 고른 색으로 바뀌고 나머지는 랜덤 그대로', () => {
    const theme = pickTheme(() => 0.3)
    const c = defaultCustomization()
    c.sections.todo = { ...c.sections.todo, color: 'fixed', colors: ['#ff0000', '#00ff00', '#0000ff'] }
    const t = withFixedColors(theme, c)
    expect(t.sections.todo.colors).toEqual(['#ff0000', '#00ff00', '#0000ff'])
    expect(t.sections.money).toEqual(theme.sections.money)
  })

  it('체크 표시 색: 기본은 구역 색, 고른 색은 #rrggbb 만', () => {
    expect(parseCustomization({}).check).toEqual({ color: 'section', fixed: '#34c759' })
    expect(parseCustomization({ check: { color: 'fixed', fixed: '#ff00aa' } }).check).toEqual({ color: 'fixed', fixed: '#ff00aa' })
    expect(parseCustomization({ check: { color: 'fixed', fixed: 'url(x)' } }).check.fixed).toBe('#34c759')
  })
})

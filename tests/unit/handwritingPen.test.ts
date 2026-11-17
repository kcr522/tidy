import { describe, expect, it } from 'vitest'
import { isPenEraser, pressureScale } from '../../src/components/memo/HandwritingPad'

describe('S펜', () => {
  it('누르는 힘에 따라 굵기 배율이 바뀐다 (힘 정보가 없으면 그대로)', () => {
    expect(pressureScale(0)).toBe(1)
    expect(pressureScale(0.1)).toBeLessThan(pressureScale(0.5))
    expect(pressureScale(0.5)).toBeLessThan(pressureScale(1))
    expect(pressureScale(1)).toBeLessThanOrEqual(1.8)
    expect(pressureScale(0.01)).toBeGreaterThanOrEqual(0.35)
  })

  it('S펜 옆 버튼이나 지우개 끝이면 지우개', () => {
    expect(isPenEraser('pen', 1)).toBe(false)
    expect(isPenEraser('pen', 2)).toBe(true)
    expect(isPenEraser('pen', 32)).toBe(true)
    expect(isPenEraser('touch', 2)).toBe(false)
  })
})

describe('형광펜', () => {
  it('반투명이라 밑의 글씨 · 사진이 비친다', async () => {
    const { HL_ALPHA, HL_COLORS, HL_SIZES } = await import('../../src/components/memo/HandwritingPad')
    expect(HL_ALPHA).toBeGreaterThan(0.2)
    expect(HL_ALPHA).toBeLessThan(0.6)
    expect(HL_COLORS).toHaveLength(5)
    expect(HL_SIZES.map((s) => s.px)).toEqual([...HL_SIZES.map((s) => s.px)].sort((a, b) => a - b))
  })
})

import { describe, expect, it } from 'vitest'
import { hexToHsl, hexToRgb } from '../../src/lib/palette'
import { paletteFromPixels } from '../../src/lib/photoPalette'

/** 색과 픽셀 수로 가짜 사진 만들기 */
function pixels(parts: [string, number][]): number[] {
  const out: number[] = []
  for (const [hex, n] of parts) {
    const [r, g, b] = hexToRgb(hex)
    for (let i = 0; i < n; i++) out.push(r, g, b, 255)
  }
  return out
}

describe('사진 색 뽑기', () => {
  it('분홍·갈색 웹툰 컷이면 연한 살구 바탕 + 분홍→갈색 세 색', () => {
    const p = paletteFromPixels(pixels([['#ffffff', 1700], ['#aa8077', 1265], ['#ecd1c8', 1033], ['#eeb2af', 1011], ['#c0a095', 759], ['#6b4e4c', 716], ['#f4ece8', 690]]))
    const [h, s, l] = hexToHsl(p.bg)
    expect(l).toBeGreaterThan(90)
    expect(s).toBeLessThan(50)
    expect(h < 40 || h > 340).toBe(true)
    const ls = p.colors.map((c) => hexToHsl(c)[2])
    expect(ls[0]).toBeGreaterThan(ls[1])
    expect(ls[1]).toBeGreaterThan(ls[2])
  })

  it('흑백 사진이어도 색 세 개를 만든다', () => {
    const p = paletteFromPixels(pixels([['#ffffff', 500], ['#000000', 500], ['#808080', 300]]))
    expect(p.colors).toHaveLength(3)
    expect(p.colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
    expect(/^#[0-9a-f]{6}$/.test(p.bg)).toBe(true)
  })

  it('파란 사진이면 파란 계열', () => {
    const p = paletteFromPixels(pixels([['#2f6fd0', 800], ['#9cc3f5', 600], ['#0d2c5a', 400], ['#eaf2fd', 500]]))
    for (const c of [...p.colors, p.bg]) {
      const [h] = hexToHsl(c)
      expect(h).toBeGreaterThan(190)
      expect(h).toBeLessThan(240)
    }
  })
})

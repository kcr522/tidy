import { describe, expect, it } from 'vitest'
import { hexToHsl, hexToRgb } from '../../src/lib/palette'
import { paletteFromPixels } from '../../src/lib/photoPalette'

/** 색과 픽셀 수로 가짜 사진(RGBA 픽셀 배열) 만들기 */
function pixels(parts: [string, number][]): number[] {
  const out: number[] = []
  for (const [hex, count] of parts) {
    const [r, g, b] = hexToRgb(hex)
    for (let i = 0; i < count; i++) out.push(r, g, b, 255)
  }
  return out
}
const HEX = /^#[0-9a-f]{6}$/
const lightnessOf = (hex: string) => hexToHsl(hex)[2]

describe('사진 색 뽑기', () => {
  // 분홍 · 갈색 웹툰 컷 한 장에서 뽑은 색과 픽셀 수
  const webtoon = pixels([['#ffffff', 1700], ['#aa8077', 1265], ['#ecd1c8', 1033], ['#eeb2af', 1011], ['#c0a095', 759], ['#6b4e4c', 716], ['#f4ece8', 690]])

  it('분홍 · 갈색 웹툰 컷이면 바탕은 아주 밝고 연한 살구색이다', () => {
    const [hue, saturation, lightness] = hexToHsl(paletteFromPixels(webtoon).bg)

    expect(lightness).toBeGreaterThan(90)
    expect(saturation).toBeLessThan(50)
    expect(hue < 40 || hue > 340).toBe(true) // 빨강 ~ 주황 근처
  })

  it('분홍 · 갈색 웹툰 컷이면 세 색은 밝은 분홍에서 진한 갈색 순서다', () => {
    const [first, second, third] = paletteFromPixels(webtoon).colors.map(lightnessOf)

    expect(first).toBeGreaterThan(second)
    expect(second).toBeGreaterThan(third)
  })

  it('흑백 사진이어도 #rrggbb 색 세 개와 바탕색을 만든다', () => {
    const palette = paletteFromPixels(pixels([['#ffffff', 500], ['#000000', 500], ['#808080', 300]]))

    expect(palette.colors).toHaveLength(3)
    expect(palette.colors.every((color) => HEX.test(color))).toBe(true)
    expect(HEX.test(palette.bg)).toBe(true)
  })

  it('파란 사진이면 세 색과 바탕 모두 파란 계열(색상 190~240도)이다', () => {
    const palette = paletteFromPixels(pixels([['#2f6fd0', 800], ['#9cc3f5', 600], ['#0d2c5a', 400], ['#eaf2fd', 500]]))

    for (const color of [...palette.colors, palette.bg]) {
      const [hue] = hexToHsl(color)
      expect(hue).toBeGreaterThan(190)
      expect(hue).toBeLessThan(240)
    }
  })
})

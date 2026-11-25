import { describe, expect, it } from 'vitest'
import { PRESETS, SECTIONS, brandShades, deepen, generateTrio, hexToHsl, hslToHex, luminance, pickTheme, textOn, type Trio } from '../../src/lib/palette'

/** 같은 seed 면 늘 같은 순서로 나오는 가짜 난수 (선형 합동 생성기) */
function seeded(seed: number) {
  let x = seed + 1
  return () => (x = (x * 9301 + 49297) % 233280) / 233280
}
const HEX = /^#[0-9a-f]{6}$/
const NEW_MIX = '새 조합'
const MAX_BRAND_LUMINANCE = 0.17 // 흰 바탕과 대비 4.5:1 (WCAG AA)
const MAX_LOGO_LUMINANCE = 0.3
const SEEDS = Array.from({ length: 100 }, (_, i) => i)
const isHexTrio = (colors: string[]) => colors.every((color) => HEX.test(color))

describe('켤 때마다 바뀌는 색 (palette)', () => {
  it('견본은 18개이고 모두 #rrggbb 세 색이다', () => {
    expect(PRESETS).toHaveLength(18)
    for (const preset of PRESETS) expect(isHexTrio(preset.colors)).toBe(true)
  })

  it('200번 골라 봐도 구역 네 곳 모두 세 색을 받고, 견본은 구역끼리 겹치지 않고, 각도는 100~160도다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const theme = pickTheme(seeded(seed))
      const presetNames = SECTIONS.map((section) => theme.sections[section].name).filter((name) => name !== NEW_MIX)

      expect(new Set(presetNames).size).toBe(presetNames.length)
      for (const section of SECTIONS) expect(isHexTrio(theme.sections[section].colors)).toBe(true)
      expect(theme.angle).toBeGreaterThanOrEqual(100)
      expect(theme.angle).toBeLessThanOrEqual(160)
    }
  })

  it('50번 켜면 40가지 넘게 다른 결과가 나오고, 견본과 새 조합이 둘 다 나온다', () => {
    const themes = Array.from({ length: 50 }, (_, i) => pickTheme(seeded(i)))

    const keys = new Set(themes.map((theme) => SECTIONS.map((section) => theme.sections[section].colors.join()).join('|')))
    const names = themes.flatMap((theme) => SECTIONS.map((section) => theme.sections[section].name))

    expect(keys.size).toBeGreaterThan(40)
    expect(names).toContain(NEW_MIX)
    expect(names.some((name) => name !== NEW_MIX)).toBe(true)
  })

  it('새 조합도 #rrggbb 세 색이다', () => {
    for (const seed of SEEDS) expect(isHexTrio(generateTrio(seeded(seed)))).toBe(true)
  })

  it.each([
    ['밝은 그라데이션', ['#fff3a3', '#c6f5a6', '#8fe3d0'], '#191f28'],
    ['진한 회색 그라데이션', ['#5b6270', '#2f343d', '#111317'], '#ffffff'],
    ['진한 주황 · 보라 그라데이션', ['#ff8a00', '#ff2e7e', '#8a2be2'], '#ffffff'],
  ])('%s 에는 %j 위에 %s 글자를 쓴다', (_case, colors, textColor) => {
    expect(textOn(colors as Trio)).toBe(textColor)
  })

  it('새 조합의 포인트 단색(brand-600)은 흰 바탕에서 읽힐 만큼 진하다 (대비 4.5:1)', () => {
    for (const seed of SEEDS) expect(luminance(brandShades(generateTrio(seeded(seed)))['600'])).toBeLessThanOrEqual(MAX_BRAND_LUMINANCE)
  })

  it.each(PRESETS.map((preset) => [preset.name, preset] as const))('견본 %s 의 포인트 단색(brand-600)도 흰 바탕에서 읽힌다', (_name, preset) => {
    expect(luminance(brandShades(preset.colors)['600'])).toBeLessThanOrEqual(MAX_BRAND_LUMINANCE)
  })

  it.each(PRESETS.map((preset) => [preset.name, preset] as const))('견본 %s 의 로고 색은 흰 바탕에서 보이게 진해진다', (_name, preset) => {
    for (const color of preset.colors) expect(luminance(deepen(color))).toBeLessThanOrEqual(MAX_LOGO_LUMINANCE)
  })

  it.each([
    [0, 100, 50, '#ff0000'],
    [210, 100, 50, '#0080ff'],
  ])('HSL(%i, %i%, %i%) 은 %s 다', (hue, saturation, lightness, hex) => {
    expect(hslToHex(hue, saturation, lightness)).toBe(hex)
  })

  it('빨강 #ff0000 의 색상(hue)은 0도다', () => {
    expect(Math.round(hexToHsl('#ff0000')[0])).toBe(0)
  })
})

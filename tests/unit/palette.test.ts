import { describe, expect, it } from 'vitest'
import { PRESETS, SECTIONS, brandShades, deepen, generateTrio, hexToHsl, hslToHex, luminance, pickTheme, textOn } from '../../src/lib/palette'

function seeded(seed: number) {
  let x = seed + 1
  return () => (x = (x * 9301 + 49297) % 233280) / 233280
}
const HEX = /^#[0-9a-f]{6}$/

describe('켤 때마다 바뀌는 색 (palette)', () => {
  it('견본은 18개, 각 세 색', () => {
    expect(PRESETS).toHaveLength(18)
    for (const p of PRESETS) expect(p.colors.every((c) => HEX.test(c))).toBe(true)
  })

  it('구역 네 곳 모두 세 색을 받고, 견본은 구역끼리 겹치지 않는다', () => {
    for (let seed = 0; seed < 200; seed++) {
      const t = pickTheme(seeded(seed))
      const names = SECTIONS.map((s) => t.sections[s].name).filter((n) => n !== '새 조합')
      expect(new Set(names).size).toBe(names.length)
      for (const s of SECTIONS) expect(t.sections[s].colors.every((c) => HEX.test(c))).toBe(true)
      expect(t.angle).toBeGreaterThanOrEqual(100)
      expect(t.angle).toBeLessThanOrEqual(160)
    }
  })

  it('켤 때마다 다른 결과가 나온다 (견본과 새 조합이 둘 다 나온다)', () => {
    const themes = Array.from({ length: 50 }, (_, i) => pickTheme(seeded(i)))
    const keys = new Set(themes.map((t) => SECTIONS.map((s) => t.sections[s].colors.join()).join('|')))
    expect(keys.size).toBeGreaterThan(40)
    const all = themes.flatMap((t) => SECTIONS.map((s) => t.sections[s].name))
    expect(all).toContain('새 조합')
    expect(all.some((n) => n !== '새 조합')).toBe(true)
  })

  it('새 조합도 올바른 색 세 개', () => {
    for (let seed = 0; seed < 100; seed++) expect(generateTrio(seeded(seed)).every((c) => HEX.test(c))).toBe(true)
  })

  it('밝은 그라데이션엔 검정 글자, 진한 그라데이션엔 흰 글자', () => {
    expect(textOn(['#fff3a3', '#c6f5a6', '#8fe3d0'])).toBe('#191f28')
    expect(textOn(['#5b6270', '#2f343d', '#111317'])).toBe('#ffffff')
    expect(textOn(['#ff8a00', '#ff2e7e', '#8a2be2'])).toBe('#ffffff')
  })

  it('포인트 단색(brand-600)은 흰 바탕에서 읽힐 만큼 진하다 (대비 4.5:1)', () => {
    for (let seed = 0; seed < 100; seed++) expect(luminance(brandShades(generateTrio(seeded(seed)))['600'])).toBeLessThanOrEqual(0.17)
    for (const p of PRESETS) expect(luminance(brandShades(p.colors)['600'])).toBeLessThanOrEqual(0.17)
  })

  it('로고 색은 아주 밝은 견본에서도 흰 바탕에서 보인다', () => {
    for (const p of PRESETS) for (const c of p.colors) expect(luminance(deepen(c))).toBeLessThanOrEqual(0.3)
  })

  it('HSL ↔ HEX 변환', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000')
    expect(hslToHex(210, 100, 50)).toBe('#0080ff')
    expect(Math.round(hexToHsl('#ff0000')[0])).toBe(0)
  })
})

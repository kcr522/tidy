import { describe, expect, it } from 'vitest'
import { resolveDark } from '../../src/lib/colorMode'
import { PRESETS, brandShadesDark, lift, luminance } from '../../src/lib/palette'

/** WCAG 명암비: (밝은 색 + 0.05) ÷ (어두운 색 + 0.05) */
const contrast = (first: string, second: string) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((p, q) => q - p)
  return (lighter + 0.05) / (darker + 0.05)
}
const DARK_CARD = '#1c1f26'
const MIN_CONTRAST = 4.5 // WCAG AA 본문 글자 기준
const SYSTEM_DARK = true
const SYSTEM_LIGHT = false

describe('화면 밝기 (라이트 / 다크 / 자동)', () => {
  it.each([
    ['auto', SYSTEM_DARK, true],
    ['auto', SYSTEM_LIGHT, false],
    ['dark', SYSTEM_LIGHT, true],
    ['light', SYSTEM_DARK, false],
  ] as const)('%s 모드에서 시스템이 다크(%s)일 때 다크로 보이는가: %s', (mode, systemDark, isDark) => {
    expect(resolveDark(mode, systemDark)).toBe(isDark)
  })

  it.each(PRESETS.map((preset) => [preset.name, preset] as const))('%s 다크 포인트 글자색(600)은 어두운 카드에서 4.5:1 이상으로 읽힌다', (_name, preset) => {
    const textColor = brandShadesDark(preset.colors)['600']

    expect(contrast(textColor, DARK_CARD)).toBeGreaterThanOrEqual(MIN_CONTRAST)
  })

  it('아주 어두운 그라데이션 색은 다크 바탕에서 보이게 밝힌다', () => {
    const MIN_LUMINANCE = 0.06

    expect(luminance(lift('#111317'))).toBeGreaterThanOrEqual(MIN_LUMINANCE)
  })

  it('이미 밝은 색은 그대로 둔다', () => {
    expect(lift('#4fd1ff')).toBe('#4fd1ff')
  })
})

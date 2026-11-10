import { describe, expect, it } from 'vitest'
import { resolveDark } from '../../src/lib/colorMode'
import { PRESETS, brandShadesDark, lift, luminance } from '../../src/lib/palette'

const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}
const CARD = '#1c1f26'

describe('화면 밝기 (라이트 / 다크 / 자동)', () => {
  it('자동이면 시스템 설정을 따른다', () => {
    expect(resolveDark('auto', true)).toBe(true)
    expect(resolveDark('auto', false)).toBe(false)
    expect(resolveDark('dark', false)).toBe(true)
    expect(resolveDark('light', true)).toBe(false)
  })

  it('다크 포인트 글자색(600)은 어두운 카드에서 4.5:1 이상으로 읽힌다', () => {
    for (const p of PRESETS) expect(contrast(brandShadesDark(p.colors)['600'], CARD)).toBeGreaterThanOrEqual(4.5)
  })

  it('아주 어두운 그라데이션 색은 다크 바탕에서 보이게 밝힌다', () => {
    expect(luminance(lift('#111317'))).toBeGreaterThanOrEqual(0.06)
    expect(lift('#4fd1ff')).toBe('#4fd1ff')
  })
})

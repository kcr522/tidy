import { describe, expect, it } from 'vitest'
import { OTHERS, SKY, pickPalette } from '../../src/lib/palette'

describe('켤 때마다 바뀌는 그라데이션 (pickPalette)', () => {
  it('네 색을 모두 한 번씩 쓰고, 하늘색은 항상 2번이나 3번 자리', () => {
    for (let seed = 0; seed < 50; seed++) {
      let x = seed + 1
      const random = () => ((x = (x * 9301 + 49297) % 233280) / 233280)
      const p = pickPalette(random)
      expect([...p.colors].sort()).toEqual([SKY, ...OTHERS].sort())
      expect([1, 2]).toContain(p.colors.indexOf(SKY))
      expect(p.angle).toBeGreaterThanOrEqual(100)
      expect(p.angle).toBeLessThanOrEqual(160)
    }
  })

  it('랜덤 값에 따라 순서가 달라진다', () => {
    const a = pickPalette(() => 0)
    const b = pickPalette(() => 0.99)
    expect(a.colors).not.toEqual(b.colors)
  })
})

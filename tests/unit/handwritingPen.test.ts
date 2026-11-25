import { describe, expect, it } from 'vitest'
import { isPenEraser, pressureScale } from '../../src/components/memo/HandwritingPad'

const NO_PRESSURE = 0
const MAX_SCALE = 1.8
const MIN_SCALE = 0.35
const MULTI_LINE = true
const ONE_LINE = false

describe('S펜', () => {
  it('누르는 힘 정보가 없으면(0) 굵기를 그대로 둔다', () => {
    expect(pressureScale(NO_PRESSURE)).toBe(1)
  })

  it('세게 누를수록 굵어진다', () => {
    expect(pressureScale(0.1)).toBeLessThan(pressureScale(0.5))
    expect(pressureScale(0.5)).toBeLessThan(pressureScale(1))
  })

  it('굵기 배율은 0.35배 ~ 1.8배 사이로 막는다', () => {
    expect(pressureScale(1)).toBeLessThanOrEqual(MAX_SCALE)
    expect(pressureScale(0.01)).toBeGreaterThanOrEqual(MIN_SCALE)
  })

  it.each([
    ['그냥 펜', 'pen', 1, false],
    ['펜 옆 버튼', 'pen', 2, true],
    ['펜 지우개 끝', 'pen', 32, true],
    ['손가락 (버튼 값 2 여도)', 'touch', 2, false],
  ])('%s 은 지우개인가: $3', (_case, pointer, buttons, isEraser) => {
    expect(isPenEraser(pointer, buttons)).toBe(isEraser)
  })
})

describe('형광펜', () => {
  it('반투명(0.2 ~ 0.6)이라 밑의 글씨 · 사진이 비친다', async () => {
    const { HL_ALPHA } = await import('../../src/components/memo/HandwritingPad')

    expect(HL_ALPHA).toBeGreaterThan(0.2)
    expect(HL_ALPHA).toBeLessThan(0.6)
  })

  it('색은 5가지이고 굵기는 가는 것부터 차례로 놓는다', async () => {
    const { HL_COLORS, HL_SIZES } = await import('../../src/components/memo/HandwritingPad')
    const sizes = HL_SIZES.map((size) => size.px)

    expect(HL_COLORS).toHaveLength(5)
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b))
  })
})

describe('손글씨로 쓰기 → 칸에 붙이기', () => {
  it.each([
    ['빈 여러 줄 칸에는 그대로', '', '오늘은\n맑음', MULTI_LINE, '오늘은\n맑음'],
    ['여러 줄 칸에는 줄을 바꿔', '아침', '점심', MULTI_LINE, '아침\n점심'],
    ['한 줄 칸에는 띄어쓰기로', '우유', '계란\n빵', ONE_LINE, '우유 계란 빵'],
    ['공백뿐인 손글씨는 붙이지 않고', '그대로', '  ', MULTI_LINE, '그대로'],
  ])('손글씨를 %s 붙인다', async (_case, before, written, multiLine, after) => {
    const { appendHandwritten } = await import('../../src/components/common/HandwriteButton')

    expect(appendHandwritten(before, written, multiLine)).toBe(after)
  })

  it('최대 길이(5자)를 넘으면 넘는 글자는 자른다', async () => {
    const { appendHandwritten } = await import('../../src/components/common/HandwriteButton')
    const maxLength = 5

    expect(appendHandwritten('abc', 'defg', ONE_LINE, maxLength)).toBe('abc d')
  })
})

import { describe, expect, it } from 'vitest'
import { frameRect, parseCustomization, photoRefs, readFrames } from '../../src/lib/customize'

const CENTER = 0.5
const NO_ZOOM = 1
const SQUARE = 1

describe('사진 위치 맞추기', () => {
  it('4000×2000 가로 사진을 4:3 칸에 꽉 채우면 높이를 다 쓰고 가운데를 자른다', () => {
    const rect = frameRect(4000, 2000, { x: CENTER, y: CENTER, zoom: NO_ZOOM, aspect: 4 / 3 })

    expect(rect.sh).toBeCloseTo(2000)
    expect(rect.sw).toBeCloseTo(2666.67, 1) // 2000 × 4/3
    expect(rect.sx).toBeCloseTo((4000 - rect.sw) / 2)
  })

  it('두 배로 키우고 오른쪽 위 끝으로 옮기면 반만 자르고, 사진 밖으로는 나가지 않는다', () => {
    const rect = frameRect(1000, 1000, { x: 1, y: 0, zoom: 2, aspect: SQUARE })

    expect(rect.sw).toBe(500)
    expect(rect.sx).toBe(500)
    expect(rect.sy).toBe(0)
  })

  it('목록에 없는 사진의 위치나 확대가 너무 큰 값은 버린다', () => {
    const okFrame = { x: 0.3, y: 0.7, zoom: 1.5, aspect: 1.33, crop: 'idb:crop-1234' }
    const tooBigZoom = { ...okFrame, zoom: 9 }
    const saved = { 'idb:photo-1234': okFrame, 'idb:gone-12345': okFrame, 'idb:bad-123456': tooBigZoom }

    const frames = readFrames(saved, ['idb:photo-1234', 'idb:bad-123456'])

    expect(frames).toEqual({ 'idb:photo-1234': okFrame })
  })

  it('잘라 낸 사진도 보관할 사진 목록에 들어간다', () => {
    const frame = { x: CENTER, y: CENTER, zoom: NO_ZOOM, aspect: SQUARE, crop: 'idb:crop-1234' }
    const custom = parseCustomization({ sections: { main: { photos: ['idb:photo-1234'], frames: { 'idb:photo-1234': frame } } } })

    expect(photoRefs(custom)).toContain('idb:crop-1234')
  })
})

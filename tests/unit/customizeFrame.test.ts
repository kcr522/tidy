import { describe, expect, it } from 'vitest'
import { frameRect, parseCustomization, photoRefs, readFrames } from '../../src/lib/customize'

describe('사진 위치 맞추기', () => {
  it('가로 사진을 4:3 칸에 꽉 채우면 높이를 다 쓰고 가운데를 자른다', () => {
    const r = frameRect(4000, 2000, { x: 0.5, y: 0.5, zoom: 1, aspect: 4 / 3 })
    expect(r.sh).toBeCloseTo(2000)
    expect(r.sw).toBeCloseTo(2666.67, 1)
    expect(r.sx).toBeCloseTo((4000 - r.sw) / 2)
  })

  it('두 배로 키우면 반만 자르고, 사진 밖으로는 나가지 않는다', () => {
    const r = frameRect(1000, 1000, { x: 1, y: 0, zoom: 2, aspect: 1 })
    expect(r.sw).toBe(500)
    expect(r.sx).toBe(500)
    expect(r.sy).toBe(0)
  })

  it('목록에 없는 사진이나 틀린 값은 버린다', () => {
    const ok = { x: 0.3, y: 0.7, zoom: 1.5, aspect: 1.33, crop: 'idb:crop-1234' }
    const f = readFrames({ 'idb:photo-1234': ok, 'idb:gone-12345': ok, 'idb:bad-123456': { ...ok, zoom: 9 } }, ['idb:photo-1234', 'idb:bad-123456'])
    expect(f).toEqual({ 'idb:photo-1234': ok })
  })

  it('잘라 낸 사진도 보관할 사진 목록에 들어간다', () => {
    const c = parseCustomization({ sections: { main: { photos: ['idb:photo-1234'], frames: { 'idb:photo-1234': { x: 0.5, y: 0.5, zoom: 1, aspect: 1, crop: 'idb:crop-1234' } } } } })
    expect(photoRefs(c)).toContain('idb:crop-1234')
  })
})

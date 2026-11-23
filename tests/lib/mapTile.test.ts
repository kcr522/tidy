import { describe, expect, it } from 'vitest'
import { osmTileUrl, parseTile } from '../../src/lib/mapTile'

describe('지도 타일 번호', () => {
  it('맞는 번호는 숫자로', () => {
    expect(parseTile('15', '27938', '12693')).toEqual({ z: 15, x: 27938, y: 12693 })
    expect(osmTileUrl({ z: 15, x: 27938, y: 12693 })).toBe('https://tile.openstreetmap.org/15/27938/12693.png')
  })

  it('틀린 번호 · 다른 글자는 막는다', () => {
    expect(parseTile('20', '0', '0')).toBeNull()
    expect(parseTile('2', '4', '0')).toBeNull()
    expect(parseTile('1', '-1', '0')).toBeNull()
    expect(parseTile('1', '0', '../a')).toBeNull()
    expect(parseTile(null, '0', '0')).toBeNull()
  })
})

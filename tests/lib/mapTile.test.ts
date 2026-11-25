import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, osmTileUrl, parseTile } from '../../src/lib/mapTile'

// 확대 z 에서 x · y 는 0 ~ 2^z - 1
const ZOOM_2_LAST = 2 ** 2 - 1

describe('지도 타일 번호', () => {
  it('맞는 번호 글자는 숫자로 바꾼다', () => {
    expect(parseTile('15', '27938', '12693')).toEqual({ z: 15, x: 27938, y: 12693 })
  })

  it('타일 번호로 OpenStreetMap 그림 주소를 만든다', () => {
    expect(osmTileUrl({ z: 15, x: 27938, y: 12693 })).toBe('https://tile.openstreetmap.org/15/27938/12693.png')
  })

  it.each([
    ['가장 큰 확대(19)', String(MAX_ZOOM), '0', '0', true],
    ['가장 큰 확대보다 1 큰 20', String(MAX_ZOOM + 1), '0', '0', false],
    ['확대 2 에서 x 가 끝 번호(3)', '2', String(ZOOM_2_LAST), '0', true],
    ['확대 2 에서 x 가 끝보다 1 큰 4', '2', String(ZOOM_2_LAST + 1), '0', false],
    ['x 가 음수', '1', '-1', '0', false],
    ['y 에 경로 글자', '1', '0', '../a', false],
    ['z 가 없음', null, '0', '0', false],
  ])('%s 이면 받는가: $4', (_case, z, x, y, isOk) => {
    expect(parseTile(z, x, y) !== null).toBe(isOk)
  })
})

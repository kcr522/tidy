import { describe, expect, it } from 'vitest'
import { agoLabel, autoFileName, isDue, toPrune } from '../../src/lib/autoBackup'

const H = 60 * 60 * 1000
const at = (iso: string) => Date.parse(iso)

describe('isDue', () => {
  it('끄면 안 한다, 한 번도 안 했으면 바로', () => {
    expect(isDue({ every: 'off' }, Date.now())).toBe(false)
    expect(isDue({ every: 'day' }, Date.now())).toBe(true)
  })
  it('매일은 22시간이 지나면 (매일 비슷한 때 열면 매일)', () => {
    const last = '2026-11-10T09:00:00+09:00'
    expect(isDue({ every: 'day', last }, at(last) + 21 * H)).toBe(false)
    expect(isDue({ every: 'day', last }, at(last) + 22 * H)).toBe(true)
  })
  it('매주는 7일 가까이 지나면', () => {
    const last = '2026-11-01T09:00:00+09:00'
    expect(isDue({ every: 'week', last }, at(last) + 6 * 24 * H)).toBe(false)
    expect(isDue({ every: 'week', last }, at(last) + 7 * 24 * H)).toBe(true)
  })
})

describe('toPrune', () => {
  it('자동 백업 파일 중 최신 7개만 남긴다 (다른 파일은 건드리지 않는다)', () => {
    const names = Array.from({ length: 9 }, (_, i) => autoFileName(`2026-11-0${i + 1}`)).concat(['내 백업.json'])
    expect(toPrune(names)).toEqual(['tidy-auto-2026-11-01.json', 'tidy-auto-2026-11-02.json'])
    expect(toPrune(names.slice(0, 3))).toEqual([])
  })
})

describe('agoLabel', () => {
  it('오늘, 어제, N일 전', () => {
    const now = new Date(2026, 10, 11, 20, 0).getTime()
    expect(agoLabel(undefined, now)).toBe('아직 없어요')
    expect(agoLabel(new Date(2026, 10, 11, 8, 5).toISOString(), now)).toBe('오늘 오전 8:05')
    expect(agoLabel(new Date(2026, 10, 10, 23, 0).toISOString(), now)).toBe('어제')
    expect(agoLabel(new Date(2026, 10, 4, 12, 0).toISOString(), now)).toBe('7일 전')
  })
})

describe('열 때마다', () => {
  it('30분이 지나면 다시 한다', () => {
    const last = '2026-11-13T10:00:00+09:00'
    expect(isDue({ every: 'open' }, Date.now())).toBe(true)
    expect(isDue({ every: 'open', last }, at(last) + 29 * 60 * 1000)).toBe(false)
    expect(isDue({ every: 'open', last }, at(last) + 30 * 60 * 1000)).toBe(true)
  })
})

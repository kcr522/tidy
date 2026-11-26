import { describe, expect, it } from 'vitest'
import { PHONE_COVER_MS, preferPhone } from '../../src/lib/route'
import type { StoredPoint } from '../../src/lib/routeStore'
import { decodeDay, encodePoints, mergeDay } from '../../src/lib/sync/routeSync'

const MIN = 60 * 1000
const DATE = '2026-11-26'
const T0 = new Date(2026, 10, 26, 9, 0).getTime()
// 폰은 밖(광화문), 컴퓨터는 집(서울시청 근처) — 같은 시간에 둘 다 기록하는 상황
const OUTSIDE = { lat: 37.5759, lng: 126.9769 }
const HOME = { lat: 37.5665, lng: 126.978 }
const GPS_ACCURACY = 12
const WIFI_ACCURACY = 80
const phoneAt = (min: number): StoredPoint => ({ t: T0 + min * MIN, ...OUTSIDE, acc: GPS_ACCURACY, date: DATE, src: 'a' })
const webAt = (min: number): StoredPoint => ({ t: T0 + min * MIN, ...HOME, acc: WIFI_ACCURACY, date: DATE, src: 'w' })
const NOT_CLEARED = 0

describe('이동 기록 클라우드 맞추기 — 폰과 사이트가 같은 길을 본다', () => {
  it('올린 점을 다시 읽으면 시각 · 위치 · 출처가 그대로다', () => {
    const points = [phoneAt(0), webAt(30)]

    const day = decodeDay(DATE, { p: encodePoints(points), c: NOT_CLEARED })

    expect(day.points).toEqual(points)
    expect(day.clearedAt).toBe(NOT_CLEARED)
  })

  it('출처가 없는 예전 점은 폰 점으로 올린다', () => {
    const { src: _src, ...oldPoint } = phoneAt(0)

    const day = decodeDay(DATE, { p: encodePoints([oldPoint]) })

    expect(day.points[0].src).toBe('a')
  })

  it('두 기기 점은 시각으로 합치고 같은 시각은 하나만 남긴다', () => {
    const local = [phoneAt(0), phoneAt(2)]
    const remote = [phoneAt(2), webAt(60)]

    const merged = mergeDay(local, remote, NOT_CLEARED)

    expect(merged.map((q) => q.t)).toEqual([phoneAt(0).t, phoneAt(2).t, webAt(60).t])
  })

  it.each([
    { label: '지운 시각과 같은 점은 뺀다', min: 10, isKept: false },
    { label: '지운 뒤 1분에 남긴 점은 남긴다', min: 11, isKept: true },
  ])('"이 날 지우기" 뒤 합치기: $label', ({ min, isKept }) => {
    const clearedAt = T0 + 10 * MIN

    const merged = mergeDay([phoneAt(min)], [], clearedAt)

    expect(merged.length === 1).toBe(isKept)
  })

  it('문서에 이상한 숫자가 섞이면 그 점만 버린다', () => {
    const broken = [T0, Number.NaN, OUTSIDE.lng, GPS_ACCURACY, 0]

    const day = decodeDay(DATE, { p: [...broken, ...encodePoints([phoneAt(5)])] })

    expect(day.points).toEqual([phoneAt(5)])
  })
})

describe('폰 · 컴퓨터 기록이 겹치는 시간대', () => {
  const coverMin = PHONE_COVER_MS / MIN

  it.each([
    { label: '폰 점에서 딱 10분 떨어진 컴퓨터 점은 뺀다', min: coverMin, isKept: false },
    { label: '폰 점에서 11분 떨어진 컴퓨터 점은 남긴다', min: coverMin + 1, isKept: true },
  ])('$label', ({ min, isKept }) => {
    const points = [phoneAt(0), webAt(min)]

    const shown = preferPhone(points)

    expect(shown.some((q) => q.src === 'w')).toBe(isKept)
  })

  it('폰 기록이 없는 날은 컴퓨터 점을 모두 보여 준다', () => {
    const points = [webAt(0), webAt(1)]

    const shown = preferPhone(points)

    expect(shown).toEqual(points)
  })
})

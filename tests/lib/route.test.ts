import { describe, expect, it } from 'vitest'
import { cleanPoints, distanceM, durationLabel, findStops, speedColor, speedPieces, summarize, type RoutePoint } from '../../src/lib/route'

const MIN = 60 * 1000
const T0 = new Date(2026, 10, 21, 9, 0).getTime()
const p = (min: number, lat: number, lng: number, acc = 10): RoutePoint => ({ t: T0 + min * MIN, lat, lng, acc })

// 집(서울시청 근처) 30분 → 이동 → 카페 40분
const HOME = { lat: 37.5665, lng: 126.978 }
const CAFE = { lat: 37.5796, lng: 126.977 }
const day: RoutePoint[] = [
  p(0, HOME.lat, HOME.lng),
  p(10, HOME.lat + 0.0002, HOME.lng),
  p(30, HOME.lat, HOME.lng + 0.0002),
  p(34, 37.5705, 126.978),
  p(38, 37.5745, 126.9775),
  p(42, CAFE.lat, CAFE.lng),
  p(60, CAFE.lat + 0.0001, CAFE.lng),
  p(82, CAFE.lat, CAFE.lng + 0.0001),
]

describe('이동 기록', () => {
  it('두 점 거리 (m)', () => {
    expect(distanceM(HOME, CAFE)).toBeGreaterThan(1400)
    expect(distanceM(HOME, CAFE)).toBeLessThan(1500)
  })

  it('튀는 점(순간이동)과 같은 시각은 뺀다', () => {
    const clean = cleanPoints([p(0, HOME.lat, HOME.lng), p(1, 35.1796, 129.0756), p(1, HOME.lat, HOME.lng), p(2, HOME.lat, HOME.lng)])
    expect(clean).toHaveLength(3)
    expect(clean.every((x) => x.lat > 37)).toBe(true)
  })

  it('10분 넘게 있던 곳만 머문 곳', () => {
    const stops = findStops(cleanPoints(day))
    expect(stops).toHaveLength(2)
    expect(distanceM(stops[0], HOME)).toBeLessThan(50)
    expect(distanceM(stops[1], CAFE)).toBeLessThan(50)
    expect(stops[1].end - stops[1].start).toBeGreaterThanOrEqual(40 * MIN)
  })

  it('지나가기만 한 곳은 머문 곳이 아니다', () => {
    expect(findStops([p(0, 37.5, 127), p(3, 37.51, 127), p(6, 37.52, 127)])).toHaveLength(0)
  })

  it('요약: 거리 · 처음 · 마지막', () => {
    const s = summarize([...day].reverse())
    expect(s.km).toBeGreaterThan(1.3)
    expect(s.km).toBeLessThan(1.8)
    expect(s.first).toBe(T0)
    expect(s.last).toBe(T0 + 82 * MIN)
  })

  it('제자리 흔들림은 거리에 안 센다', () => {
    expect(summarize([p(0, 37.5, 127, 40), p(5, 37.5001, 127, 40), p(10, 37.5, 127.0001, 40)]).km).toBe(0)
  })

  it('시간 글자', () => {
    expect(durationLabel(35 * MIN)).toBe('35분')
    expect(durationLabel(80 * MIN)).toBe('1시간 20분')
    expect(durationLabel(120 * MIN)).toBe('2시간')
  })
})

describe('speedPieces', () => {
  it('빠르기가 바뀌는 곳에서 색 조각을 나누고 끝 점을 같이 쓴다', () => {
    const t = 1_700_000_000_000
    // 1분에 50m (3km/h, 걷기) → 1분에 1km (60km/h, 차)
    const pts = [
      { t, lat: 37.5, lng: 127, acc: 5 },
      { t: t + 60000, lat: 37.50045, lng: 127, acc: 5 },
      { t: t + 120000, lat: 37.5009, lng: 127, acc: 5 },
      { t: t + 180000, lat: 37.5099, lng: 127, acc: 5 },
    ]
    const pieces = speedPieces(pts)
    expect(pieces).toHaveLength(2)
    expect(pieces[0].color).toBe(speedColor(3))
    expect(pieces[0].points).toHaveLength(3)
    expect(pieces[1].color).toBe(speedColor(60))
    expect(pieces[1].points[0]).toEqual({ lat: 37.5009, lng: 127 })
  })
})

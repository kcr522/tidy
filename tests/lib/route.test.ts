import { describe, expect, it } from 'vitest'
import { cleanPoints, curveBetween, distanceM, drawPoints, durationLabel, findStops, smoothLine, speedColor, speedPieces, summarize, type RoutePoint } from '../../src/lib/route'

const MIN = 60 * 1000
const T0 = new Date(2026, 10, 21, 9, 0).getTime()
// GPS 정확도 10m 가 보통, 40m 는 흐린 날 실내
const GOOD_ACCURACY = 10
const POOR_ACCURACY = 40
// 같은 곳으로 보는 거리
const SAME_PLACE_M = 50
const pointAt = (min: number, lat: number, lng: number, acc = GOOD_ACCURACY): RoutePoint => ({ t: T0 + min * MIN, lat, lng, acc })

// 집(서울시청 근처) 30분 → 이동 → 카페 40분
const HOME = { lat: 37.5665, lng: 126.978 }
const CAFE = { lat: 37.5796, lng: 126.977 }
const BUSAN = { lat: 35.1796, lng: 129.0756 }
const day: RoutePoint[] = [
  pointAt(0, HOME.lat, HOME.lng),
  pointAt(10, HOME.lat + 0.0002, HOME.lng),
  pointAt(30, HOME.lat, HOME.lng + 0.0002),
  pointAt(34, 37.5705, 126.978),
  pointAt(38, 37.5745, 126.9775),
  pointAt(42, CAFE.lat, CAFE.lng),
  pointAt(60, CAFE.lat + 0.0001, CAFE.lng),
  pointAt(82, CAFE.lat, CAFE.lng + 0.0001),
]

describe('이동 기록', () => {
  it('집에서 카페까지 거리는 1.4 ~ 1.5km 로 잰다', () => {
    const meters = distanceM(HOME, CAFE)

    expect(meters).toBeGreaterThan(1400)
    expect(meters).toBeLessThan(1500)
  })

  it('1분 만에 부산으로 튄 점(순간이동)과 시각이 겹친 점은 뺀다', () => {
    const points = [pointAt(0, HOME.lat, HOME.lng), pointAt(1, BUSAN.lat, BUSAN.lng), pointAt(1, HOME.lat, HOME.lng), pointAt(2, HOME.lat, HOME.lng)]

    const clean = cleanPoints(points)

    expect(clean).toHaveLength(3)
    expect(clean.every((point) => point.lat > BUSAN.lat)).toBe(true)
  })

  it('10분 넘게 있던 집과 카페만 머문 곳으로 찾는다', () => {
    const stops = findStops(cleanPoints(day))

    expect(stops).toHaveLength(2)
    expect(distanceM(stops[0], HOME)).toBeLessThan(SAME_PLACE_M)
    expect(distanceM(stops[1], CAFE)).toBeLessThan(SAME_PLACE_M)
    expect(stops[1].end - stops[1].start).toBeGreaterThanOrEqual(40 * MIN)
  })

  it('3분마다 지나가기만 한 곳은 머문 곳이 아니다', () => {
    expect(findStops([pointAt(0, 37.5, 127), pointAt(3, 37.51, 127), pointAt(6, 37.52, 127)])).toHaveLength(0)
  })

  it('요약은 점 순서가 뒤집혀 있어도 거리 · 처음 시각 · 마지막 시각을 낸다', () => {
    const summary = summarize([...day].reverse())

    expect(summary.km).toBeGreaterThan(1.3)
    expect(summary.km).toBeLessThan(1.8)
    expect(summary.first).toBe(T0)
    expect(summary.last).toBe(T0 + 82 * MIN)
  })

  it('정확도보다 작은 제자리 흔들림은 거리에 세지 않는다', () => {
    const jitter = [pointAt(0, 37.5, 127, POOR_ACCURACY), pointAt(5, 37.5001, 127, POOR_ACCURACY), pointAt(10, 37.5, 127.0001, POOR_ACCURACY)]

    expect(summarize(jitter).km).toBe(0)
  })

  it.each([
    [35, '35분'],
    [80, '1시간 20분'],
    [120, '2시간'],
  ])('%i분은 "%s" 로 쓴다', (minutes, label) => {
    expect(durationLabel(minutes * MIN)).toBe(label)
  })
})

describe('빠르기 색 조각 (speedPieces)', () => {
  it('걷다가 차를 타면 색 조각을 둘로 나누고, 바뀌는 점은 두 조각이 같이 쓴다', () => {
    const t = 1_700_000_000_000
    // 1분에 50m (3km/h, 걷기) → 1분에 1km (60km/h, 차)
    const WALK_KMH = 3
    const CAR_KMH = 60
    const points = [
      { t, lat: 37.5, lng: 127, acc: 5 },
      { t: t + MIN, lat: 37.50045, lng: 127, acc: 5 },
      { t: t + 2 * MIN, lat: 37.5009, lng: 127, acc: 5 },
      { t: t + 3 * MIN, lat: 37.5099, lng: 127, acc: 5 },
    ]

    const pieces = speedPieces(points)

    expect(pieces.map((piece) => piece.color)).toEqual([speedColor(WALK_KMH), speedColor(CAR_KMH)])
    expect(pieces[0].points).toHaveLength(3)
    expect(pieces[1].points[0]).toEqual({ lat: 37.5009, lng: 127 })
  })
})

describe('부드러운 선', () => {
  it('두 점 사이 곡선은 12점으로 그리고 끝 점에서 끝나며 앞뒤 점 범위를 벗어나지 않는다', () => {
    const CURVE_POINTS = 12
    const from = { lat: 37.5, lng: 127 }
    const to = { lat: 37.501, lng: 127.001 }

    const curve = curveBetween({ lat: 37.499, lng: 127 }, from, to, { lat: 37.501, lng: 127.002 })

    expect(curve).toHaveLength(CURVE_POINTS)
    expect(curve.at(-1)).toEqual(to)
    expect(curve.every((point) => point.lat > 37.499 && point.lat < 37.502)).toBe(true)
  })

  it('smoothLine 은 시작 · 끝 점을 그대로 두고 사이를 촘촘히 채운다', () => {
    const t = 1_700_000_000_000
    const points = [0, 1, 2, 3].map((i) => ({ t: t + i * MIN, lat: 37.5 + i * 0.001, lng: 127 + (i % 2) * 0.001, acc: 5 }))

    const line = smoothLine(points)

    expect(line[0]).toEqual({ lat: points[0].lat, lng: points[0].lng })
    expect(line.at(-1)).toEqual({ lat: points[3].lat, lng: points[3].lng })
    expect(line.length).toBeGreaterThan(points.length * 4)
  })

  it('drawPoints 는 제자리 흔들림을 빼고 마지막 점은 남긴다', () => {
    const t = 1_700_000_000_000
    const points = [
      { t, lat: 37.5, lng: 127, acc: GOOD_ACCURACY },
      { t: t + 1, lat: 37.50005, lng: 127, acc: GOOD_ACCURACY },
      { t: t + 2, lat: 37.501, lng: 127, acc: GOOD_ACCURACY },
      { t: t + 3, lat: 37.50101, lng: 127, acc: GOOD_ACCURACY },
    ]

    const drawn = drawPoints(points)

    expect(drawn).toHaveLength(2)
    expect(drawn[1]).toBe(points[3])
  })
})

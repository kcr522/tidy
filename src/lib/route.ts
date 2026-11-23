/**
 * 오늘 이동 기록 (사용자 요청 2026-11-21)
 * 폰이 남긴 위치 점들로 하루 동선 · 머문 곳 · 움직인 거리를 계산한다. 화면과 상관없는 순수 함수만.
 */

export interface RoutePoint {
  /** 받은 시각 (ms) */
  t: number
  lat: number
  lng: number
  /** 정확도 (m). 모르면 0 */
  acc: number
}

export interface RouteStop {
  lat: number
  lng: number
  /** 머물기 시작한 시각 · 떠난 시각 (ms) */
  start: number
  end: number
}

export interface RouteSummary {
  /** 움직인 거리 (km, 소수 한 자리) */
  km: number
  stops: RouteStop[]
  first?: number
  last?: number
}

/** 머문 곳: 이 반경(m) 안에 */
export const STOP_RADIUS = 150
/** 머문 곳: 이 시간(ms) 넘게 */
export const STOP_MIN_MS = 10 * 60 * 1000
/** 기록을 이 날 수만큼만 둔다 */
export const KEEP_DAYS = 30

/** 두 점 사이 거리 (m) */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * 시간 순으로 정리하고 튀는 점을 뺀다
 * - 같은 시각은 하나만
 * - 앞 점에서 시속 300km 넘게 걸려야 갈 수 있는 점 (와이파이 · 기지국 위치가 잠깐 엉뚱하게 잡힌 것)
 */
export function cleanPoints(points: RoutePoint[]): RoutePoint[] {
  const sorted = [...points].filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180).sort((a, b) => a.t - b.t)
  const out: RoutePoint[] = []
  for (const p of sorted) {
    const prev = out[out.length - 1]
    if (prev) {
      if (p.t === prev.t) continue
      const sec = (p.t - prev.t) / 1000
      const d = distanceM(prev, p)
      // 정확도만큼은 흔들릴 수 있으니 빼고 본다
      if (sec > 0 && Math.max(0, d - p.acc - prev.acc) / sec > 300 / 3.6) continue
    }
    out.push(p)
  }
  return out
}

/** 한곳에 STOP_MIN_MS 넘게 있었던 곳 (시간 순) */
export function findStops(points: RoutePoint[], radius = STOP_RADIUS, minMs = STOP_MIN_MS): RouteStop[] {
  const stops: RouteStop[] = []
  let i = 0
  while (i < points.length) {
    // i 에서 시작해 무게중심에서 radius 안에 드는 동안 넓힌다
    let lat = points[i].lat
    let lng = points[i].lng
    let j = i + 1
    while (j < points.length && distanceM({ lat, lng }, points[j]) <= radius) {
      const n = j - i + 1
      lat += (points[j].lat - lat) / n
      lng += (points[j].lng - lng) / n
      j++
    }
    const start = points[i].t
    // 다음 점이 올 때까지는 여기 있었다고 본다 (멈춰 있으면 폰이 점을 거의 안 남긴다)
    const end = j < points.length ? Math.max(points[j - 1].t, points[j].t - 60 * 1000) : points[j - 1].t
    if (end - start >= minMs) {
      const last = stops[stops.length - 1]
      // 잠깐 나갔다 온 같은 곳은 하나로
      if (last && distanceM(last, { lat, lng }) <= radius && start - last.end < minMs) last.end = end
      else stops.push({ lat, lng, start, end })
      i = j
    } else {
      i++
    }
  }
  return stops
}

/** 움직인 거리 (m). 정확도보다 작게 흔들린 것은 세지 않는다 */
export function pathLengthM(points: RoutePoint[]): number {
  let sum = 0
  let prev: RoutePoint | undefined
  for (const p of points) {
    if (prev) {
      const d = distanceM(prev, p)
      if (d < Math.max(30, Math.min(prev.acc, p.acc))) continue
      sum += d
    }
    prev = p
  }
  return sum
}

export function summarize(points: RoutePoint[]): RouteSummary {
  const clean = cleanPoints(points)
  return {
    km: Math.round(pathLengthM(clean) / 100) / 10,
    stops: findStops(clean),
    first: clean[0]?.t,
    last: clean[clean.length - 1]?.t,
  }
}

/** 13:05 */
export function clock(ms: number): string {
  const d = new Date(ms)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** 1시간 20분, 35분 */
export function durationLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000))
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m}분`
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`
}

/** 1.2km, 850m */
export function distanceLabel(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}

/** 빠르기별 선 색 (사용자 요청 2026-11-23, 운동 앱처럼): 걷기 초록 → 빠른 걸음 노랑 → 자전거 주황 → 차 빨강 */
export const SPEED_COLORS = [
  { max: 6, color: '#34d399', label: '걷기' },
  { max: 12, color: '#facc15', label: '빠른 걸음 · 뛰기' },
  { max: 30, color: '#fb923c', label: '자전거' },
  { max: Infinity, color: '#f43f5e', label: '차 · 대중교통' },
] as const

export function speedColor(kmh: number): string {
  return (SPEED_COLORS.find((c) => kmh <= c.max) ?? SPEED_COLORS[SPEED_COLORS.length - 1]).color
}

export interface SpeedPiece {
  color: string
  points: { lat: number; lng: number }[]
}

/** 선을 빠르기 색이 같은 조각들로 나눈다. 조각끼리 끝 점을 같이 써서 선이 끊기지 않는다 */
export function speedPieces(points: RoutePoint[]): SpeedPiece[] {
  const out: SpeedPiece[] = []
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    const sec = Math.max(1, (b.t - a.t) / 1000)
    const color = speedColor((distanceM(a, b) / sec) * 3.6)
    const last = out[out.length - 1]
    if (last && last.color === color) last.points.push({ lat: b.lat, lng: b.lng })
    else out.push({ color, points: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }] })
  }
  return out
}

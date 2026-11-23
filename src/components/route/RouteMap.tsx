import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { MAX_ZOOM, OSM_TILE } from '../../lib/mapTile'
import { drawPoints, smoothLine, speedPieces, type RoutePoint, type RouteStop } from '../../lib/route'
import { isNativeApp } from '../../platform/native'

/**
 * 하루 동선 지도 (Leaflet + 무료 OpenStreetMap 지도 그림)
 * 이 파일은 지도를 볼 때만 따로 불러온다 (React.lazy). 앱을 처음 열 때 무게는 그대로다.
 */
interface Props {
  points: RoutePoint[]
  stops: RouteStop[]
  /** false 면 손으로 움직일 수 없는 작은 그림 (대시보드 위젯) */
  interactive?: boolean
  /** 고른 머문 곳 (번호) */
  focus?: number | null
  /** 점이 하나도 없을 때 보여 줄 곳 (마지막으로 있던 곳). 없으면 서울시청 */
  center?: { lat: number; lng: number } | null
  className?: string
}

// 지도 그림: 이 기기에서 OpenStreetMap 에 바로 묻는다. 안 되면(막히거나 오류) Tidy 서버(api/tile.ts)가 대신 받아 온 그림으로 바꾼다.
// (2026-11-23: Tidy 서버만 쓰니 서버 쪽에서 OSM 을 못 받아 지도가 비어 보였다)
const SITE = (import.meta.env.VITE_TIDY_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'
const TILE_SOURCES = [OSM_TILE, `${isNativeApp() ? SITE : ''}/api/tile?z={z}&x={x}&y={y}`]
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
const LINE = '#7c5cff'

function stopIcon(n: number, active: boolean) {
  return L.divIcon({
    className: '',
    html: `<div style="display:flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:9999px;background:${active ? '#f43f5e' : LINE};color:#fff;font:700 12px Pretendard,sans-serif;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)">${n}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

export default function RouteMap({ points, stops, interactive = true, focus = null, center = null, className = '' }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)

  // 지도 틀은 한 번만
  useEffect(() => {
    if (!el.current) return
    const m = L.map(el.current, {
      zoomControl: interactive,
      dragging: interactive,
      touchZoom: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: false,
      keyboard: false,
      attributionControl: true,
      center: [37.5665, 126.978],
      zoom: 12,
    })
    m.attributionControl.setPrefix(false)
    const tiles = L.tileLayer(TILE_SOURCES[0], { attribution: ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(m)
    // 그림이 한 장도 안 오고 오류만 나면 다음 곳에서 받는다
    let source = 0
    let loaded = false
    let errors = 0
    tiles.on('tileload', () => {
      loaded = true
    })
    tiles.on('tileerror', () => {
      errors++
      if (loaded || errors < 2 || source >= TILE_SOURCES.length - 1) return
      source++
      errors = 0
      tiles.setUrl(TILE_SOURCES[source])
    })
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    // 위젯 크기가 바뀌면 (편집 중 크기 바꾸기) 지도도 맞춘다
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(el.current)
    return () => {
      ro.disconnect()
      m.remove()
      map.current = null
    }
  }, [interactive])

  // 선 · 점 다시 그리기
  useEffect(() => {
    const m = map.current
    const g = layer.current
    if (!m || !g) return
    g.clearLayers()
    if (points.length === 0) {
      if (center) m.setView([center.lat, center.lng], 15, { animate: false })
      return
    }
    const latlngs = points.map((p) => L.latLng(p.lat, p.lng))
    // 테두리 한 줄 + 빠르기별 색 조각 (걷기 초록 → 차 빨강)
    // 테두리는 다크 모드면 어둡게 (index.css .tidy-route-outline)
    const line = drawPoints(points)
    L.polyline(smoothLine(line), { color: '#fff', weight: 7, opacity: 0.9, lineJoin: 'round', lineCap: 'round', className: 'tidy-route-outline' }).addTo(g)
    for (const piece of speedPieces(line, true)) L.polyline(piece.points, { color: piece.color, weight: 4, opacity: 1, lineJoin: 'round', lineCap: 'round', smoothFactor: 1.5 }).addTo(g)
    // 시작(초록) · 끝(빨강)
    L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1 }).addTo(g)
    if (latlngs.length > 1) L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: '#fff', weight: 3, fillColor: '#ef4444', fillOpacity: 1 }).addTo(g)
    stops.forEach((s, i) => L.marker([s.lat, s.lng], { icon: stopIcon(i + 1, focus === i), interactive: false, keyboard: false }).addTo(g))
    const bounds = L.latLngBounds(latlngs)
    stops.forEach((s) => bounds.extend([s.lat, s.lng]))
    if (focus != null && stops[focus]) m.setView([stops[focus].lat, stops[focus].lng], 16, { animate: interactive })
    else m.fitBounds(bounds, { padding: interactive ? [32, 32] : [18, 18], maxZoom: 16, animate: false })
  }, [points, stops, focus, interactive, center])

  // 다크 모드면 지도 그림도 어둡게 (index.css .tidy-map). 그림이 오기 전에도 바탕색
  return <div ref={el} className={`tidy-map isolate z-0 overflow-hidden ${interactive ? '' : 'pointer-events-none'} ${className}`} />
}

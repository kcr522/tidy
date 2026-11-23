import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import { MAX_ZOOM } from '../../lib/mapTile'
import type { RoutePoint, RouteStop } from '../../lib/route'
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
  className?: string
}

// 지도 그림은 Tidy 서버가 OpenStreetMap 에서 받아 캐시해 둔 것 (src/lib/mapTile.ts, api/tile.ts). 폰 앱은 Tidy 사이트 주소로
const SITE = (import.meta.env.VITE_TIDY_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'
const TILE = `${isNativeApp() ? SITE : ''}/api/tile?z={z}&x={x}&y={y}`
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

export default function RouteMap({ points, stops, interactive = true, focus = null, className = '' }: Props) {
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
    L.tileLayer(TILE, { attribution: ATTRIBUTION, maxZoom: MAX_ZOOM }).addTo(m)
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
    if (points.length === 0) return
    const latlngs = points.map((p) => L.latLng(p.lat, p.lng))
    L.polyline(latlngs, { color: '#fff', weight: 7, opacity: 0.9, lineJoin: 'round' }).addTo(g)
    L.polyline(latlngs, { color: LINE, weight: 4, opacity: 0.95, lineJoin: 'round' }).addTo(g)
    // 시작 · 지금(마지막) 위치
    L.circleMarker(latlngs[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#10b981', fillOpacity: 1 }).addTo(g)
    if (latlngs.length > 1) L.circleMarker(latlngs[latlngs.length - 1], { radius: 7, color: '#fff', weight: 3, fillColor: '#3b82f6', fillOpacity: 1 }).addTo(g)
    stops.forEach((s, i) => L.marker([s.lat, s.lng], { icon: stopIcon(i + 1, focus === i), interactive: false, keyboard: false }).addTo(g))
    const bounds = L.latLngBounds(latlngs)
    stops.forEach((s) => bounds.extend([s.lat, s.lng]))
    if (focus != null && stops[focus]) m.setView([stops[focus].lat, stops[focus].lng], 16, { animate: interactive })
    else m.fitBounds(bounds, { padding: interactive ? [32, 32] : [18, 18], maxZoom: 16, animate: false })
  }, [points, stops, focus, interactive])

  // 지도 그림이 오기 전(느린 인터넷 · 오프라인)에도 밝은 바탕
  return <div ref={el} style={{ background: '#eef1f5' }} className={`isolate z-0 overflow-hidden ${interactive ? '' : 'pointer-events-none'} ${className}`} />
}

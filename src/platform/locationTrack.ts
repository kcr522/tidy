import { Capacitor, registerPlugin } from '@capacitor/core'
import { distanceM, type RoutePoint } from '../lib/route'
import { routeStore } from '../lib/routeStore'

/** 안드로이드 쪽 LocationTrackPlugin.java + LocationTrackService.java */
interface LocationTrackPlugin {
  status(): Promise<{ on: boolean; granted: boolean; gps: boolean }>
  start(): Promise<{ on: boolean; granted: boolean }>
  stop(): Promise<void>
  resume(): Promise<{ on: boolean }>
  take(): Promise<{ points: RoutePoint[] }>
}

const LocationTrack = registerPlugin<LocationTrackPlugin>('LocationTrack')

/** 뒤에서도 계속 위치를 남기는 안드로이드 앱 */
export const nativeTrack = (): boolean => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocationTrack')

/** 웹 · 컴퓨터: Tidy 창(탭)이 열려 있는 동안만 기록 (사용자 요청 2026-11-23) */
export const webTrack = (): boolean => !nativeTrack() && !Capacitor.isNativePlatform() && typeof navigator !== 'undefined' && 'geolocation' in navigator

/** 이동 기록을 켤 수 있는 기기인지 */
export const trackAvailable = (): boolean => nativeTrack() || webTrack()

// ---- 웹 · 컴퓨터 기록 ----
const WEB_KEY = 'tidy.route.webOn'
const WEB_EVERY = 2 * 60 * 1000
const WEB_MOVE_M = 40
let webWatch: number | null = null
let webTimer: number | null = null
let webLast: RoutePoint | null = null

function webOn(): boolean {
  try {
    return localStorage.getItem(WEB_KEY) === '1'
  } catch {
    return false
  }
}

function setWebOn(on: boolean) {
  try {
    if (on) localStorage.setItem(WEB_KEY, '1')
    else localStorage.removeItem(WEB_KEY)
  } catch {
    // 못 남기면 다음에 열 때 꺼진 채로 보인다
  }
}

const toPoint = (p: GeolocationPosition): RoutePoint => ({ t: p.timestamp || Date.now(), lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) })

/** 폰과 같은 규칙: 2분마다 또는 40m 넘게 움직였을 때만 남긴다. 컴퓨터 위치(와이파이)는 1km보다 흐리면 버린다 */
function webKeep(p: RoutePoint) {
  if (p.acc > 1000) return
  if (webLast && p.t - webLast.t < WEB_EVERY && distanceM(webLast, p) < WEB_MOVE_M) return
  webLast = p
  void routeStore.add([p]).catch(() => 0)
}

function webStart() {
  if (webWatch != null || !webTrack()) return
  const opts: PositionOptions = { enableHighAccuracy: true, maximumAge: 60000, timeout: 30000 }
  webWatch = navigator.geolocation.watchPosition((p) => webKeep(toPoint(p)), () => undefined, opts)
  // 컴퓨터는 움직이지 않으면 watch 가 조용하니 2분마다 한 번 직접 묻는다
  webTimer = window.setInterval(() => {
    if (document.visibilityState === 'hidden') return
    navigator.geolocation.getCurrentPosition((p) => webKeep(toPoint(p)), () => undefined, opts)
  }, WEB_EVERY)
}

function webStop() {
  if (webWatch != null) navigator.geolocation.clearWatch(webWatch)
  if (webTimer != null) window.clearInterval(webTimer)
  webWatch = null
  webTimer = null
  webLast = null
}

async function webGranted(): Promise<boolean> {
  try {
    const r = await navigator.permissions.query({ name: 'geolocation' })
    return r.state !== 'denied'
  } catch {
    return true
  }
}

export interface TrackStatus {
  on: boolean
  granted: boolean
  gps: boolean
}

export async function trackStatus(): Promise<TrackStatus | null> {
  if (webTrack()) return { on: webOn() && webWatch != null, granted: await webGranted(), gps: true }
  if (!trackAvailable()) return null
  try {
    return await LocationTrack.status()
  } catch {
    return null
  }
}

/** 켜기. 처음이면 위치 권한을 묻는다. granted=false 면 사용자가 거절한 것 */
export async function startTracking(): Promise<{ on: boolean; granted: boolean }> {
  if (webTrack()) {
    try {
      // 처음이면 브라우저가 위치 허용을 묻는다. 첫 위치는 바로 남긴다
      webKeep(await currentPoint())
    } catch (e) {
      if (e instanceof Error && e.message.includes('허용')) return { on: false, granted: false }
    }
    setWebOn(true)
    webStart()
    return { on: true, granted: true }
  }
  if (!trackAvailable()) return { on: false, granted: false }
  return LocationTrack.start()
}

export async function stopTracking(): Promise<void> {
  if (webTrack()) {
    setWebOn(false)
    webStop()
    return
  }
  if (trackAvailable()) await LocationTrack.stop()
}

/** 켜 둔 상태면 서비스가 살아 있게 (앱을 열 때마다) */
export async function resumeTracking(): Promise<boolean> {
  if (webTrack()) {
    if (!webOn() || !(await webGranted())) return false
    webStart()
    return true
  }
  if (!trackAvailable()) return false
  try {
    return (await LocationTrack.resume()).on
  } catch {
    return false
  }
}

/** 폰이 쌓아 둔 위치를 가져온다 (가져간 것은 폰 쪽에서 지워진다) */
export async function takePoints(): Promise<RoutePoint[]> {
  if (!nativeTrack()) return []
  try {
    return (await LocationTrack.take()).points ?? []
  } catch {
    return []
  }
}

/** 지금 위치 한 번 (웹 · 컴퓨터 · 폰 모두). 못 잡으면 이유를 글로 던진다 */
export function currentPoint(): Promise<RoutePoint> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('이 기기에서는 위치를 알 수 없어요'))
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ t: p.timestamp || Date.now(), lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy || 0) }),
      (e) => reject(new Error(e.code === e.PERMISSION_DENIED ? '위치 권한을 허용해 주세요' : '위치를 잡지 못했어요. 잠시 뒤 다시 해 주세요')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

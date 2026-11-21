import { Capacitor, registerPlugin } from '@capacitor/core'
import type { RoutePoint } from '../lib/route'

/** 안드로이드 쪽 LocationTrackPlugin.java + LocationTrackService.java */
interface LocationTrackPlugin {
  status(): Promise<{ on: boolean; granted: boolean; gps: boolean }>
  start(): Promise<{ on: boolean; granted: boolean }>
  stop(): Promise<void>
  resume(): Promise<{ on: boolean }>
  take(): Promise<{ points: RoutePoint[] }>
}

const LocationTrack = registerPlugin<LocationTrackPlugin>('LocationTrack')

/** 뒤에서 계속 위치를 남기는 건 안드로이드 앱만 (웹 · 컴퓨터는 열려 있을 때 한 번씩만) */
export const trackAvailable = (): boolean => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('LocationTrack')

export interface TrackStatus {
  on: boolean
  granted: boolean
  gps: boolean
}

export async function trackStatus(): Promise<TrackStatus | null> {
  if (!trackAvailable()) return null
  try {
    return await LocationTrack.status()
  } catch {
    return null
  }
}

/** 켜기. 처음이면 위치 권한을 묻는다. granted=false 면 사용자가 거절한 것 */
export async function startTracking(): Promise<{ on: boolean; granted: boolean }> {
  if (!trackAvailable()) return { on: false, granted: false }
  return LocationTrack.start()
}

export async function stopTracking(): Promise<void> {
  if (trackAvailable()) await LocationTrack.stop()
}

/** 켜 둔 상태면 서비스가 살아 있게 (앱을 열 때마다) */
export async function resumeTracking(): Promise<boolean> {
  if (!trackAvailable()) return false
  try {
    return (await LocationTrack.resume()).on
  } catch {
    return false
  }
}

/** 폰이 쌓아 둔 위치를 가져온다 (가져간 것은 폰 쪽에서 지워진다) */
export async function takePoints(): Promise<RoutePoint[]> {
  if (!trackAvailable()) return []
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

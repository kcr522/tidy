import { useEffect, useState } from 'react'
import { addWidgetEverywhere } from '../lib/dashLayout'
import { todayKey } from '../lib/date'
import { routeStore } from '../lib/routeStore'
import { resumeTracking, startTracking, stopTracking, takePoints, trackAvailable, trackStatus, webTrack, type TrackStatus } from '../platform/locationTrack'

const EVENT = 'tidy-route-track'
/** 'off' = 사용자가 직접 끔, 'denied' = 자동으로 켜려다 위치 권한을 거절당함. 둘 다 아니면 열 때 저절로 켠다 */
const AUTO_KEY = 'tidy.route.auto'

function autoPref(): string | null {
  try {
    return localStorage.getItem(AUTO_KEY)
  } catch {
    return 'off'
  }
}

function setAutoPref(v: 'off' | 'denied' | null) {
  try {
    if (v) localStorage.setItem(AUTO_KEY, v)
    else localStorage.removeItem(AUTO_KEY)
  } catch {
    // 못 남기면 다음에 또 묻는다
  }
}

/** 자동 이동 기록 (사용자 요청 2026-11-23): 끄지 않았으면 앱 · 웹을 열 때 저절로 기록을 켠다 */
async function autoStart() {
  if (autoPref()) return
  const s = await trackStatus()
  if (!s || s.on) return
  const r = await startTracking().catch(() => null)
  if (r && !r.granted) setAutoPref('denied')
  if (r?.on) addWidgetEverywhere('route')
  window.dispatchEvent(new Event(EVENT))
}

/** 폰이 쌓아 둔 위치를 앱 DB 로 옮기고, 오래된 기록을 지운다 */
export async function pullRoutePoints(): Promise<number> {
  const points = await takePoints()
  const n = await routeStore.add(points).catch(() => 0)
  await routeStore.prune(todayKey()).catch(() => 0)
  return n
}

/** 안드로이드 앱: 열 때 · 다시 볼 때 이동 기록을 가져오고, 켜 둔 기록이 멈춰 있으면 다시 시작 */
export function useRouteTracking() {
  useEffect(() => {
    if (!trackAvailable()) return
    const run = () => {
      void pullRoutePoints()
      void resumeTracking().then(() => autoStart())
    }
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])
}

/** 이동 기록 켜짐 상태 + 켜고 끄기 (설정 · 이동 기록 화면에서 같이 쓴다) */
export function useTrackSwitch() {
  const [status, setStatus] = useState<TrackStatus | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let alive = true
    const load = () => void trackStatus().then((s) => alive && setStatus(s))
    load()
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener(EVENT, load)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener(EVENT, load)
    }
  }, [])

  /** 켜기 · 끄기. 돌려주는 글은 사용자에게 보여 줄 안내 (없으면 null) */
  async function toggle(): Promise<string | null> {
    if (!status || busy) return null
    setBusy(true)
    try {
      if (status.on) {
        await stopTracking()
        setAutoPref('off')
        await pullRoutePoints()
        window.dispatchEvent(new Event(EVENT))
        return '이동 기록을 껐어요'
      }
      const r = await startTracking()
      setAutoPref(null)
      window.dispatchEvent(new Event(EVENT))
      if (!r.granted) return webTrack() ? '위치 권한을 허용해야 기록할 수 있어요. 주소창 왼쪽 자물쇠 > 위치에서 켤 수 있어요' : '위치 권한을 허용해야 기록할 수 있어요. 폰 설정 > 애플리케이션 > Tidy > 권한에서 켤 수 있어요'
      if (!r.on) return '기록을 시작하지 못했어요. 다시 해 주세요'
      addWidgetEverywhere('route')
      return webTrack() ? '이동 기록을 켰어요. Tidy 창이 열려 있는 동안 위치를 남겨요' : '이동 기록을 켰어요. 대시보드 이동 기록 위젯에서 볼 수 있어요'
    } catch {
      return '바꾸지 못했어요. 다시 해 주세요'
    } finally {
      setBusy(false)
    }
  }

  return { available: trackAvailable(), web: webTrack(), status, busy, toggle }
}

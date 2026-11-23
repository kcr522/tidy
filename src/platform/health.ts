import { Capacitor } from '@capacitor/core'
import { parseDateKey } from '../lib/date'

/**
 * 워치 걸음 수 · 걸은 거리 (사용자 요청 2026-11-23)
 * 갤럭시 워치 → 삼성 헬스 → 안드로이드 헬스 커넥트에 모인 걸음 수 · 거리를 읽기만 한다 (@capgo/capacitor-health).
 * 폰 앱에서만 된다. 웹 · 컴퓨터는 헬스 커넥트에 닿을 수 없다.
 */

const KEY = 'tidy.health.connected'

export interface DaySteps {
  steps: number
  /** 걸은 거리 (km, 소수 한 자리). 헬스 커넥트에 거리가 없으면 null */
  km: number | null
}

export const healthSupported = (): boolean => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Health')

// 플러그인 프록시를 async 함수에서 바로 돌려주면 await가 .then()을 찾다가 'not implemented' 오류가 난다. 객체로 감싼다
const plugin = async () => ({ Health: (await import('@capgo/capacitor-health')).Health })

/** 사용자가 연결을 켰는지 (이 기기에만 기억) */
export function healthConnected(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

function remember(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1')
    else localStorage.removeItem(KEY)
  } catch {
    // 저장을 못 하면 다음에 다시 묻는다
  }
  window.dispatchEvent(new Event('tidy-health'))
}

export type HealthConnectResult = 'ok' | 'denied' | 'unavailable'

/** 헬스 커넥트 연결: 걸음 수 · 거리 읽기를 허락받는다 */
export async function connectHealth(): Promise<HealthConnectResult> {
  if (!healthSupported()) return 'unavailable'
  const { Health } = await plugin()
  const avail = await Health.isAvailable().catch(() => ({ available: false }))
  if (!avail.available) return 'unavailable'
  const r = await Health.requestAuthorization({ read: ['steps', 'distance'] })
  const ok = r.readAuthorized.includes('steps')
  remember(ok)
  return ok ? 'ok' : 'denied'
}

export function disconnectHealth() {
  remember(false)
}

/** 헬스 커넥트 화면 열기 (권한 끄기 · 삼성 헬스 연결 확인) */
export async function openHealthSettings(): Promise<void> {
  if (!healthSupported()) return
  await (await plugin()).Health.openHealthConnectSettings().catch(() => undefined)
}

/** 그날(YYYY-MM-DD) 걸음 수 · 거리. 연결 안 했거나 못 읽으면 null */
export async function daySteps(date: string): Promise<DaySteps | null> {
  if (!healthSupported() || !healthConnected()) return null
  const start = parseDateKey(date)
  const next = new Date(start)
  next.setDate(next.getDate() + 1)
  const end = new Date(Math.min(next.getTime(), Date.now()))
  if (end <= start) return null
  const range = { startDate: start.toISOString(), endDate: end.toISOString(), bucket: 'day' as const, aggregation: 'sum' as const }
  try {
    const { Health } = await plugin()
    const [steps, dist] = await Promise.all([
      Health.queryAggregated({ dataType: 'steps', ...range }),
      Health.queryAggregated({ dataType: 'distance', ...range }).catch(() => null),
    ])
    const total = steps.samples.reduce((s, x) => s + (x.value || 0), 0)
    const meters = dist ? dist.samples.reduce((s, x) => s + (x.value || 0), 0) : null
    return { steps: Math.round(total), km: meters == null || meters === 0 ? null : Math.round(meters / 100) / 10 }
  } catch {
    return null
  }
}

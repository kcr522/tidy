import { useEffect, useState } from 'react'
import { daySteps, healthConnected, healthSupported, type DaySteps } from '../platform/health'

/** 그날 워치 걸음 수 · 거리 (헬스 커넥트). 폰 앱에서 연결했을 때만, 보이는 동안 2분마다 새로 읽는다 */
export function useDaySteps(date: string): DaySteps | null {
  const [value, setValue] = useState<{ date: string; v: DaySteps | null } | null>(null)
  useEffect(() => {
    if (!healthSupported()) return
    let alive = true
    const load = () => {
      if (!healthConnected()) return setValue({ date, v: null })
      void daySteps(date).then((v) => alive && setValue({ date, v }))
    }
    load()
    const timer = window.setInterval(() => document.visibilityState === 'visible' && load(), 2 * 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('tidy-health', load)
    return () => {
      alive = false
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('tidy-health', load)
    }
  }, [date])
  return value && value.date === date ? value.v : null
}

/** 8,432 */
export const stepsLabel = (n: number): string => n.toLocaleString('ko-KR')

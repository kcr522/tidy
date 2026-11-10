import { useEffect, useState } from 'react'
import { todayKey } from '../lib/date'

/** 다음 자정까지 남은 밀리초 (+1초 여유) */
function msUntilMidnight(now = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return next.getTime() - now.getTime() + 1000
}

/**
 * 오늘 날짜 (YYYY-MM-DD). 자정이 지나거나 앱이 다시 보일 때 새로 계산한다.
 * 폰에서 앱을 며칠 켜 둔 채 다시 열어도 '오늘'과 '이번 달'이 맞게 바뀐다. (Edge Cases: 월이 바뀔 때)
 */
export function useToday(): string {
  const [today, setToday] = useState(() => todayKey())

  useEffect(() => {
    const refresh = () => setToday(todayKey())
    let timer = window.setTimeout(function tick() {
      refresh()
      timer = window.setTimeout(tick, msUntilMidnight())
    }, msUntilMidnight())
    const onVisible = () => document.visibilityState === 'visible' && refresh()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}

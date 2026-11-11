import { useEffect } from 'react'
import { loadGoogleCal, REFRESH_MS, syncGoogleCalendar } from '../platform/googleCalendar'

/** 구글 캘린더를 연결해 두었으면, 앱을 열거나 날짜가 바뀔 때 6시간이 지났으면 조용히 다시 가져온다 */
export function useGoogleCalendarSync(today: string) {
  useEffect(() => {
    const s = loadGoogleCal()
    if (!s) return
    const last = s.last ? Date.parse(s.last) : 0
    if (Date.now() - last < REFRESH_MS) return
    const timer = window.setTimeout(() => void syncGoogleCalendar(s.url).catch(() => undefined), 4000)
    return () => window.clearTimeout(timer)
  }, [today])
}

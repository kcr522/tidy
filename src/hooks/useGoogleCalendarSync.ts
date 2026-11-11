import { useEffect } from 'react'
import { loadGoogleCals, REFRESH_MS, syncGoogleCalendar } from '../platform/googleCalendar'

/** 구글 캘린더를 연결해 두었으면, 앱을 열거나 날짜가 바뀔 때 6시간이 지난 캘린더를 조용히 다시 가져온다 */
export function useGoogleCalendarSync(today: string) {
  useEffect(() => {
    const due = loadGoogleCals().filter((c) => Date.now() - (c.last ? Date.parse(c.last) : 0) >= REFRESH_MS)
    if (!due.length) return
    const timer = window.setTimeout(async () => {
      for (const c of due) await syncGoogleCalendar(c).catch(() => undefined)
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [today])
}

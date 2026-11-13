import { useEffect } from 'react'
import { loadGoogleCals, REFRESH_MS, syncGoogleCalendar } from '../platform/googleCalendar'

/**
 * 구글 캘린더를 연결해 두었으면, 앱을 열거나 다시 볼 때, 날짜가 바뀔 때, 켜 둔 동안 10분마다
 * 10분이 지난 캘린더를 조용히 다시 가져온다
 */
export function useGoogleCalendarSync(today: string) {
  useEffect(() => {
    let running = false
    const run = async () => {
      if (running) return
      const due = loadGoogleCals().filter((c) => Date.now() - (c.last ? Date.parse(c.last) : 0) >= REFRESH_MS)
      if (!due.length) return
      running = true
      try {
        for (const c of due) await syncGoogleCalendar(c).catch(() => undefined)
      } finally {
        running = false
      }
    }
    const timer = window.setTimeout(run, 4000)
    const every = window.setInterval(run, REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [today])
}

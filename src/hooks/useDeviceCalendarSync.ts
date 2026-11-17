import { liveQuery } from 'dexie'
import { useEffect } from 'react'
import { db } from '../db/database'
import { DEVICE_REFRESH_MS, deviceCalAvailable, loadDeviceCal, onDeviceCalChange, pushDeviceCalendar, syncDeviceCalendar } from '../platform/deviceCalendar'

/**
 * 삼성 캘린더(폰 캘린더) 연동을 켜 두었으면 (폰 앱만)
 * - 앱을 열거나 다시 볼 때, 날짜가 바뀔 때, 켜 둔 동안 5분마다 폰 일정을 다시 읽는다 (폰 안이라 빠르다)
 * - Tidy 일정이 바뀌면 잠깐 모았다가 폰 Tidy 캘린더에 넣는다 (할 일은 안 보낸다)
 */
export function useDeviceCalendarSync(today: string) {
  useEffect(() => {
    if (!deviceCalAvailable()) return
    const run = () => void syncDeviceCalendar()
    const timer = window.setTimeout(run, 3000)
    const every = window.setInterval(run, DEVICE_REFRESH_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') run()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      window.clearInterval(every)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [today])

  useEffect(() => {
    if (!deviceCalAvailable()) return
    let timer = 0
    let sub: { unsubscribe(): void } | null = null
    const start = () => {
      sub?.unsubscribe()
      sub = null
      if (!loadDeviceCal()?.push) return
      let first = true
      // Tidy 에서 만든 일정이 바뀌면 다시 불린다 (가져온 일정만 바뀐 건 무시)
      sub = liveQuery(async () => {
        const own = await db.events.filter((e) => !e.source).toArray()
        return own.map((e) => `${e.id}|${e.updatedAt}`).join(',')
      }).subscribe({
        next: () => {
          if (first) {
            first = false
            return
          }
          window.clearTimeout(timer)
          timer = window.setTimeout(() => void pushDeviceCalendar().catch(() => undefined), 2000)
        },
      })
    }
    start()
    const off = onDeviceCalChange(() => {
      if (!!loadDeviceCal()?.push !== !!sub) start()
    })
    return () => {
      off()
      sub?.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])
}

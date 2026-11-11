import { liveQuery } from 'dexie'
import { useEffect } from 'react'
import { db } from '../db/database'
import { loadGooglePush, onGooglePushChange, pushNow } from '../platform/googleCalendarPush'

/**
 * 구글 캘린더 보내기를 연결해 두었으면, 일정이나 할 일이 바뀔 때마다 잠깐 모았다가 구글에 보낸다.
 * 앱을 열 때도 한 번 보낸다. 창은 띄우지 않는다 (권한이 없으면 설정에 안내가 뜬다).
 */
export function useGooglePush() {
  useEffect(() => {
    let timer = 0
    let sub: { unsubscribe(): void } | null = null
    const schedule = (ms: number) => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void pushNow(false), ms)
    }
    const start = () => {
      sub?.unsubscribe()
      sub = null
      if (!loadGooglePush()) return
      let first = true
      // 일정이나 할 일이 바뀌면 다시 불린다
      sub = liveQuery(async () => {
        const [events, todos] = await Promise.all([db.events.toArray(), db.todos.toArray()])
        return events.length + todos.length
      }).subscribe({
        next: () => {
          schedule(first ? 5000 : 3000)
          first = false
        },
      })
    }
    start()
    const off = onGooglePushChange(() => {
      if (!loadGooglePush()) {
        sub?.unsubscribe()
        sub = null
      } else if (!sub) start()
    })
    return () => {
      off()
      sub?.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])
}

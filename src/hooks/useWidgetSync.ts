import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../db/database'
import type { Todo } from '../db/types'
import { loadLock, onLockChange } from '../lib/appLock'
import { buildWidgetSummary, widgetRange } from '../lib/widgetSummary'
import { isNativeApp } from '../platform/native'
import { syncWidget } from '../platform/widget'

/** 갤럭시 홈 화면 위젯: 할 일이나 지출이 바뀌면 위젯 요약을 새로 보낸다 (폰 앱에서만) */
export function useWidgetSync(todos: Todo[] | undefined, today: string) {
  const native = isNativeApp()
  const [locked, setLocked] = useState(() => loadLock() !== null)
  useEffect(() => onLockChange(() => setLocked(loadLock() !== null)), [])

  const [from, to] = widgetRange(today)
  const transactions = useLiveQuery(
    () => (native ? db.transactions.where('date').between(from, to, true, false).toArray() : []),
    [native, from, to],
  )

  useEffect(() => {
    if (!native || !todos || !transactions) return
    // 할 일을 연달아 체크할 때 매번 보내지 않도록 잠깐 모았다가 보낸다
    const timer = window.setTimeout(() => void syncWidget(buildWidgetSummary(todos, transactions, today, locked)), 400)
    return () => window.clearTimeout(timer)
  }, [native, todos, transactions, today, locked])
}

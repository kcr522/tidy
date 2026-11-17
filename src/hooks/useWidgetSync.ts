import { useLiveQuery } from 'dexie-react-hooks'
import { addDays, format } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/database'
import type { Todo } from '../db/types'
import { loadLock, onLockChange } from '../lib/appLock'
import { parseDateKey } from '../lib/date'
import { buildWidgetSummary, widgetRange, WIDGET_DAYS, type WidgetExtras } from '../lib/widgetSummary'
import { loadWidgetOpacity, onWidgetSettingsChange } from '../lib/widgetSettings'
import { isNativeApp } from '../platform/native'
import { syncWidget } from '../platform/widget'

/** 위젯 요약에 넣을 일정, 습관, 예산, 투명도. enabled가 false면 읽지 않는다 */
export function useWidgetExtras(today: string, enabled = true): WidgetExtras | undefined {
  const [opacity, setOpacity] = useState(loadWidgetOpacity)
  useEffect(() => onWidgetSettingsChange(() => setOpacity(loadWidgetOpacity())), [])
  const last = format(addDays(parseDateKey(today), WIDGET_DAYS - 1), 'yyyy-MM-dd')
  // 달력 위젯이 이번 달과 다음 달을 쓰므로 일정 · 일기는 그 범위로 읽는다
  const [from, to] = widgetRange(today)
  const data = useLiveQuery(async () => {
    if (!enabled) return null
    const [events, habits, checks, budgets, diaries, memos, memoFolders] = await Promise.all([
      db.events.where('startDate').below(to).filter((e) => e.endDate >= from).toArray(),
      db.habits.toArray(),
      db.habitChecks.where('date').between(today, last, true, true).toArray(),
      db.budgets.toArray(),
      db.diaries.where('date').between(from, to, true, false).toArray(),
      db.memos.toArray(),
      db.memoFolders.toArray(),
    ])
    return { events, habits, checks, budgets, diaries: diaries.map((d) => ({ date: d.date, color: d.color })), memos, memoFolders }
  }, [enabled, today, last, from, to])
  return useMemo(() => (data ? { ...data, opacity } : undefined), [data, opacity])
}

/** 갤럭시 홈 화면 위젯: 할 일, 지출, 일정, 습관, 메모가 바뀌면 위젯 요약을 새로 보낸다 (폰 앱에서만) */
export function useWidgetSync(todos: Todo[] | undefined, today: string) {
  const native = isNativeApp()
  const [locked, setLocked] = useState(() => loadLock() !== null)
  useEffect(() => onLockChange(() => setLocked(loadLock() !== null)), [])

  const [from, to] = widgetRange(today)
  const transactions = useLiveQuery(
    () => (native ? db.transactions.where('date').between(from, to, true, false).toArray() : []),
    [native, from, to],
  )
  const extras = useWidgetExtras(today, native)

  useEffect(() => {
    if (!native || !todos || !transactions || !extras) return
    // 할 일을 연달아 체크할 때 매번 보내지 않도록 잠깐 모았다가 보낸다
    const timer = window.setTimeout(() => void syncWidget(buildWidgetSummary(todos, transactions, today, locked, extras)), 400)
    return () => window.clearTimeout(timer)
  }, [native, todos, transactions, today, locked, extras])
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo } from 'react'
import { cleanPoints, summarize, type RoutePoint, type RouteSummary } from '../lib/route'
import { routeStore } from '../lib/routeStore'

/** 그날 동선 (점 · 머문 곳 · 거리). 아직 못 읽었으면 undefined */
export function useDayRoute(date: string): { points: RoutePoint[]; summary: RouteSummary } | undefined {
  const rows = useLiveQuery(() => routeStore.listByDate(date).then((list) => ({ date, list })), [date])
  return useMemo(() => {
    if (!rows || rows.date !== date) return undefined
    return { points: cleanPoints(rows.list), summary: summarize(rows.list) }
  }, [rows, date])
}

import { Footprints, MapPin, Route } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { useDayRoute } from '../../hooks/useDayRoute'
import { stepsLabel, useDaySteps } from '../../hooks/useDaySteps'
import { clock, distanceLabel } from '../../lib/route'
import { trackAvailable } from '../../platform/locationTrack'
import type { WidgetBox } from './WidgetGrid'

const RouteMap = lazy(() => import('../route/RouteMap'))

/** 대시보드 "이동 기록" 위젯: 오늘 다닌 길을 작은 지도로. 누르면 크게 보는 화면 */
export default function RouteWidget({ today, box }: { today: string; box: WidgetBox }) {
  const day = useDayRoute(today)
  const steps = useDaySteps(today)
  const s = day?.summary
  const has = (day?.points.length ?? 0) > 0
  const tall = box.py >= 230

  return (
    <Link to="/route" className="card theme-main relative flex h-full flex-col overflow-hidden transition active:scale-[0.98]">
      <div className="flex items-center gap-1.5 px-4 pt-3.5 pb-2 text-[15px] font-bold text-slate-800">
        <Route className="size-4 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate">이동 기록</span>
        {steps ? (
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-500">
            <Footprints className="size-3.5 text-emerald-500" aria-hidden />
            {stepsLabel(steps.steps)}걸음
          </span>
        ) : (
          has && s && <span className="shrink-0 text-xs font-semibold text-slate-500">{distanceLabel(s.km)}</span>
        )}
      </div>
      {has && day ? (
        <>
          <div className="relative min-h-0 flex-1">
            <Suspense fallback={<div className="h-full bg-slate-100" />}>
              <RouteMap points={day.points} stops={day.summary.stops} interactive={false} className="absolute inset-0" />
            </Suspense>
          </div>
          {tall && s && (
            <div className="flex items-center gap-3 px-4 py-2.5 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden />
                머문 곳 {s.stops.length}
              </span>
              {steps && has && <span>{distanceLabel(s.km)}</span>}
              {steps?.km != null && <span>걸은 거리 {distanceLabel(steps.km)}</span>}
              {s.first && s.last && (
                <span>
                  {clock(s.first)} ~ {clock(s.last)}
                </span>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 pb-4 text-center text-xs break-keep text-slate-500">
          <MapPin className="mb-1 size-6 text-slate-300" aria-hidden />
          {trackAvailable() ? '눌러서 이동 기록을 켜면 오늘 다닌 길이 지도에 보여요' : '폰 앱에서 이동 기록을 켜면 그 폰에서 다닌 길이 보여요'}
        </div>
      )}
    </Link>
  )
}

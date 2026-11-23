import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Crosshair, Footprints, MapPin, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '../components/common/Button'
import PageHeader from '../components/common/PageHeader'
import Switch from '../components/common/Switch'
import { useToast } from '../components/common/Toast'
import { useDayRoute } from '../hooks/useDayRoute'
import { stepsLabel, useDaySteps } from '../hooks/useDaySteps'
import { pullRoutePoints, useTrackSwitch } from '../hooks/useRouteTracking'
import { useToday } from '../hooks/useToday'
import { parseDateKey, toDateKey } from '../lib/date'
import { formatDateLabel } from '../lib/format'
import { clock, distanceLabel, durationLabel, KEEP_DAYS } from '../lib/route'
import { routeStore } from '../lib/routeStore'
import { connectHealth, healthConnected, healthSupported } from '../platform/health'
import { currentPoint } from '../platform/locationTrack'

const RouteMap = lazy(() => import('../components/route/RouteMap'))

function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** 이동 기록: 하루 동선을 지도로 크게, 머문 곳과 시간 (사용자 요청 2026-11-21) */
export default function RoutePage() {
  const today = useToday()
  const location = useLocation()
  const [date, setDateRaw] = useState<string>(() => (location.state as { date?: string } | null)?.date ?? today)
  const [focus, setFocus] = useState<number | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [locating, setLocating] = useState(false)
  const setDate = (next: string) => {
    setDateRaw(next)
    setFocus(null)
    setConfirmClear(false)
  }
  const day = useDayRoute(date)
  const steps = useDaySteps(date)
  const latest = useLiveQuery(() => routeStore.latest().then((p) => (p ? { lat: p.lat, lng: p.lng } : null)), [])
  const track = useTrackSwitch()
  const toast = useToast()
  const s = day?.summary
  const has = (day?.points.length ?? 0) > 0
  const oldest = addDays(today, -KEEP_DAYS + 1)

  // 보고 있는 동안 1분마다 폰이 쌓은 위치를 가져온다
  useEffect(() => {
    if (!track.available) return
    void pullRoutePoints()
    const timer = window.setInterval(() => void pullRoutePoints(), 60 * 1000)
    return () => window.clearInterval(timer)
  }, [track.available])

  async function addHere() {
    setLocating(true)
    try {
      const p = await currentPoint()
      await routeStore.add([p])
      setDate(toDateKey(new Date(p.t)))
      toast('지금 위치를 남겼어요')
    } catch (e) {
      toast(e instanceof Error ? e.message : '위치를 잡지 못했어요', 'error')
    } finally {
      setLocating(false)
    }
  }

  async function linkHealth() {
    const r = await connectHealth().catch(() => 'unavailable' as const)
    if (r === 'ok') toast('워치 걸음 수를 연결했어요')
    else if (r === 'denied') toast('걸음 수 읽기를 허락해야 볼 수 있어요', 'error')
    else toast('헬스 커넥트를 쓸 수 없어요. Play 스토어에서 헬스 커넥트를 설치해 주세요', 'error')
  }

  async function toggle() {
    const msg = await track.toggle()
    if (msg) toast(msg, msg.includes('못') || msg.includes('허용') ? 'error' : undefined)
  }

  async function clearDay() {
    await routeStore.clearDate(date)
    setConfirmClear(false)
    toast('이 날 이동 기록을 지웠어요')
  }

  return (
    <>
      <PageHeader title="이동 기록" />

      <div className="mb-3 flex items-center justify-center gap-2">
        <button type="button" onClick={() => setDate(addDays(date, -1))} disabled={date <= oldest} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="전날">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="min-w-32 text-center text-lg font-extrabold">{date === today ? `오늘 · ${formatDateLabel(date)}` : formatDateLabel(date)}</h2>
        <button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="다음 날">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:items-start">
        <section className="card overflow-hidden p-0">
          {/* 기록이 없는 날에도 지도는 보인다 (마지막으로 있던 곳 둘레) */}
          <div className="relative">
            <Suspense fallback={<div className="h-[58dvh] min-h-72 bg-slate-100" />}>
              <RouteMap points={day?.points ?? []} stops={day?.summary.stops ?? []} focus={focus} center={has ? null : (latest ?? null)} className="h-[58dvh] min-h-72" />
            </Suspense>
            {!has && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-[500] flex justify-center px-4">
                <span className="flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-card">
                  <MapPin className="size-3.5 text-slate-400" aria-hidden />
                  {day === undefined ? '불러오는 중…' : date === today ? '오늘은 아직 남은 위치가 없어요' : '이 날은 남은 위치가 없어요'}
                </span>
              </div>
            )}
          </div>
          {has && s && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 text-center">
              <Num label="움직인 거리" value={distanceLabel(s.km)} />
              <Num label="머문 곳" value={`${s.stops.length}곳`} />
              <Num label="기록 시간" value={s.first && s.last ? `${clock(s.first)}~${clock(s.last)}` : '-'} />
            </div>
          )}
          {/* 워치 걸음 수 · 걸은 거리 (헬스 커넥트, 폰 앱만) */}
          {healthSupported() && (
            <div className="flex items-center gap-3 border-t border-slate-100 px-4 py-3">
              <Footprints className="size-5 shrink-0 text-emerald-500" aria-hidden />
              {steps ? (
                <p className="min-w-0 flex-1 text-[15px] font-extrabold tabular-nums">
                  {stepsLabel(steps.steps)}걸음
                  {steps.km != null && <span className="ml-1.5 font-bold text-slate-500">· {distanceLabel(steps.km)} 걸음</span>}
                  <span className="block text-[11px] font-normal text-slate-400">워치 · 삼성 헬스 (헬스 커넥트)</span>
                </p>
              ) : healthConnected() ? (
                <p className="min-w-0 flex-1 text-sm text-slate-500">걸음 수를 아직 못 읽었어요. 삼성 헬스에서 헬스 커넥트 연결을 켜 주세요</p>
              ) : (
                <>
                  <p className="min-w-0 flex-1 text-sm break-keep text-slate-600">워치 걸음 수 · 걸은 거리도 같이 볼까요?</p>
                  <Button variant="secondary" onClick={linkHealth} className="min-h-9 shrink-0 px-3 text-sm">
                    연결
                  </Button>
                </>
              )}
            </div>
          )}
        </section>

        <div className="grid gap-4">
          {has && s && s.stops.length > 0 && (
            <section className="card overflow-hidden">
              <h2 className="border-b border-slate-100 px-4 py-3 text-[17px] font-bold">머문 곳</h2>
              <ul className="divide-y divide-slate-100">
                {s.stops.map((stop, i) => (
                  <li key={stop.start}>
                    <button type="button" onClick={() => setFocus(focus === i ? null : i)} className={`flex w-full items-center gap-3 px-4 py-3 text-left ${focus === i ? 'bg-brand-50' : ''}`}>
                      <span className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${focus === i ? 'bg-rose-500' : 'bg-[#7c5cff]'}`}>{i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-bold">
                          {clock(stop.start)} ~ {clock(stop.end)}
                        </span>
                        <span className="block text-xs text-slate-500">{durationLabel(stop.end - stop.start)} 머묾</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="card p-5">
            {track.available ? (
              <label className="flex items-center gap-3">
                <span className="flex-1 text-sm">
                  <span className="block font-semibold text-slate-800">이동 기록</span>
                  <span className="block text-xs break-keep text-slate-500">
                    {track.web ? '컴퓨터 · 웹은 Tidy 창이 열려 있는 동안 2분마다 또는 40m 넘게 움직일 때 위치를 남겨요. 열 때마다 저절로 켜져요' : '켜 두면 알림창에 ‘오늘 이동 기록 중’이 보이고, 2분마다 또는 40m 넘게 움직일 때 위치를 남겨요. 앱을 열면 저절로 켜져요'}
                  </span>
                </span>
                <Switch label="이동 기록" on={!!track.status?.on} disabled={track.busy || !track.status} onClick={toggle} />
              </label>
            ) : (
              <p className="text-xs break-keep text-slate-500">이 브라우저는 위치를 알 수 없어요. 하루 동선은 갤럭시 앱에서 기록해 주세요.</p>
            )}
            {track.status?.on && !track.status.gps && <p className="mt-2 text-xs font-semibold text-expense">폰의 위치(GPS)가 꺼져 있어요. 빠른 설정에서 위치를 켜 주세요</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={addHere} disabled={locating} className="min-h-10 flex-1 text-sm">
                <Crosshair className="size-4" aria-hidden />
                {locating ? '위치 찾는 중…' : '지금 위치 남기기'}
              </Button>
              {has &&
                (confirmClear ? (
                  <Button variant="danger" onClick={clearDay} className="min-h-10 flex-1 text-sm">
                    정말 지우기
                  </Button>
                ) : (
                  <Button variant="ghost" onClick={() => setConfirmClear(true)} className="min-h-10 text-sm text-slate-500">
                    <Trash2 className="size-4" aria-hidden />이 날 지우기
                  </Button>
                ))}
            </div>
            <p className="mt-3 text-[11px] break-keep text-slate-400">위치는 이 기기에만 저장되고 구글 동기화 · 백업 파일에 들어가지 않아요. {KEEP_DAYS}일 지난 기록은 저절로 지워져요.</p>
          </section>
        </div>
      </div>
    </>
  )
}

function Num({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="mt-0.5 text-[15px] font-extrabold tabular-nums">{value}</p>
    </div>
  )
}

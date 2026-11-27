import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeftRight, LocateFixed, Pause, Play, RefreshCw, RotateCcw, Smile, Timer } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Diary } from '../../db/types'
import { parseDateKey, toDateKey } from '../../lib/date'
import {
  clockText,
  finish,
  isDone,
  isRunning,
  loadTimer,
  pause,
  reset,
  saveTimer,
  setMinutes,
  setMode,
  start,
  TIMER_EVENT,
  TIMER_PRESETS,
  timeLeft,
  timerRatio,
  timeSpent,
  type TimerState,
} from '../../lib/focusTimer'
import { MOODS, moodOf } from '../../lib/mood'
import { cachedWeather, fetchWeather, loadPlace, nearestCity, savePlace, WEATHER_TTL, weatherLook, weatherTip, type Weather, type WeatherPlace } from '../../lib/weather'
import { askWebNotify, notifyTimerDone, scheduleTimerAlarm } from '../../platform/timerAlarm'
import { currentPoint } from '../../platform/locationTrack'
import { diaryRepo } from '../../repositories/diaryRepo'
import { useToast } from '../common/Toast'
import { WidgetShell } from './MiniWidgets'
import type { WidgetBox } from './WidgetGrid'

/*
 * 대시보드 새 위젯 세 가지 (사용자 요청 2026-11-27): 집중 타이머 · 오늘 기분 · 날씨
 * 폰에서는 기본 배치에 넣지 않고, 편집 > 추가로 넣으면 반 칸(2×2) 작은 타일이 된다.
 * 작은 타일에서도 한 번에 쓸 수 있게 꼭 필요한 것만 보이고, 칸이 커지면 더 보여 준다
 */

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// ───────────── 집중 타이머 ─────────────

export function TimerWidget({ box }: { box: WidgetBox }) {
  const toast = useToast()
  const [s, setS] = useState<TimerState>(loadTimer)
  const [now, setNow] = useState(() => Date.now())
  const running = isRunning(s)
  const roomy = box.py >= 230
  const wide = box.px >= 300

  // 다른 곳(다른 탭 · 위젯)에서 바꾼 것도 따라간다
  useEffect(() => {
    const sync = () => setS(loadTimer())
    window.addEventListener(TIMER_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(TIMER_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const commit = useCallback((next: TimerState) => {
    setS(next)
    saveTimer(next)
    void scheduleTimerAlarm(next.mode === 'timer' ? next.endAt : null)
  }, [])

  // 돌아가는 동안 0.25초마다 다시 그린다
  useEffect(() => {
    if (!running) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [running])

  // 시간이 다 되면 한 번 알린다
  useEffect(() => {
    if (!isDone(s, now)) return
    commit(finish(s))
    notifyTimerDone()
    toast('⏰ 타이머가 끝났어요. 잠깐 쉬어 가요')
  }, [s, now, commit, toast])

  // 멈춰 있으면 시각과 상관없이 남은/흐른 시간이 정해져 있다
  const shown = s.mode === 'timer' ? clockText(timeLeft(s, now)) : clockText(timeSpent(s, now))
  const ratio = timerRatio(s, now)
  const ended = s.mode === 'timer' && s.left === 0 && !running
  const fresh = s.mode === 'timer' ? s.left == null : s.spent === 0 && !running

  function toggle() {
    const at = Date.now()
    setNow(at)
    if (running) return commit(pause(s, at))
    askWebNotify()
    commit(start(ended ? reset(s) : s, at))
  }

  // 작은 타일: 멈춰 있을 때 시간을 누르면 5 → 15 → 25 → 50분
  function cycle() {
    if (s.mode !== 'timer' || running) return
    const mins = s.duration / 60000
    const i = TIMER_PRESETS.findIndex((m) => m === mins)
    commit(setMinutes(TIMER_PRESETS[(i + 1) % TIMER_PRESETS.length]))
  }

  return (
    <WidgetShell className={ended ? 'ring-2 ring-brand-500/60' : ''}>
      <div className="mb-1 flex items-center gap-1.5 text-[15px] font-bold text-slate-800">
        <Timer className="size-4 shrink-0 text-brand-600" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{s.mode === 'timer' ? '집중 타이머' : '스톱워치'}</span>
        <button
          type="button"
          onClick={() => commit(setMode(s, s.mode === 'timer' ? 'stopwatch' : 'timer'))}
          aria-label={s.mode === 'timer' ? '스톱워치로 바꾸기' : '타이머로 바꾸기'}
          title={s.mode === 'timer' ? '스톱워치로' : '타이머로'}
          className="tap -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
        >
          <ArrowLeftRight className="size-3.5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <button
          type="button"
          onClick={cycle}
          disabled={s.mode !== 'timer' || running}
          title={s.mode === 'timer' && !running ? '눌러서 시간 바꾸기' : undefined}
          className={`self-start text-left leading-none font-extrabold tracking-tight tabular-nums ${ended ? 'text-brand-600' : 'text-slate-900'} ${wide || roomy ? 'text-[44px]' : 'text-[32px]'}`}
        >
          {ended ? '끝!' : shown}
        </button>
        {s.mode === 'timer' && (
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-500/10">
            <div className="h-full rounded-full bg-grad transition-[width] duration-300" style={{ width: `${(ended ? 1 : ratio) * 100}%` }} />
          </div>
        )}
        {s.mode === 'timer' && !running && fresh && (roomy || wide) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {TIMER_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => commit(setMinutes(m))}
                className={`tap rounded-full px-2.5 py-1 text-xs font-bold ${s.duration === m * 60000 ? 'bg-grad on-grad' : 'bg-slate-500/10 text-slate-600'}`}
              >
                {m}분
              </button>
            ))}
          </div>
        )}
        {!roomy && !wide && s.mode === 'timer' && !running && fresh && <p className="mt-1.5 text-[11px] text-slate-400">시간을 누르면 바뀌어요</p>}
        {s.mode === 'stopwatch' && <p className="mt-1.5 text-[11px] text-slate-400">{running ? '재는 중' : fresh ? '시작을 눌러요' : '멈춤'}</p>}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? '멈추기' : '시작'}
          className="tap flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-grad text-sm font-bold on-grad"
        >
          {running ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          {(roomy || wide) && (running ? '멈추기' : ended ? '다시' : fresh ? '시작' : '이어서')}
        </button>
        {!fresh && (
          <button type="button" onClick={() => commit(reset(s))} aria-label="처음으로" className="tap flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-500/10 text-slate-600">
            <RotateCcw className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </WidgetShell>
  )
}

// ───────────── 오늘 기분 ─────────────

function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

export function MoodWidget({ today, diary, box }: { today: string; diary: Diary | undefined; box: WidgetBox }) {
  const toast = useToast()
  const picked = moodOf(diary?.mood)
  const roomy = box.py >= 250
  const row = box.px >= 300 && box.py < 200
  const weekStart = addDays(today, -6)
  const recent = useLiveQuery(() => (roomy ? diaryRepo.listBetween(weekStart, today) : Promise.resolve([] as Diary[])), [roomy, weekStart, today])
  const byDay = new Map((recent ?? []).map((d) => [d.date, d.mood]))

  async function pick(key: string) {
    try {
      await diaryRepo.setMood(today, picked?.key === key ? null : key)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  return (
    <WidgetShell>
      <div className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-slate-800">
        <Smile className="size-4 shrink-0 text-amber-500" aria-hidden />
        <span className="min-w-0 flex-1 truncate">오늘 기분</span>
        {picked && <span className="shrink-0 text-xs font-semibold text-slate-500">{picked.label}</span>}
      </div>
      <div className={`grid flex-1 content-center justify-items-center gap-1.5 ${row ? 'grid-cols-6' : 'grid-cols-3'}`}>
        {MOODS.map((m) => {
          const on = picked?.key === m.key
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => pick(m.key)}
              aria-label={m.label}
              aria-pressed={on}
              title={m.label}
              style={on ? { background: m.bg } : undefined}
              className={`tap flex aspect-square w-full max-w-14 items-center justify-center rounded-2xl text-[24px] leading-none transition ${on ? 'scale-105 shadow-sm' : picked ? 'bg-slate-500/5 opacity-45 grayscale-[40%]' : 'bg-slate-500/5'}`}
            >
              {m.emoji}
            </button>
          )
        })}
      </div>
      {roomy && (
        <div className="mt-3 border-t border-slate-100 pt-2.5">
          <p className="mb-1.5 text-[12px] font-bold text-slate-400">최근 일주일</p>
          <div className="flex justify-between text-center text-[11px]">
            {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((k) => {
              const m = moodOf(k === today ? diary?.mood : byDay.get(k))
              return (
                <span key={k} className="flex flex-col items-center gap-0.5">
                  <span className={`flex size-7 items-center justify-center rounded-full text-[16px] ${m ? '' : 'bg-slate-500/10'}`} style={m ? { background: m.bg } : undefined}>
                    {m?.emoji ?? ''}
                  </span>
                  <span className={k === today ? 'font-bold text-brand-600' : 'text-slate-400'}>{WEEK[parseDateKey(k).getDay()]}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  )
}

// ───────────── 날씨 ─────────────

export function WeatherWidget({ box }: { box: WidgetBox }) {
  const toast = useToast()
  const [place, setPlace] = useState<WeatherPlace>(loadPlace)
  const [w, setW] = useState<Weather | null>(() => cachedWeather(loadPlace(), Date.now()))
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const roomy = box.py >= 230
  const wide = box.px >= 300
  // 폰 4×2 띠처럼 넓고 낮으면: 한 줄로 지금 날씨, 아래에 시간별
  const band = wide && !roomy
  const showHours = roomy || (band && box.py >= 150)
  const bigText = roomy ? 'text-[44px]' : band ? 'text-[38px]' : 'text-[34px]'

  const load = useCallback(
    async (p: WeatherPlace, force = false) => {
      const hit = force ? null : cachedWeather(p, Date.now())
      if (hit) return setW(hit)
      setBusy(true)
      try {
        setW(await fetchWeather(p))
        setFailed(false)
      } catch {
        setFailed(true)
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  // 처음, 그리고 30분마다 · 앱으로 돌아올 때 오래됐으면 다시 받는다
  useEffect(() => {
    void load(place)
    const id = window.setInterval(() => void load(place), WEATHER_TTL)
    const onShow = () => document.visibilityState === 'visible' && void load(place)
    document.addEventListener('visibilitychange', onShow)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onShow)
    }
  }, [place, load])

  async function locate() {
    setBusy(true)
    try {
      const p = await currentPoint()
      const next: WeatherPlace = { lat: p.lat, lng: p.lng, name: nearestCity(p.lat, p.lng), mine: true }
      savePlace(next)
      setPlace(next)
      toast(`${next.name} 날씨로 바꿨어요`)
    } catch (e) {
      toast(e instanceof Error ? e.message : '위치를 잡지 못했어요', 'error')
      setBusy(false)
    }
  }

  const look = w ? weatherLook(w.code, w.isDay) : null
  const hourCount = Math.max(0, Math.min(12, Math.floor((box.px - 32) / 46)))

  return (
    <WidgetShell>
      <div className="flex items-center gap-1 text-[13px] font-bold text-slate-500">
        <span className="min-w-0 flex-1 truncate">
          {place.name}
          {!place.mine && <span className="font-medium text-slate-400"> · 기본</span>}
        </span>
        <button
          type="button"
          onClick={locate}
          disabled={busy}
          aria-label="내 위치 날씨로"
          title="내 위치 날씨로"
          className="tap -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 disabled:opacity-50"
        >
          <LocateFixed className={`size-3.5 ${busy ? 'animate-pulse' : ''}`} aria-hidden />
        </button>
      </div>

      {w && look ? (
        <>
          <div className={`flex min-h-0 flex-1 ${band ? 'items-center gap-4' : 'flex-col justify-center'}`}>
            <div className="flex items-center gap-2">
              <span className={`leading-none ${bigText}`} aria-hidden>
                {look.icon}
              </span>
              <span className={`leading-none font-extrabold tracking-tight text-slate-900 tabular-nums ${bigText}`}>{w.temp}°</span>
            </div>
            <div className={band ? 'min-w-0' : 'mt-1.5'}>
              <p className="truncate text-[13px] font-semibold text-slate-700">
                {look.label}
                {(wide || roomy) && <span className="font-medium text-slate-400"> · 체감 {w.feels}°</span>}
              </p>
              <p className="truncate text-[12px] text-slate-500 tabular-nums">
                <span className="text-red-400">↑{w.max}°</span> <span className="text-blue-400">↓{w.min}°</span>
                {w.rain > 0 && <span> · ☂ {w.rain}%</span>}
              </p>
            </div>
          </div>
          {roomy && <p className="mt-2 truncate text-[12px] font-semibold text-brand-600">{weatherTip(w)}</p>}
          {showHours && hourCount > 1 && w.hours.length > 1 && (
            <div className={`flex justify-between border-t border-slate-100 text-center text-[11px] tabular-nums ${band ? 'mt-1 pt-1.5' : 'mt-2 pt-2'}`}>
              {w.hours.slice(0, hourCount).map((h, i) => (
                <span key={`${h.hour}-${i}`} className="flex w-10 flex-col items-center gap-0.5">
                  <span className="text-slate-400">{i === 0 ? '지금' : `${h.hour}시`}</span>
                  <span className="text-[16px] leading-tight" aria-hidden>
                    {weatherLook(h.code, h.hour >= 6 && h.hour < 19).icon}
                  </span>
                  <span className="font-semibold text-slate-700">{h.temp}°</span>
                </span>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-xs text-slate-500">
          {failed ? (
            <>
              <span>날씨를 받지 못했어요</span>
              <button type="button" onClick={() => load(place, true)} className="tap flex items-center gap-1 rounded-full bg-slate-500/10 px-3 py-1 font-semibold">
                <RefreshCw className="size-3.5" aria-hidden />
                다시
              </button>
            </>
          ) : (
            <span className="animate-pulse">날씨 받는 중…</span>
          )}
        </div>
      )}
    </WidgetShell>
  )
}

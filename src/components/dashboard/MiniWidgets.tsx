import { Check, Clock, Flame, Plus } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CalendarEvent, Diary, Habit, Todo } from '../../db/types'
import { daysUntil, ddayLabel, doneByDay, heatLevel } from '../../lib/dashLayout'
import { parseDateKey, toDateKey } from '../../lib/date'
import { diaryPhotos } from '../../lib/diaryPhotos'
import { eventBg } from '../../lib/eventLayout'
import { holidaysBetween } from '../../lib/holidays'
import { isDueOn } from '../../lib/savings'
import { todayProgress, todayTodos } from '../../lib/summary'
import { timeLabel } from '../../lib/todoAlarms'
import type { WidgetBox } from './WidgetGrid'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function addDays(key: string, n: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + n)
  return toDateKey(d)
}

/** 위젯 틀: 하얀 둥근 카드 */
export function WidgetShell({ to, children, className = '' }: { to?: string; children: ReactNode; className?: string }) {
  const cls = `card theme-main flex h-full flex-col overflow-hidden p-4 ${className}`
  return to ? (
    <Link to={to} className={`${cls} transition active:scale-[0.98]`}>
      {children}
    </Link>
  ) : (
    <section className={cls}>{children}</section>
  )
}

function Title({ icon, children, right }: { icon?: ReactNode; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-slate-800">
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
    </div>
  )
}

// ───────────── 날짜 · 달력 ─────────────

interface DateProps {
  today: string
  box: WidgetBox
  /** 이번 달 일정 (점으로 표시) */
  events: CalendarEvent[]
}

/** 일정 한 줄 높이 (px) */
const AGENDA_ROW = 26
/** 달력 한 주 줄 기본 높이 (칸 24 + 줄 간격 4) */
const CAL_ROW = 28
/** 달력 칸이 커질 수 있는 최대 높이 */
const CAL_CELL_MAX = 46

/**
 * 큰 요일·날짜, 칸이 넉넉하면 이번 달 달력까지.
 * 날짜와 달력 사이가 비지 않게, 남는 높이만큼 오늘 · 다가오는 일정을 줄로 넣고
 * 그래도 남으면 달력 칸을 키워 위젯을 고르게 채운다
 */
export function DateWidget({ today, box, events }: DateProps) {
  const d = parseDateKey(today)
  const showCal = box.py >= 250 && box.px >= 150
  const y = d.getFullYear()
  const m = d.getMonth()
  const first = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const weeks = Math.ceil((first + days) / 7)
  const monthKey = today.slice(0, 7)
  const holidays = useMemo(() => holidaysBetween(`${monthKey}-01`, `${monthKey}-31`), [monthKey])
  const busy = useMemo(() => {
    const set = new Set<string>()
    for (const e of events) for (let k = e.startDate; k <= e.endDate && set.size < 400; k = addDays(k, 1)) set.add(k)
    return set
  }, [events])
  // 오늘 걸친 일정 먼저, 그다음 다가오는 일정 (가까운 순)
  const agenda = useMemo(
    () =>
      events
        .filter((e) => e.endDate >= today)
        .sort((a, b) => (a.startDate <= today ? today : a.startDate).localeCompare(b.startDate <= today ? today : b.startDate) || a.title.localeCompare(b.title)),
    [events, today],
  )
  const small = box.py < 120
  const big = small ? 'text-[34px]' : 'text-[44px]'

  // 높이 나누기: 안쪽 여백 32, 요일·날짜 74, 달력 제목·요일줄 60
  const head = 32 + 74
  const calFixed = 60
  const spare = showCal ? box.py - head - calFixed - weeks * CAL_ROW : 0
  // 남는 자리에 일정 줄 (제목줄 22 + 위아래 여백 16)
  const fit = spare >= 22 + 16 + AGENDA_ROW ? Math.floor((spare - 22 - 16) / AGENDA_ROW) : 0
  const rows = Math.min(fit, agenda.length, 6)
  const empty = fit > 0 && agenda.length === 0
  const listH = rows > 0 ? 22 + 16 + rows * AGENDA_ROW : empty ? 22 + 16 + AGENDA_ROW : 0
  // 그래도 남는 높이는 달력 칸을 키우는 데 쓴다
  // 일정 줄이 안 들어가는 크기에선 가장 가까운 일정 하나를 요일 옆에 작게
  const next = agenda[0]
  const cell = Math.min(CAL_CELL_MAX, 24 + Math.max(0, Math.floor((spare - listH) / weeks)))

  return (
    <WidgetShell to="/calendar">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`${big} leading-none font-extrabold tracking-tight text-slate-900`}>{WEEK[d.getDay()]}요일</p>
          <p className="mt-1.5 text-sm font-semibold text-slate-500">
            {m + 1}월 {d.getDate()}일
            {holidays.get(today)?.[0] && <span className="ml-1 text-red-500">· {holidays.get(today)![0].name}</span>}
          </p>
        </div>
        {showCal && rows === 0 && !empty && next && box.px >= 260 && <NextBadge e={next} today={today} />}
      </div>
      {!showCal && !small && agenda[0] && box.py >= 200 && <AgendaRow e={agenda[0]} today={today} className="mt-3" />}
      {!showCal && box.py >= 150 && (
        <div className="mt-auto flex justify-between text-center text-[11px] tabular-nums">
          {Array.from({ length: 7 }, (_, i) => addDays(today, i - d.getDay())).map((k, i) => (
            <span key={k} className="flex flex-col items-center gap-0.5">
              <span className={i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}>{WEEK[i]}</span>
              <span className={`relative flex size-[22px] items-center justify-center rounded-full font-semibold ${k === today ? 'bg-grad on-grad' : 'text-slate-700'}`}>
                {Number(k.slice(8))}
                {busy.has(k) && k !== today && <span className="absolute -bottom-0.5 size-1 rounded-full bg-brand-500" aria-hidden />}
              </span>
            </span>
          ))}
        </div>
      )}
      {/* 일정이 적어 자리가 남으면 위 · 목록 · 달력 사이로 고르게 나뉜다 */}
      {showCal && (rows > 0 || empty) && <span className="h-3 shrink-0" aria-hidden />}
      {showCal && (rows > 0 || empty) && (
        <div className="my-auto flex min-h-0 flex-col border-t border-slate-100 pt-2.5">
          <p className="mb-1 text-[12px] font-bold text-slate-400">다가오는 일정</p>
          {empty ? (
            <p className="flex h-[26px] items-center text-[13px] text-slate-400">일정이 없어요 · 눌러서 추가</p>
          ) : (
            agenda.slice(0, rows).map((e) => <AgendaRow key={`${e.id}-${e.startDate}`} e={e} today={today} />)
          )}
        </div>
      )}
      {showCal && (
        <div className="mt-auto pt-3">
          <p className="mb-1.5 text-[13px] font-bold text-slate-700">
            {y}년 {m + 1}월
          </p>
          <div className="grid grid-cols-7 gap-y-1 text-center text-[11px] tabular-nums" style={{ gridAutoRows: cell }}>
            {WEEK.map((w, i) => (
              <span key={w} className={`self-center font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
                {w}
              </span>
            ))}
            {Array.from({ length: first }, (_, i) => (
              <span key={`b${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const key = `${monthKey}-${String(i + 1).padStart(2, '0')}`
              const dow = (first + i) % 7
              const isToday = key === today
              const red = dow === 0 || holidays.has(key)
              return (
                <span key={key} className="relative flex items-center justify-center">
                  <span
                    className={`flex size-6 items-center justify-center rounded-full ${
                      isToday ? 'bg-grad font-bold on-grad' : red ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-700'
                    }`}
                  >
                    {i + 1}
                  </span>
                  {busy.has(key) && !isToday && <span className="absolute bottom-0 size-1 rounded-full bg-brand-500" aria-hidden />}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </WidgetShell>
  )
}

/** 요일 옆 작은 일정 표시: 오늘/디데이 + 제목 */
function NextBadge({ e, today }: { e: CalendarEvent; today: string }) {
  const now = e.startDate <= today
  return (
    <div className="flex max-w-[48%] shrink-0 flex-col items-end gap-1 pt-1 text-right">
      <span className="rounded-full bg-grad-soft px-2 py-0.5 text-[12px] font-extrabold text-brand-600 tabular-nums">{now ? '오늘' : ddayLabel(daysUntil(today, e.startDate))}</span>
      <span className="flex max-w-full items-center gap-1.5 text-[13px] font-semibold text-slate-700">
        <span className="size-2 shrink-0 rounded-full" style={{ background: eventBg(e.color) }} aria-hidden />
        <span className="truncate">{e.title}</span>
      </span>
    </div>
  )
}

/** 일정 한 줄: 색 막대 · 제목 · 오늘/디데이 */
function AgendaRow({ e, today, className = '' }: { e: CalendarEvent; today: string; className?: string }) {
  const now = e.startDate <= today
  const start = parseDateKey(e.startDate)
  return (
    <div className={`flex h-[26px] items-center gap-2 text-[13px] ${className}`}>
      <span className="h-3.5 w-1 shrink-0 rounded-full" style={{ background: eventBg(e.color) }} aria-hidden />
      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{e.title}</span>
      <span className={`shrink-0 text-[12px] font-bold tabular-nums ${now ? 'text-brand-600' : 'text-slate-400'}`}>
        {now ? '오늘' : `${start.getMonth() + 1}/${start.getDate()} · ${ddayLabel(daysUntil(today, e.startDate))}`}
      </span>
    </div>
  )
}

// ───────────── 오늘 시간표 ─────────────

interface Slot {
  key: string
  min: number
  label: string
  done?: boolean
  photo?: string
  kind: 'todo' | 'diary' | 'photo'
}

interface TimelineProps {
  today: string
  todos: Todo[]
  diary: Diary | undefined
  events: CalendarEvent[]
}

const ROW = 44

/** 하루를 한 시간씩 줄로 긋고, 시간 정한 할 일 · 시간별 일기 · 사진을 그 자리에. 지금 시각은 빨간 줄 */
export function TimelineWidget({ today, todos, diary, events }: TimelineProps) {
  const scroller = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(t)
  }, [])

  const slots = useMemo(() => {
    const out: Slot[] = []
    for (const t of todos) {
      if (t.dueDate !== today || !t.remindAt) continue
      const [h, m] = t.remindAt.split(':').map(Number)
      out.push({ key: `t${t.id}`, min: h * 60 + m, label: t.title, done: t.isCompleted === 1, kind: 'todo' })
    }
    for (const h of diary?.hours ?? []) {
      const text = h.text.trim().split('\n')[0]
      if (text) out.push({ key: `h${h.hour}`, min: h.hour * 60, label: text, kind: 'diary' })
    }
    for (const [i, p] of diaryPhotos(diary).entries()) {
      if (!p.time) continue
      const [h, m] = p.time.split(':').map(Number)
      out.push({ key: `p${i}`, min: h * 60 + m, label: p.note ?? '', photo: p.src, kind: 'photo' })
    }
    return out.sort((a, b) => a.min - b.min)
  }, [todos, diary, today])

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const start = Math.min(7, ...slots.map((s) => Math.floor(s.min / 60)))
  const hours = Array.from({ length: 24 - start }, (_, i) => start + i)
  const allDay = events.filter((e) => e.startDate <= today && e.endDate >= today)

  // 처음 열면 지금 시각 조금 위가 보이게
  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = Math.max(0, ((nowMin - start * 60) / 60) * ROW - ROW * 1.5)
    // 처음 한 번만
  }, []) // oxlint-disable-line react-hooks/exhaustive-deps

  return (
    <WidgetShell className="!p-0">
      <div className="px-4 pt-4">
        <Title icon={<Clock className="size-4 text-brand-500" aria-hidden />} right={<Link to="/diary" className="text-xs font-semibold text-brand-600">일기</Link>}>
          오늘 시간표
        </Title>
        {allDay.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {allDay.slice(0, 3).map((e) => (
              <Link key={e.id} to="/calendar" className="max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-semibold text-slate-800" style={{ background: eventBg(e.color) }}>
                {e.title}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto px-4 pb-3">
        <div className="relative mt-2" style={{ height: hours.length * ROW }}>
          {hours.map((h, i) => (
            <div key={h} className="absolute inset-x-0 flex items-start gap-2" style={{ top: i * ROW }}>
              <span className="w-9 shrink-0 -translate-y-1.5 text-right text-[10px] font-medium text-slate-400 tabular-nums">{h}시</span>
              <span className="mt-0.5 h-px flex-1 bg-slate-100" />
            </div>
          ))}
          {slots.map((s, i) => {
            const top = ((s.min - start * 60) / 60) * ROW + 4
            // 같은 시간대에 여럿이면 조금씩 아래로
            const prev = slots[i - 1]
            const shift = prev && s.min - prev.min < 25 ? 20 : 0
            return (
              <Link
                key={s.key}
                to={s.kind === 'todo' ? '/todos' : '/diary'}
                className="absolute right-0 left-11 flex items-center gap-1.5 text-[13px]"
                style={{ top: top + shift }}
              >
                {s.photo ? (
                  <img src={s.photo} alt="" className="size-6 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className={`size-2 shrink-0 rounded-full ${s.kind === 'todo' ? 'bg-brand-500' : 'bg-amber-400'}`} aria-hidden />
                )}
                <span className={`truncate font-medium ${s.done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                  {s.kind === 'todo' && <span className="mr-1 text-slate-400 tabular-nums">{timeLabel(`${String(Math.floor(s.min / 60)).padStart(2, '0')}:${String(s.min % 60).padStart(2, '0')}`).replace(/^(오전|오후) /, '')}</span>}
                  {s.label || '사진'}
                </span>
              </Link>
            )
          })}
          {nowMin >= start * 60 && (
            <div className="pointer-events-none absolute inset-x-0 flex items-center" style={{ top: ((nowMin - start * 60) / 60) * ROW }} aria-label="지금">
              <span className="ml-9 size-2 -translate-x-1 rounded-full bg-red-500" />
              <span className="h-[1.5px] flex-1 bg-red-500" />
            </div>
          )}
        </div>
        {slots.length === 0 && (
          <p className="pointer-events-none absolute inset-x-4 top-3 rounded-xl bg-slate-50/90 px-3 py-2 text-center text-xs text-slate-500">
            할 일에 알림 시각을 정하거나 시간별 일기를 쓰면 여기에 보여요
          </p>
        )}
      </div>
    </WidgetShell>
  )
}

// ───────────── 할 일 진행 ─────────────

/** 오늘 할 일을 점으로: 끝낸 것은 진하게 */
export function ProgressWidget({ todos, today, box }: { todos: Todo[]; today: string; box: WidgetBox }) {
  const items = todayTodos(todos, today)
  const { done, total } = todayProgress(todos, today)
  const pct = total ? Math.round((done / total) * 100) : 0
  const tiny = box.py < 110
  return (
    <WidgetShell to="/todos">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-slate-500">오늘 할 일</span>
        <span className="ml-auto text-[13px] font-bold text-brand-600 tabular-nums">{pct}%</span>
      </div>
      {total === 0 ? (
        <p className="mt-auto text-sm text-slate-400">오늘은 할 일이 없어요</p>
      ) : (
        <div className={`mt-auto flex flex-wrap ${tiny ? 'gap-1' : 'gap-1.5'}`} aria-label={`${total}개 중 ${done}개 끝냄`}>
          {[...items].sort((a, b) => b.isCompleted - a.isCompleted).map((t) => (
            <span key={t.id} className={`${tiny ? 'size-2.5' : 'size-3.5'} rounded-full ${t.isCompleted ? 'bg-grad' : 'bg-slate-200'}`} title={t.title} />
          ))}
        </div>
      )}
      {!tiny && total > 0 && (
        <p className="mt-2 text-xs text-slate-500 tabular-nums">
          {total}개 중 {done}개 끝냈어요
        </p>
      )}
    </WidgetShell>
  )
}

// ───────────── 다가오는 일정 ─────────────

/** 오늘 이후 가장 가까운 일정까지 며칠 */
export function DdayWidget({ today, upcoming, box }: { today: string; upcoming: CalendarEvent | undefined; box: WidgetBox }) {
  const tiny = box.py < 110
  if (!upcoming)
    return (
      <WidgetShell to="/calendar">
        <p className="text-[13px] font-semibold text-slate-500">다가오는 일정</p>
        <p className="mt-auto text-sm text-slate-400">한 달 안에 일정이 없어요</p>
      </WidgetShell>
    )
  const days = daysUntil(today, upcoming.startDate)
  if (tiny)
    return (
      <WidgetShell to="/calendar" className="!flex-row items-center gap-3">
        <span className="text-[26px] leading-none font-extrabold text-slate-900 tabular-nums">{ddayLabel(days)}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-brand-600">{upcoming.title}</span>
      </WidgetShell>
    )
  return (
    <WidgetShell to="/calendar" className="items-center justify-center text-center">
      <p className="max-w-full truncate text-sm font-bold text-brand-600">{upcoming.title}</p>
      <p className="mt-1 text-[48px] leading-none font-extrabold tracking-tight text-slate-900 tabular-nums">{days}</p>
      <p className="mt-1 text-sm text-slate-500">{days === 1 ? '내일이에요' : '일 남았어요'}</p>
    </WidgetShell>
  )
}

// ───────────── 할 일 목록 ─────────────

interface TodoListProps {
  todos: Todo[]
  today: string
  onToggle: (t: Todo) => void
  onSelect: (t: Todo) => void
  onAdd: () => void
}

/** 오늘 할 일을 동그란 체크로 바로 끝내기 */
export function TodoListWidget({ todos, today, onToggle, onSelect, onAdd }: TodoListProps) {
  const items = todayTodos(todos, today)
  return (
    <WidgetShell>
      <Title
        icon={<Check className="size-4 text-brand-500" strokeWidth={3} aria-hidden />}
        right={
          <button type="button" onClick={onAdd} aria-label="할 일 추가" className="tap flex size-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
            <Plus className="size-4" aria-hidden />
          </button>
        }
      >
        <Link to="/todos">할 일</Link>
      </Title>
      {items.length === 0 ? (
        <p className="m-auto text-sm text-slate-400">오늘 할 일이 없어요</p>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto">
          {items.map((t) => {
            const done = t.isCompleted === 1
            return (
              <li key={t.id} className="flex items-center gap-2.5 rounded-xl px-1 py-1.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={done}
                  aria-label={`${t.title} ${done ? '완료 취소' : '완료'}`}
                  onClick={() => onToggle(t)}
                  className={`tap flex size-5 shrink-0 items-center justify-center rounded-full transition ${done ? 'bg-check' : 'border-2 border-slate-300'}`}
                >
                  {done && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
                </button>
                <button type="button" onClick={() => onSelect(t)} className={`min-w-0 flex-1 truncate text-left text-[14px] ${done ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>
                  {t.title}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </WidgetShell>
  )
}

// ───────────── 습관 일주일 ─────────────

interface HabitWeekProps {
  habits: Habit[]
  checks: Map<number, Set<string>>
  today: string
  box: WidgetBox
  onToggle: (h: Habit) => void
}

/** 이번 주(월~일) 습관을 동그라미로. 오늘 동그라미를 누르면 체크 */
export function HabitWeekWidget({ habits: all, checks, today, box, onToggle }: HabitWeekProps) {
  const habits = all.filter((h) => !h.schedule || h.schedule.freq === 'daily' || isDueOn(h.schedule, today))
  const dow = (parseDateKey(today).getDay() + 6) % 7
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - dow))
  const narrow = box.px < 250
  const rowH = box.px > 360 ? 64 : narrow ? 46 : 56
  const fit = Math.max(1, Math.floor((box.py - 24) / rowH))
  const shown = habits.slice(0, fit)
  const size = box.px > 360 ? 'size-9' : narrow ? 'size-[18px] text-[0px]' : 'size-[30px]'

  if (habits.length === 0)
    return (
      <WidgetShell to="/todos?tab=habits">
        <Title icon={<Flame className="size-4 text-orange-500" aria-hidden />}>습관</Title>
        <p className="m-auto text-center text-sm text-slate-400">매일 할 습관을 만들면 일주일 동그라미로 보여요</p>
      </WidgetShell>
    )

  return (
    <WidgetShell>
      <div className="flex min-h-0 flex-1 flex-col justify-around gap-1">
        {shown.map((h) => {
          const set = checks.get(h.id!) ?? new Set<string>()
          return (
            <div key={h.id}>
              <Link to="/todos?tab=habits" className="mb-1 flex items-center gap-1.5 text-[14px] font-bold text-slate-800">
                <span aria-hidden>{h.emoji}</span>
                <span className="truncate">{h.title}</span>
              </Link>
              <div className="flex justify-between gap-1">
                {week.map((day, i) => {
                  const on = set.has(day)
                  const isToday = day === today
                  const future = day > today
                  const cls = `${size} flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition ${
                    on ? 'bg-grad on-grad shadow-sm' : future ? 'border border-slate-200 text-slate-300' : 'bg-slate-100 text-slate-400'
                  } ${isToday ? 'ring-2 ring-brand-500/40 ring-offset-1' : ''}`
                  return isToday ? (
                    <button key={day} type="button" onClick={() => onToggle(h)} aria-pressed={on} aria-label={`${h.title} 오늘 ${on ? '체크 취소' : '체크'}`} className={cls}>
                      {on ? <Check className={narrow ? 'size-3' : 'size-4'} strokeWidth={3} aria-hidden /> : WEEK[(i + 1) % 7]}
                    </button>
                  ) : (
                    <span key={day} className={cls} aria-label={`${WEEK[(i + 1) % 7]} ${on ? '함' : '안 함'}`}>
                      {on ? <Check className={narrow ? 'size-3' : 'size-4'} strokeWidth={3} aria-hidden /> : WEEK[(i + 1) % 7]}
                    </span>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {habits.length > shown.length && <p className="mt-1 text-center text-[11px] text-slate-400">외 {habits.length - shown.length}개 · 크기를 키우면 더 보여요</p>}
    </WidgetShell>
  )
}

// ───────────── 할 일 기록 잔디 ─────────────

const HEAT = ['bg-slate-100', 'bg-brand-100', 'bg-brand-500/45', 'bg-brand-500/75', 'bg-brand-600']

/** 끝낸 할 일 수로 칠한 잔디 (최근 몇 주). 왼쪽엔 숫자 요약 */
export function TrackerWidget({ todos, today, box }: { todos: Todo[]; today: string; box: WidgetBox }) {
  const byDay = useMemo(() => doneByDay(todos), [todos])
  const showStats = box.px >= 330
  const cell = 12
  const gap = 3
  const gridW = box.px - 32 - (showStats ? 130 : 0)
  const weeks = Math.max(4, Math.min(53, Math.floor((gridW + gap) / (cell + gap))))
  const rows = 7
  // 이번 주 일요일 기준으로 weeks 주 거슬러 올라간다
  const lastSun = addDays(today, -parseDateKey(today).getDay())
  const start = addDays(lastSun, -(weeks - 1) * 7)
  const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: rows }, (_, d) => addDays(start, w * 7 + d)))

  const total = [...byDay.values()].reduce((a, b) => a + b, 0)
  const week = Array.from({ length: 7 }, (_, i) => byDay.get(addDays(today, -i)) ?? 0).reduce((a, b) => a + b, 0)
  let streak = 0
  for (let k = byDay.get(today) ? today : addDays(today, -1); byDay.get(k); k = addDays(k, -1)) streak++

  return (
    <WidgetShell to="/todos">
      <Title icon={<Flame className="size-4 text-orange-500" aria-hidden />}>할 일 기록</Title>
      <div className="flex min-h-0 flex-1 items-center gap-4">
        {showStats && (
          <dl className="grid w-[114px] shrink-0 grid-cols-[auto_1fr] items-baseline gap-x-2 gap-y-1 text-xs text-slate-500">
            <dt>모두</dt>
            <dd className="text-right text-lg font-extrabold text-slate-900 tabular-nums">{total}</dd>
            <dt>이번 주</dt>
            <dd className="text-right text-lg font-extrabold text-slate-900 tabular-nums">{week}</dd>
            <dt>연속</dt>
            <dd className="text-right text-lg font-extrabold text-slate-900 tabular-nums">
              {streak}
              <span className="text-xs font-semibold text-slate-500">일</span>
            </dd>
          </dl>
        )}
        <div className="flex min-w-0 flex-1 justify-end gap-[3px]" aria-label="최근 끝낸 할 일 잔디">
          {cols.map((col, i) => (
            <div key={i} className="flex flex-col gap-[3px]">
              {col.map((k) => (
                <span key={k} className={`size-3 rounded-[3px] ${k > today ? 'opacity-0' : HEAT[heatLevel(byDay.get(k) ?? 0)]}`} title={`${k} ${byDay.get(k) ?? 0}개`} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </WidgetShell>
  )
}

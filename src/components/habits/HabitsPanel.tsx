import type { Habit } from '../../db/types'
import { lastDays, scheduledStreak } from '../../lib/habits'
import { isDueOn, scheduleLabel } from '../../lib/savings'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import HabitCheckButton from './HabitCheckButton'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

interface HabitsPanelProps {
  habits: Habit[]
  checks: Map<number, Set<string>>
  today: string
  onAdd: () => void
  onToggle: (habit: Habit, date: string) => void
  onOpen: (habit: Habit) => void
}

/** 할 일 → 습관 탭: 오늘 체크, 연속 기록, 최근 7일 */
export default function HabitsPanel({ habits, checks, today, onAdd, onToggle, onOpen }: HabitsPanelProps) {
  if (habits.length === 0) {
    return (
      <EmptyState
        icon="🌱"
        title="매일 할 습관을 만들어 보세요"
        description="물 마시기, 운동, 책 읽기처럼 매일 하고 싶은 걸 체크하면 연속 기록이 쌓여요."
        action={<Button onClick={onAdd}>+ 습관 추가</Button>}
      />
    )
  }

  const week = lastDays(today, 7)
  // 오늘 할 습관만 센다 (적금 습관은 넣는 날에만)
  const dueHabits = habits.filter((h) => !h.schedule || isDueOn(h.schedule, today))
  const doneToday = dueHabits.filter((h) => checks.get(h.id!)?.has(today)).length

  return (
    <div className="space-y-3">
      <section className="theme-todo bg-grad on-grad rounded-3xl p-5 shadow-float">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold opacity-85">오늘의 습관</p>
            <p className="text-2xl font-extrabold tracking-tight">
              {doneToday === dueHabits.length ? '오늘 다 했어요 🎉' : `${dueHabits.length - doneToday}개 남았어요`}
            </p>
          </div>
          <span className="text-lg font-bold">
            {doneToday}/{dueHabits.length}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-on-soft" aria-hidden>
          <div className="h-full rounded-full opacity-80 transition-all" style={{ width: `${dueHabits.length ? (doneToday / dueHabits.length) * 100 : 100}%`, background: "var(--on, #fff)" }} />
        </div>
      </section>

      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {habits.map((h) => {
          const done = checks.get(h.id!) ?? new Set<string>()
          const streak = scheduledStreak(done, today, h.schedule)
          const scheduled = h.schedule && h.schedule.freq !== 'daily'
          const dueToday = !h.schedule || isDueOn(h.schedule, today)
          return (
            <li key={h.id} className="flex items-center gap-3 px-4 py-3">
              <button type="button" onClick={() => onOpen(h)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${h.title} 자세히 보기`}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-grad-soft text-2xl">{h.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-[15px] font-semibold ${done.has(today) ? 'text-slate-400' : 'text-slate-800'}`}>{h.title}</span>
                    {streak > 0 && <span className="shrink-0 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-500">🔥 {streak}{scheduled ? '번' : '일'}</span>}
                  </span>
                  {h.schedule && h.schedule.freq !== 'daily' && (
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {scheduleLabel(h.schedule)} · {dueToday ? <b className="text-brand-600">오늘 넣는 날</b> : '오늘은 쉬는 날'}
                    </span>
                  )}
                  <span className="mt-1.5 flex gap-1" aria-label="최근 7일">
                    {week.map((d) => (
                      <span key={d} className="flex flex-col items-center gap-0.5">
                        <span
                          className={`size-3.5 rounded-full ${done.has(d) ? 'bg-check' : 'bg-slate-200'} ${d === today ? 'ring-2 ring-slate-700 ring-offset-1' : ''}`}
                          title={d}
                        />
                        <span className="text-[9px] leading-none text-slate-400">{WEEK[new Date(`${d}T00:00`).getDay()]}</span>
                      </span>
                    ))}
                  </span>
                </span>
              </button>
              <HabitCheckButton done={done.has(today)} label={h.title} onClick={() => onToggle(h, today)} />
            </li>
          )
        })}
      </ul>
      <p className="text-center text-xs text-slate-400">습관을 누르면 한 달 기록을 볼 수 있어요</p>
    </div>
  )
}

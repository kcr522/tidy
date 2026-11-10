import { Sprout } from 'lucide-react'
import type { Habit } from '../../db/types'
import { currentStreak } from '../../lib/habits'
import { isDueOn } from '../../lib/savings'
import HabitCheckButton from '../habits/HabitCheckButton'
import DashboardCard, { CardEmpty } from './DashboardCard'

const MAX_ITEMS = 5

interface HabitCardProps {
  habits: Habit[]
  checks: Map<number, Set<string>>
  today: string
  onAdd: () => void
  onToggle: (habit: Habit) => void
}

/** 대시보드 습관 카드: 오늘 몇 개 했는지, 연속 기록, 바로 체크 */
export default function HabitCard({ habits: all, checks, today, onAdd, onToggle }: HabitCardProps) {
  // 오늘 할 습관만 (적금 습관은 넣는 날에만 보인다)
  const habits = all.filter((h) => !h.schedule || isDueOn(h.schedule, today))
  const done = habits.filter((h) => checks.get(h.id!)?.has(today)).length
  const best = Math.max(0, ...habits.filter((h) => !h.schedule || h.schedule.freq === 'daily').map((h) => currentStreak(checks.get(h.id!) ?? new Set(), today)))
  const rest = habits.length - MAX_ITEMS

  return (
    <DashboardCard to="/todos?tab=habits" icon={Sprout} title={`오늘 습관 (${done}/${habits.length})`} addLabel="습관 추가" onAdd={onAdd}>
      {habits.length === 0 ? (
        <CardEmpty>{all.length > 0 ? '오늘 할 습관은 다 쉬는 날이에요.' : '매일 할 습관을 만들어 보세요. + 를 눌러 추가해요.'}</CardEmpty>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-grad transition-all" style={{ width: `${(done / habits.length) * 100}%` }} />
            </div>
            {best > 0 && <span className="shrink-0 text-xs font-bold text-orange-500">🔥 최고 {best}일째</span>}
          </div>
          <ul className="space-y-1">
            {habits.slice(0, MAX_ITEMS).map((h) => {
              const set = checks.get(h.id!) ?? new Set<string>()
              const streak = currentStreak(set, today)
              const isDone = set.has(today)
              return (
                <li key={h.id} className="flex items-center gap-2.5 py-1">
                  <span className="text-xl" aria-hidden>
                    {h.emoji}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${isDone ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>{h.title}</span>
                  {streak > 0 && <span className="shrink-0 text-xs font-semibold text-slate-400">{streak}일 연속</span>}
                  <HabitCheckButton size="sm" done={isDone} label={h.title} onClick={() => onToggle(h)} />
                </li>
              )
            })}
          </ul>
          {rest > 0 && <p className="mt-2 text-center text-xs text-slate-400">외 {rest}개 더 있어요</p>}
        </>
      )}
    </DashboardCard>
  )
}

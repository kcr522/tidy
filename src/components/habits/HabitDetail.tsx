import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import type { Habit } from '../../db/types'
import { bestStreak, currentStreak, monthCells, monthRate } from '../../lib/habits'
import Button from '../common/Button'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

interface HabitDetailProps {
  habit: Habit
  done: Set<string>
  today: string
  onToggle: (date: string) => void
  onEdit: () => void
}

/** 습관 자세히: 연속 기록, 최고 기록, 월간 달력 (지난 날도 눌러서 고칠 수 있다) */
export default function HabitDetail({ habit, done, today, onToggle, onEdit }: HabitDetailProps) {
  const [month, setMonth] = useState(today.slice(0, 7))
  const streak = currentStreak(done, today)
  const best = bestStreak(done)
  const since = habit.createdAt.slice(0, 10)
  const rate = monthRate(done, month, today, since < today ? since : today)
  const [y, m] = month.split('-').map(Number)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="지금 연속" value={`${streak}일`} hot={streak > 0} />
        <Stat label="최고 기록" value={`${best}일`} />
        <Stat label={`${m}월에 한 날`} value={`${rate.done}/${rate.days}`} />
      </div>

      <div className="rounded-3xl bg-slate-50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="tap rounded-full p-2 text-slate-500 hover:bg-white" aria-label="이전 달">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <span className="font-bold">
            {y}년 {m}월
          </span>
          <button
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            disabled={month >= today.slice(0, 7)}
            className="tap rounded-full p-2 text-slate-500 hover:bg-white disabled:opacity-30"
            aria-label="다음 달"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEK.map((w, i) => (
            <span key={w} className={`pb-1 text-xs font-semibold ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-slate-400'}`}>
              {w}
            </span>
          ))}
          {monthCells(month).map((d, i) => {
            if (!d) return <span key={`e${i}`} />
            const isDone = done.has(d)
            const future = d > today
            return (
              <button
                key={d}
                type="button"
                disabled={future}
                onClick={() => onToggle(d)}
                aria-pressed={isDone}
                aria-label={`${Number(d.slice(8))}일 ${isDone ? '했음' : '안 함'}`}
                className={`flex aspect-square items-center justify-center rounded-xl text-sm font-semibold transition active:scale-90 ${
                  isDone ? 'bg-check' : future ? 'text-slate-300' : 'bg-white text-slate-600'
                } ${d === today ? 'ring-2 ring-slate-800 ring-offset-1' : ''}`}
              >
                {Number(d.slice(8))}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-center text-xs text-slate-400">지난 날짜를 눌러 깜빡한 기록도 고칠 수 있어요</p>
      </div>

      <Button variant="secondary" className="w-full" onClick={onEdit}>
        {habit.emoji} 이름·아이콘 바꾸기
      </Button>
    </div>
  )
}

function Stat({ label, value, hot = false }: { label: string; value: string; hot?: boolean }) {
  return (
    <div className={`rounded-2xl px-2 py-3 ${hot ? 'bg-grad on-grad' : 'bg-slate-100'}`}>
      <div className={`text-xs font-medium ${hot ? '' : 'text-slate-500'}`}>{label}</div>
      <div className="mt-0.5 text-xl font-extrabold tracking-tight">
        {hot && '🔥 '}
        {value}
      </div>
    </div>
  )
}

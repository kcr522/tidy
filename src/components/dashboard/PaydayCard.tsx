import { CalendarClock } from 'lucide-react'
import type { Recurring } from '../../db/types'
import { formatDateLabel, formatWon } from '../../lib/format'
import { ddayFor, ddayLabel } from '../../lib/recurring'
import DashboardCard, { CardEmpty } from './DashboardCard'

interface Props {
  /** 켜져 있는 정기 수입 (월급, 용돈 등) */
  incomes: Recurring[]
  today: string
  onAdd: () => void
}

/** 월급·용돈 날까지 D-day, 지난 월급날부터 얼마나 왔는지 막대로 */
export default function PaydayCard({ incomes, today, onAdd }: Props) {
  const rows = incomes
    .map((r) => ({ r, d: ddayFor(r.day, today) }))
    .sort((a, b) => a.d.daysLeft - b.d.daysLeft)
    .slice(0, 3)

  return (
    <DashboardCard to="/money" icon={CalendarClock} title="들어올 돈" addLabel="월급날 등록" onAdd={onAdd}>
      {rows.length === 0 ? (
        <CardEmpty>
          월급이나 용돈 받는 날을 등록하면 며칠 남았는지 보여 줘요.
          <button type="button" onClick={onAdd} className="mt-3 block w-full rounded-2xl bg-brand-50 py-2.5 text-sm font-bold text-brand-700">
            + 월급날 등록
          </button>
        </CardEmpty>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ r, d }) => (
            <li key={r.id}>
              <div className="mb-1.5 flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{r.memo}</span>
                <span className={`text-[22px] leading-none font-extrabold tracking-tight ${d.daysLeft === 0 ? 'text-grad' : 'text-brand-600'}`}>
                  {ddayLabel(d.daysLeft)}
                </span>
              </div>
              <div
                className="h-3 overflow-hidden rounded-full bg-slate-100"
                role="progressbar"
                aria-label={`${r.memo}까지`}
                aria-valuenow={d.progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${ddayLabel(d.daysLeft)}, ${d.progress}% 지남`}
              >
                <div className="bg-grad h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(d.progress, 4)}%` }} />
              </div>
              <p className="mt-1.5 flex justify-between text-xs text-slate-400">
                <span>{d.daysLeft === 0 ? '오늘 들어와요!' : `${formatDateLabel(d.date)}`}</span>
                <span className="font-semibold text-income">+{formatWon(r.amount)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  )
}

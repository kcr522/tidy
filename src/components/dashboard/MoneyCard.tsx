import type { Transaction } from '../../db/types'
import { formatWon } from '../../lib/format'
import { monthSummary, todayExpense, usageRate } from '../../lib/summary'
import DashboardCard, { CardEmpty } from './DashboardCard'

interface MoneyCardProps {
  month: number
  /** 이번 달 내역 */
  items: Transaction[]
  today: string
  onAdd: () => void
}

/** 가계부 카드: 이번 달 수입, 지출, 오늘 지출, 사용률 막대 (FR-051) */
export default function MoneyCard({ month, items, today, onAdd }: MoneyCardProps) {
  const summary = monthSummary(items)
  const rate = usageRate(summary)
  const barColor = rate === null ? 'bg-slate-300' : rate >= 100 ? 'bg-expense' : rate >= 80 ? 'bg-amber-500' : 'bg-brand-500'

  return (
    <DashboardCard to="/money" icon="💳" title={`${month}월 가계부`} addLabel="수입/지출 추가" onAdd={onAdd}>
      {items.length === 0 ? (
        <CardEmpty>이번 달 기록이 없어요. + 를 눌러 첫 내역을 남겨 보세요.</CardEmpty>
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 text-center">
            <Stat label="수입" value={formatWon(summary.income)} className="text-income" />
            <Stat label="지출" value={formatWon(summary.expense)} className="text-expense" />
          </dl>
          <p className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-sm">
            <span className="text-slate-500">오늘 지출</span>
            <span className="font-bold text-slate-900">{formatWon(todayExpense(items, today))}</span>
          </p>
          <div className="mt-4">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-slate-500">수입 대비 사용률</span>
              <span className="font-semibold text-slate-700">{rate === null ? '-' : `${rate}%`}</span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label="사용률"
              aria-valuenow={rate ?? undefined}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
            </div>
            {rate === null && <p className="mt-1 text-xs text-slate-400">수입을 기록하면 사용률이 보여요</p>}
          </div>
        </>
      )}
    </DashboardCard>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 font-bold break-all ${className}`}>{value}</dd>
    </div>
  )
}

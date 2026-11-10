import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MonthSummary as Summary } from '../../lib/summary'
import { formatMonthLabel, formatWon } from '../../lib/format'

interface MonthSummaryProps {
  year: number
  month: number
  summary: Summary
  onPrev: () => void
  onNext: () => void
  onToday?: () => void
}

/** 월 이동 + 총 수입/지출/잔액 (FR-015, FR-016) */
export default function MonthSummary({ year, month, summary, onPrev, onNext, onToday }: MonthSummaryProps) {
  return (
    <section className="mb-5 card p-5">
      <div className="mb-4 flex items-center justify-center gap-2">
        <button type="button" onClick={onPrev} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="min-w-28 text-center text-lg font-extrabold">{formatMonthLabel(year, month)}</h2>
        <button type="button" onClick={onNext} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        {onToday && (
          <button type="button" onClick={onToday} className="tap ml-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600">
            이번 달
          </button>
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Item label="수입" value={formatWon(summary.income)} className="text-income" />
        <Item label="지출" value={formatWon(summary.expense)} className="text-expense" />
        <Item
          label="잔액"
          value={`${summary.balance < 0 ? '-' : ''}${formatWon(Math.abs(summary.balance))}`}
          className={summary.balance < 0 ? 'text-expense' : 'text-slate-900'}
        />
      </dl>
    </section>
  )
}

function Item({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-1 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-bold break-all sm:text-base ${className}`}>{value}</dd>
    </div>
  )
}

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
    <section className="mb-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-center gap-2">
        <button type="button" onClick={onPrev} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
          ‹
        </button>
        <h2 className="min-w-28 text-center text-lg font-bold">{formatMonthLabel(year, month)}</h2>
        <button type="button" onClick={onNext} className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
          ›
        </button>
        {onToday && (
          <button type="button" onClick={onToday} className="ml-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
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
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`mt-1 text-sm font-bold break-all sm:text-base ${className}`}>{value}</dd>
    </div>
  )
}

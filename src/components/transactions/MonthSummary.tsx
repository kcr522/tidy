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
  /** 🐷 저축 칸을 누르면 저축 내역 열기 */
  onSaving?: () => void
}

/** 월 이동 + 총 수입/지출/저축/잔액 (FR-015, FR-016). 저축은 지출에 넣지 않고 따로 (사용자 요청 2026-11-23) */
export default function MonthSummary({ year, month, summary, onPrev, onNext, onToday, onSaving }: MonthSummaryProps) {
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
      <dl className="grid grid-cols-4 gap-1.5 text-center sm:gap-2">
        <Item label="수입" value={formatWon(summary.income)} className="text-income" />
        <Item label="지출" value={formatWon(summary.expense)} className="text-expense" />
        <Item label="🐷 저축" value={formatWon(summary.saving)} className="text-saving" onClick={onSaving} />
        <Item
          label="잔액"
          value={`${summary.balance < 0 ? '-' : ''}${formatWon(Math.abs(summary.balance))}`}
          className={summary.balance < 0 ? 'text-expense' : 'text-slate-900'}
        />
      </dl>
    </section>
  )
}

function Item({ label, value, className, onClick }: { label: string; value: string; className: string; onClick?: () => void }) {
  const body = (
    <>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      {/* 금액이 길면 글씨를 줄여서 한 줄로 (칸 밖으로 넘치거나 '원'만 다음 줄로 가지 않게) */}
      <dd className={`mt-1 font-bold tracking-tight whitespace-nowrap tabular-nums ${amountSize(value)} ${className}`}>{value}</dd>
    </>
  )
  if (!onClick) return <div className="rounded-2xl bg-slate-50 px-1 py-3">{body}</div>
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="tap cursor-pointer rounded-2xl bg-slate-50 px-1 py-3 hover:bg-slate-100"
      aria-label={`${label} ${value}, 저축 내역 보기`}
    >
      {body}
    </div>
  )
}

/** 글자 수에 맞춘 글씨 크기: 1,533,263원(10자)까지는 그대로, 더 길면 작게 */
export function amountSize(value: string): string {
  if (value.length <= 8) return 'text-sm sm:text-base'
  if (value.length <= 10) return 'text-[12px] sm:text-base'
  if (value.length <= 12) return 'text-[11px] sm:text-base'
  return 'text-[10px] sm:text-sm'
}

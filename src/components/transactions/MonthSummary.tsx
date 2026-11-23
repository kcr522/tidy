import { ChevronLeft, ChevronRight, PiggyBank } from 'lucide-react'
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

/** 월 이동 + 총 수입/지출/잔액 (FR-015, FR-016). 저축은 지출에 넣지 않고 🐷 저금통 안에 따로 (사용자 요청 2026-11-23) */
export default function MonthSummary({ year, month, summary, onPrev, onNext, onToday, onSaving }: MonthSummaryProps) {
  const values = [formatWon(summary.income), formatWon(summary.expense), `${summary.balance < 0 ? '-' : ''}${formatWon(Math.abs(summary.balance))}`]
  // 네 칸 모두 같은 글씨 크기: 가장 긴 금액이 칸에 들어가는 크기
  const size = fitSize(values.reduce((a, b) => (b.length > a.length ? b : a)))
  return (
    <section className="mb-5 card p-5">
      <div className="mb-4 flex items-center justify-center gap-1 sm:gap-2">
        <button type="button" onClick={onPrev} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="min-w-28 text-center text-lg font-extrabold">{formatMonthLabel(year, month)}</h2>
        <button type="button" onClick={onNext} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
          <ChevronRight className="size-5" aria-hidden />
        </button>
        {/* 저축 넣기 · 저축 내역: 달 옆 저금통 (사용자 요청 2026-11-23: "저금통 이모티콘을 11월 옆에") */}
        {onSaving && (
          <button
            type="button"
            onClick={onSaving}
            className="tap ml-1 flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-sm font-bold text-saving hover:bg-slate-200"
            aria-label="저축 넣기 · 저축 내역"
            title="저축 넣기 · 저축 내역"
          >
            <PiggyBank className="size-[18px]" aria-hidden />
            <span className="hidden sm:inline">저축</span>
          </button>
        )}
        {onToday && (
          <button type="button" onClick={onToday} className="tap ml-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-600">
            이번 달
          </button>
        )}
      </div>
      {/* 저축은 여기 보이지 않고 달 옆 🐷를 눌러야 보인다 (사용자 요청 2026-11-23). 잔액은 저축으로 빠진 돈까지 뺀 값 */}
      <dl className="grid grid-cols-3 gap-2 text-center">
        <Item label="수입" value={values[0]} size={size} className="text-income" />
        <Item label="지출" value={values[1]} size={size} className="text-expense" />
        <Item label="잔액" value={values[2]} size={size} className={summary.balance < 0 ? 'text-expense' : 'text-slate-900'} />
      </dl>
    </section>
  )
}

function Item({ label, value, size, className }: { label: string; value: string; size: string; className: string }) {
  return (
    <div className="@container min-w-0 rounded-2xl bg-slate-50 px-1 py-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      {/* 칸 너비(cqw)와 글자 수에 맞춰 글씨를 줄여 칸 밖으로 넘치지 않게 (폰 글씨 크기를 키워도) */}
      <dd className={`mt-1 overflow-hidden font-bold tracking-tight whitespace-nowrap tabular-nums ${className}`} style={{ fontSize: size }}>
        {value}
      </dd>
    </div>
  )
}

/** 칸 너비에 맞춘 글씨 크기: 숫자 한 글자 ≈ 0.6em, 한 줄에 다 들어가게. 최대 1rem */
export function fitSize(value: string): string {
  return `min(1rem, calc(100cqw / ${(value.length * 0.62).toFixed(2)}))`
}

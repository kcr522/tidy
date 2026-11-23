import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Transaction } from '../../../db/types'
import { categoryEmoji, isSpending } from '../../../lib/categories'
import { formatDateLabel, formatWon } from '../../../lib/format'
import { sortTransactions } from '../../../repositories/transactionRepo'
import {
  categoryColor,
  categoryShares,
  inPeriod,
  periodLabel,
  periodOf,
  shiftPeriod,
  shortWon,
  totalsByPeriod,
  type PeriodUnit,
} from '../../../lib/stats'
import { BarChart, Segmented, ShareRow } from './charts'

const UNITS = [
  ['week', '주별'],
  ['month', '월별'],
  ['year', '연별'],
] as const
const COUNT: Record<PeriodUnit, number> = { week: 8, month: 6, year: 5 }
const PREV_NAME: Record<PeriodUnit, string> = { week: '지난주', month: '지난달', year: '작년' }

/** 차트: 주별·월별·연별 지출 막대 + 그 기간의 카테고리별 지출 */
export default function ChartPanel({ items, today }: { items: Transaction[]; today: string }) {
  const [unit, setUnit] = useState<PeriodUnit>('month')
  const [selStart, setSelStart] = useState<string>(today)
  const [open, setOpen] = useState<string | null>(null)

  const current = periodOf(unit, today)
  const selected = useMemo(() => periodOf(unit, selStart), [unit, selStart])
  const count = COUNT[unit]
  // 고른 기간이 보이는 범위보다 오래되면 범위를 같이 옮긴다
  const windowStart = shiftPeriod(current, -(count - 1))
  const lastStart = selected.start >= windowStart.start ? current.start : shiftPeriod(selected, count - 1).start
  const rows = useMemo(() => totalsByPeriod(items, periodOf(unit, lastStart), count), [items, unit, lastStart, count])

  const inSel = useMemo(() => items.filter((t) => inPeriod(t, selected)), [items, selected])
  const shares = useMemo(() => categoryShares(inSel, 'EXPENSE'), [inSel])
  const expense = shares.reduce((s, x) => s + x.amount, 0)
  const prevPeriod = shiftPeriod(selected, -1)
  const prevExpense = items.reduce((s, t) => (isSpending(t) && inPeriod(t, prevPeriod) ? s + t.amount : s), 0)
  const diff = expense - prevExpense
  const isCurrent = selected.start === current.start

  function changeUnit(u: PeriodUnit) {
    setUnit(u)
    setSelStart(today)
    setOpen(null)
  }
  function move(delta: number) {
    setSelStart(shiftPeriod(selected, delta).start)
    setOpen(null)
  }

  return (
    <div className="space-y-4">
      <Segmented value={unit} options={UNITS} onChange={changeUnit} label="묶는 단위" />

      <section className="rounded-3xl bg-slate-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} className="tap rounded-full p-1.5 text-slate-500 hover:bg-white" aria-label="이전">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold text-slate-500">{periodLabel(selected)} 지출</p>
            <p className="text-2xl font-extrabold tracking-tight text-slate-900">{formatWon(expense)}</p>
            {(prevExpense > 0 || expense > 0) && (
              <p className={`mt-0.5 text-xs font-semibold ${diff > 0 ? 'text-expense' : 'text-income'}`}>
                {diff === 0
                  ? `${PREV_NAME[unit]}와 똑같이 썼어요`
                  : `${PREV_NAME[unit]}보다 ${formatWon(Math.abs(diff))} ${diff > 0 ? '더 썼어요' : '덜 썼어요'}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => move(1)}
            disabled={isCurrent}
            className="tap rounded-full p-1.5 text-slate-500 hover:bg-white disabled:opacity-30"
            aria-label="다음"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <BarChart
          data={rows.map((r) => ({ key: r.period.start, label: periodLabel(r.period, true), values: [r.expense] }))}
          colors={['var(--color-brand-500)']}
          names={['지출']}
          selected={selected.start}
          onSelect={(k) => {
            setSelStart(k)
            setOpen(null)
          }}
          ariaLabel={`${UNITS.find(([k]) => k === unit)?.[1]} 지출 막대 그래프`}
        />
        <p className="mt-2 text-center text-[11px] text-slate-400">
          막대를 누르면 그 기간을 볼 수 있어요 · 평균 {shortWon(Math.round(rows.reduce((s, r) => s + r.expense, 0) / rows.length))}원
        </p>
      </section>

      <section>
        <h3 className="mb-1 text-base font-extrabold">카테고리별 지출</h3>
        {shares.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 py-8 text-center text-sm text-slate-500">이 기간에는 지출이 없어요</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shares.map((s) => {
              const isOpen = open === s.category
              const list = isOpen ? sortTransactions(inSel.filter((t) => isSpending(t) && t.category === s.category)) : []
              return (
                <li key={s.category}>
                  <button
                    type="button"
                    className="w-full text-left"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : s.category)}
                  >
                    <ShareRow
                        color={categoryColor(s.category)}
                        label={`${categoryEmoji(s.category)} ${s.category}`}
                        sub={`${s.count}건`}
                        amount={s.amount}
                        percent={s.percent}
                      />
                  </button>
                  {isOpen && (
                    <ul className="mb-2 ml-5 space-y-1 rounded-2xl bg-slate-50 p-3">
                      {list.map((t) => (
                        <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="shrink-0 text-xs text-slate-400">{formatDateLabel(t.date)}</span>
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{t.memo || s.category}</span>
                          <span className="font-semibold text-slate-900">-{formatWon(t.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}
          </ul>
        )}
        {shares.length > 0 && (
          <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-slate-400">
            <ChevronDown className="size-3" aria-hidden />
            카테고리를 누르면 내역이 보여요
          </p>
        )}
      </section>
    </div>
  )
}

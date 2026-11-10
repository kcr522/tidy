import { useMemo } from 'react'
import type { Transaction } from '../../db/types'
import { dailyTotals, dayTitle, monthGrid, shortWon } from '../../lib/calendar'

interface Props {
  /** YYYY-MM */
  month: string
  today: string
  selected: string
  items: Transaction[]
  onSelect: (date: string) => void
  onAdd: (date: string) => void
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

/** 월간 가계부 달력: 날마다 수입(파랑)과 지출(빨강) */
export default function MoneyCalendar({ month, today, selected, items, onSelect, onAdd }: Props) {
  const days = useMemo(() => monthGrid(month), [month])
  const totals = useMemo(() => dailyTotals(items), [items])

  return (
    <section className="card mb-4 p-2 sm:p-4" aria-label="가계부 달력">
      <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500">
        {WEEK.map((w, i) => (
          <div key={w} className={`py-1.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-sky-500' : ''}`}>
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid">
        {days.map((d, i) => {
          const inMonth = d.slice(0, 7) === month
          const t = inMonth ? totals.get(d) : undefined
          const dow = i % 7
          const isSel = d === selected
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              disabled={!inMonth}
              aria-label={`${dayTitle(d)}${t?.income ? `, 수입 ${t.income}원` : ''}${t?.expense ? `, 지출 ${t.expense}원` : ''}`}
              onClick={() => onSelect(d)}
              onDoubleClick={() => onAdd(d)}
              className={`flex h-[68px] flex-col items-stretch rounded-xl px-1 pt-1 text-right sm:h-20 ${
                !inMonth ? 'opacity-0' : isSel ? 'bg-brand-50 ring-2 ring-brand-500/60 ring-inset' : 'bg-slate-50'
              }`}
            >
              <span
                className={`self-start rounded-full px-1.5 text-[13px] font-bold ${
                  d === today ? 'bg-grad on-grad' : dow === 0 ? 'text-red-400' : dow === 6 ? 'text-sky-500' : 'text-slate-700'
                }`}
              >
                {Number(d.slice(8))}
              </span>
              <span className="mt-auto mb-1 flex flex-col text-[10.5px] leading-tight font-semibold tabular-nums sm:text-xs">
                {t?.income ? <span className="truncate text-income">{shortWon(t.income)}</span> : null}
                {t?.expense ? <span className="truncate text-expense">{shortWon(t.expense)}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

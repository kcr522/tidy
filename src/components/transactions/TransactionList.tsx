import type { Transaction } from '../../db/types'
import { categoryEmoji } from '../../lib/categories'
import { formatDateLabel, formatWon } from '../../lib/format'
import { groupByDate } from '../../lib/summary'

interface TransactionListProps {
  items: Transaction[]
  onSelect: (t: Transaction) => void
}

/** 날짜별로 묶은 내역 목록 (FR-014) */
export default function TransactionList({ items, onSelect }: TransactionListProps) {
  const groups = groupByDate(items)
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.date} className="card overflow-hidden">
          <header className="flex items-center justify-between px-5 pt-4 pb-1 text-[13px]">
            <span className="font-bold text-slate-500">{formatDateLabel(g.date)}</span>
            <span className="font-medium text-slate-400">
              {g.income > 0 && <span className="mr-2 text-income">+{formatWon(g.income)}</span>}
              {g.expense > 0 && <span>-{formatWon(g.expense)}</span>}
            </span>
          </header>
          <ul className="pb-2">
            {g.items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg" aria-hidden>
                    {categoryEmoji(t.category)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-800">{t.memo || t.category}</span>
                    <span className="block text-xs text-slate-400">{t.category}</span>
                  </span>
                  <span className={`shrink-0 text-[15px] font-bold ${t.type === 'INCOME' ? 'text-income' : 'text-slate-900'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}
                    {formatWon(t.amount)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

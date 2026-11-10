import type { Transaction } from '../../db/types'
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
        <section key={g.date} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          <header className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-sm">
            <span className="font-semibold text-slate-700">{formatDateLabel(g.date)}</span>
            <span className="text-slate-500">
              {g.income > 0 && <span className="mr-2 text-income">+{formatWon(g.income)}</span>}
              {g.expense > 0 && <span className="text-expense">-{formatWon(g.expense)}</span>}
            </span>
          </header>
          <ul className="divide-y divide-slate-100">
            {g.items.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{t.category}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{t.memo || <span className="text-slate-400">메모 없음</span>}</span>
                  <span className={`shrink-0 font-semibold ${t.type === 'INCOME' ? 'text-income' : 'text-expense'}`}>
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

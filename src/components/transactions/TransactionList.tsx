import type { Transaction } from '../../db/types'
import { categoryEmoji } from '../../lib/categories'
import { formatDateLabel, formatTimeLabel, formatWon } from '../../lib/format'
import { matchMerchant } from '../../lib/merchants'
import { groupByDate } from '../../lib/summary'
import MerchantAvatar from './MerchantAvatar'

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
            {g.items.map((t) => {
              const m = matchMerchant(t.memo)
              return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <MerchantAvatar brand={m?.brand ?? null} category={t.category} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-800">{m ? m.display : t.memo || t.category}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {categoryEmoji(t.category)} {t.category}
                      {t.time && <> · {formatTimeLabel(t.time)}</>}
                      {t.account && <> · {t.account}</>}
                      {t.recurringId != null && <> · 🔁 정기</>}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[15px] font-bold ${t.type === 'INCOME' ? 'text-income' : 'text-slate-900'}`}>
                    {t.type === 'INCOME' ? '+' : '-'}
                    {formatWon(t.amount)}
                  </span>
                </button>
              </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

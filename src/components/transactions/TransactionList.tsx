import { PiggyBank } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Transaction } from '../../db/types'
import { isSaving } from '../../lib/categories'
import { CategoryIcon, MethodIcon } from '../common/MoneyIcon'
import { formatDateLabel, formatTimeLabel, formatWon } from '../../lib/format'
import { isUnclearMerchant, matchMerchant } from '../../lib/merchants'
import { groupByDate } from '../../lib/summary'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import MerchantAvatar from './MerchantAvatar'

interface TransactionListProps {
  items: Transaction[]
  onSelect: (t: Transaction) => void
}

/** 날짜별로 묶은 내역 목록 (FR-014) */
export default function TransactionList({ items, onSelect }: TransactionListProps) {
  const groups = groupByDate(items)
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <section key={g.date} className="card overflow-hidden">
          <header className="flex items-center justify-between px-5 pt-4 pb-1 text-[13px]">
            <span className="font-bold text-slate-500">{formatDateLabel(g.date)}</span>
            <span className="font-medium text-slate-400">
              {g.income > 0 && <span className="mr-2 text-income">+{formatWon(g.income)}</span>}
              {g.expense > 0 && <span>-{formatWon(g.expense)}</span>}
              {g.saving > 0 && <span className="ml-2 text-saving"><PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> {formatWon(g.saving)}</span>}
            </span>
          </header>
          <ul className="pb-2">
            {g.items.map((t) => {
              const m = matchMerchant(t.memo)
              const saving = isSaving(t)
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
                    {/* 메모는 가게 이름 아래 작은 글씨로 따로 (사용자 요청 2026-11-25) */}
                    {t.note && <span className="block truncate text-[13px] text-slate-500">{t.note}</span>}
                    <span className="block truncate text-xs text-slate-400">
                      <CategoryIcon category={t.category} /> {t.category}
                      {t.time && <> · {formatTimeLabel(t.time)}</>}
                      {t.account && (
                        <>
                          {' · '}
                          <span className="font-semibold text-slate-500">
                            <MethodIcon name={t.account} methods={methods} /> {t.account}
                          </span>
                        </>
                      )}
                      {t.recurringId != null && <> · 🔁 정기</>}
                      {!t.originalMemo && isUnclearMerchant(t.memo) && <span className="font-semibold text-amber-600"> · ❓ 어디서 썼나요?</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[15px] font-bold ${t.type === 'INCOME' ? 'text-income' : saving ? 'text-saving' : 'text-slate-900'}`}>
                    {t.type === 'INCOME' ? '+' : saving ? <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> : '-'}
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

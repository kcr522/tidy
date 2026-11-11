import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronRight, Target } from 'lucide-react'
import { budgetStatus } from '../../lib/budget'
import { budgetRepo } from '../../repositories/budgetRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import BudgetBar from './BudgetBar'

/** 가계부 위쪽: 그달 예산 막대. 예산이 없으면 "예산 정하기" 버튼만 */
export default function BudgetStrip({ year, month, today, onOpen }: { year: number; month: number; today: string; onOpen: () => void }) {
  const budgets = useLiveQuery(() => budgetRepo.list(), [])
  const items = useLiveQuery(() => transactionRepo.listByMonth(year, month), [year, month])
  if (!budgets || !items) return null
  const ym = `${year}-${String(month).padStart(2, '0')}`
  const status = budgetStatus(budgets, items, ym, today)

  if (!status.total) {
    return (
      <button type="button" onClick={onOpen} className="tap mb-4 flex w-full items-center gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-left text-sm font-semibold text-brand-700">
        <Target className="size-4 shrink-0" aria-hidden />
        <span className="flex-1">한 달 예산을 정하면 남은 돈을 알려 줘요</span>
        <ChevronRight className="size-4 shrink-0" aria-hidden />
      </button>
    )
  }
  const over = status.categories.filter((c) => c.level !== 'ok')
  return (
    <button type="button" onClick={onOpen} className="card tap mb-4 block w-full p-4 text-left" aria-label={`${month}월 예산 자세히`}>
      <BudgetBar line={status.total} label={`${month}월 예산`} perDay={status.perDay} />
      {over.length > 0 && (
        <p className="mt-2 truncate text-xs text-slate-500">
          {over.map((c) => `${c.category} ${c.pct}%`).join(' · ')}
        </p>
      )}
    </button>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { budgetStatus } from '../../lib/budget'
import { SAVING_CATEGORY } from '../../lib/categories'
import { useCategories } from '../common/MoneyIcon'
import { formatNumber, formatWon } from '../../lib/format'
import { budgetRepo, TOTAL } from '../../repositories/budgetRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import { useToast } from '../common/Toast'
import BudgetBar from './BudgetBar'

/** 가계부 ≡ 메뉴 > 예산: 한 달 전체 예산과 카테고리별 예산 정하기 */
export default function BudgetPanel({ today }: { today: string }) {
  const toast = useToast()
  const [year, month] = today.split('-').map(Number)
  const budgets = useLiveQuery(() => budgetRepo.list(), [])
  const categories = useCategories('EXPENSE')
  const items = useLiveQuery(() => transactionRepo.listByMonth(year, month), [year, month])
  if (!budgets || !items) return null
  const status = budgetStatus(budgets, items, today.slice(0, 7), today)
  const amountOf = (category: string) => budgets.find((b) => b.category === category)?.amount
  const catTotal = budgets.filter((b) => b.category !== TOTAL).reduce((s, b) => s + b.amount, 0)

  async function save(category: string, amount: number | null) {
    try {
      await budgetRepo.set(category, amount)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl bg-slate-50 p-4">
        <h3 className="mb-1 font-extrabold text-slate-900">한 달 예산</h3>
        <p className="mb-3 text-[13px] break-keep text-slate-500">매달 이만큼만 쓰기로 정해요. 80%를 쓰면, 그리고 넘으면 알려 줘요.</p>
        <AmountInput label="한 달 예산" value={amountOf(TOTAL)} onSave={(v) => save(TOTAL, v)} />
        {status.total && (
          <div className="mt-4">
            <BudgetBar line={status.total} label={`${month}월`} perDay={status.perDay} />
          </div>
        )}
      </section>

      <section>
        <h3 className="mb-1 font-extrabold text-slate-900">카테고리별 예산 (선택)</h3>
        <p className="mb-3 text-[13px] break-keep text-slate-500">
          식비, 쇼핑처럼 따로 정하고 싶은 것만 적어요.{catTotal > 0 && ` 지금 합계 ${formatWon(catTotal)}`}
        </p>
        <ul className="space-y-3">
          {/* 저축은 쓴 돈이 아니라서 예산에서 뺀다 */}
          {categories.filter((c) => c.name !== SAVING_CATEGORY).map(({ name: c }) => {
            const l = status.categories.find((x) => x.category === c)
            return (
              <li key={c} className="rounded-2xl border border-slate-100 p-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-sm font-semibold text-slate-700">{c}</span>
                  <AmountInput label={`${c} 예산`} value={amountOf(c)} onSave={(v) => save(c, v)} small />
                </div>
                {l && (
                  <div className="mt-2.5">
                    <BudgetBar line={l} label="이번 달" compact />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

/** 금액 칸: 쉼표를 넣어 보여 주고, 칸을 벗어나면 저장한다. 비우면 예산을 지운다 */
function AmountInput({ label, value, onSave, small }: { label: string; value: number | undefined; onSave: (v: number | null) => void; small?: boolean }) {
  const [text, setText] = useState(value ? formatNumber(value) : '')
  const [prev, setPrev] = useState(value)
  // 다른 곳에서 바뀌면 (백업 가져오기 등) 칸도 맞춘다
  if (prev !== value) {
    setPrev(value)
    setText(value ? formatNumber(value) : '')
  }
  function commit() {
    const n = Number(text.replace(/[^\d]/g, ''))
    if ((n || undefined) === value) return
    onSave(n > 0 ? Math.min(n, 999_999_999) : null)
  }
  return (
    <label className="flex min-w-0 flex-1 items-center gap-1 rounded-2xl bg-white px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand-500">
      <input
        aria-label={label}
        inputMode="numeric"
        value={text}
        placeholder="예산 없음"
        onChange={(e) => {
          const d = e.target.value.replace(/[^\d]/g, '').slice(0, 9)
          setText(d ? formatNumber(Number(d)) : '')
        }}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        className={`min-w-0 flex-1 bg-transparent text-right font-bold text-slate-900 tabular-nums outline-none placeholder:font-normal placeholder:text-slate-400 ${small ? 'min-h-10 text-[15px]' : 'min-h-12 text-lg'}`}
      />
      <span className="text-sm text-slate-500" aria-hidden>
        원
      </span>
    </label>
  )
}

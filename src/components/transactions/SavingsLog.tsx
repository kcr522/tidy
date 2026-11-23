import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, PiggyBank } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { SavingsPlan, Transaction } from '../../db/types'
import { isSaving, SAVING_CATEGORY } from '../../lib/categories'
import { formatDateLabel, formatNumber, formatWon } from '../../lib/format'
import { methodEmoji } from '../../lib/payMethods'
import { parseAmount } from '../../lib/validate'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { depositMemo } from '../../repositories/savingsRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'
import PayMethodPicker from '../payMethods/PayMethodPicker'

/** 가계부에 적힌 모든 저축 (예전 기록 포함), 최근 순 */
export function useSavingsLog(): Transaction[] | undefined {
  return useLiveQuery(async () => (await transactionRepo.listAll()).filter(isSaving).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [])
}

interface MonthGroup {
  ym: string
  total: number
  items: Transaction[]
}

export function groupByMonth(list: Transaction[]): MonthGroup[] {
  const out: MonthGroup[] = []
  for (const t of list) {
    const ym = t.date.slice(0, 7)
    let g = out.at(-1)
    if (!g || g.ym !== ym) {
      g = { ym, total: 0, items: [] }
      out.push(g)
    }
    g.items.push(t)
    g.total += t.amount
  }
  return out
}

/** 저축 내역: 달마다 묶어서, 어느 적금에 넣었는지와 함께 (사용자 요청 2026-11-23) */
export function SavingsLogList({ log, plans, onOpen }: { log: Transaction[]; plans: SavingsPlan[]; onOpen?: (t: Transaction) => void }) {
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const groups = useMemo(() => groupByMonth(log), [log])
  const planName = (id?: number) => plans.find((p) => p.id === id)?.name
  if (log.length === 0) return <p className="rounded-2xl bg-slate-50 py-6 text-center text-sm text-slate-500 break-keep">아직 저축 기록이 없어요. '저축 넣기'로 넣은 돈을 적어 보세요.</p>
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <section key={g.ym} className="rounded-2xl bg-slate-50 px-4 py-3">
          <header className="mb-1 flex items-center justify-between text-[13px]">
            <span className="font-bold text-slate-600">
              {g.ym.slice(0, 4)}년 {Number(g.ym.slice(5, 7))}월
            </span>
            <span className="flex items-center gap-1 font-bold text-saving"><PiggyBank className="size-4" aria-hidden /> {formatWon(g.total)}</span>
          </header>
          <ul className="divide-y divide-slate-200/70">
            {g.items.map((t) => {
              const plan = planName(t.savingsId)
              return (
                <li key={t.id}>
                  <button type="button" onClick={() => onOpen?.(t)} disabled={!onOpen} className="flex w-full items-center gap-3 py-2 text-left">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-slate-800">{plan ?? (t.memo || SAVING_CATEGORY)}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {formatDateLabel(t.date)}
                        {plan ? ' · 적금' : t.savingsId != null ? ' · 지운 적금' : ' · 자유 저축'}
                        {t.account && (
                          <>
                            {' · '}
                            {methodEmoji(t.account, methods)} {t.account}
                          </>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-bold text-saving tabular-nums">{formatWon(t.amount)}</span>
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

/** 저축 넣기: 얼마를, 어느 적금에 (적금이 아니면 자유 저축) */
export function DepositForm({ plans, today, onDone, onCancel }: { plans: SavingsPlan[]; today: string; onDone: () => void; onCancel: () => void }) {
  const active = plans.filter((p) => p.endDate >= today)
  const [planId, setPlanId] = useState<number | 0>(active[0]?.id ?? 0)
  const plan = plans.find((p) => p.id === planId)
  const [amountText, setAmountText] = useState(plan ? formatNumber(plan.amount) : '')
  const [date, setDate] = useState(today)
  const [memo, setMemo] = useState('')
  const [account, setAccount] = useState(plan?.fromAccount || plan?.bank || '')
  const [error, setError] = useState<string | undefined>()
  const toast = useToast()

  function pickPlan(id: number) {
    setPlanId(id)
    const p = plans.find((x) => x.id === id)
    if (p) {
      setAmountText(formatNumber(p.amount))
      setAccount(p.fromAccount || p.bank || '')
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const a = parseAmount(amountText)
    if (!a.ok) return setError(a.error)
    try {
      await transactionRepo.add({
        type: 'EXPENSE',
        amount: a.value,
        category: SAVING_CATEGORY,
        date,
        memo: plan ? depositMemo(plan) : memo.trim() || SAVING_CATEGORY,
        ...(account ? { account } : {}),
        ...(plan?.id != null ? { savingsId: plan.id } : {}),
      })
      toast(`${formatWon(a.value)} 저축했어요`)
      onDone()
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button type="button" onClick={onCancel} className="-ml-1 flex items-center gap-0.5 text-sm font-semibold text-slate-500">
        <ChevronLeft className="size-4" aria-hidden /> 저축
      </button>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">어디에 넣었나요?</span>
        <div className="flex flex-wrap gap-2">
          {[...plans.filter((p) => p.endDate >= today || p.id === planId), null].map((p) => {
            const id = p?.id ?? 0
            const on = planId === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => pickPlan(id)}
                aria-pressed={on}
                className={`tap rounded-full px-3.5 py-2 text-sm font-semibold ${on ? 'bg-saving text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> {p ? p.name : '자유 저축 (적금 아님)'}
              </button>
            )
          })}
        </div>
      </div>
      <Field label="넣은 돈" error={error}>
        <input
          value={amountText}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, '')
            setAmountText(digits ? formatNumber(Number(digits)) : '')
            setError(undefined)
          }}
          inputMode="numeric"
          placeholder="0"
          aria-label="넣은 돈"
          className={inputClass(!!error)}
        />
      </Field>
      <Field label="날짜">
        <input type="date" value={date} max="9999-12-31" onChange={(e) => setDate(e.target.value || today)} className={inputClass(false)} />
      </Field>
      {!plan && (
        <Field label="이름 (선택)">
          <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={50} placeholder="예: 비상금 통장, 여행 저금" className={inputClass(false)} />
        </Field>
      )}
      <PayMethodPicker value={account} onChange={setAccount} label="어느 계좌에서 (선택)" />
      <p className="text-xs text-slate-400 break-keep">저축은 지출 합계에 넣지 않고 저금통 안에 따로 모여요.</p>
      <Button type="submit" className="w-full">
        <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> 저축 넣기
      </Button>
    </form>
  )
}

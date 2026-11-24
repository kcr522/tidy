import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, Pencil, PiggyBank } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { SavingsPlan, Transaction } from '../../db/types'
import { isSaving, SAVING_CATEGORY } from '../../lib/categories'
import { formatDateLabel, formatNumber, formatWon } from '../../lib/format'
import { parseAmount } from '../../lib/validate'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { depositMemo, savingsRepo } from '../../repositories/savingsRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import { MethodIcon } from '../common/MoneyIcon'
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
                            <MethodIcon name={t.account} methods={methods} /> {t.account}
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
        <PlanChips plans={plans} today={today} value={planId} onChange={pickPlan} />
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

/** 어느 적금인지 고르는 칩: 끝나지 않은 적금 (+ 지금 고른 적금) + 자유 저축. 0 = 자유 저축 */
export function PlanChips({ plans, today, value, onChange }: { plans: SavingsPlan[]; today: string; value: number; onChange: (id: number) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="어느 적금">
      {[...plans.filter((p) => p.endDate >= today || p.id === value), null].map((p) => {
        const id = p?.id ?? 0
        const on = value === id
        return (
          <button
            key={id}
            type="button"
            role="radio"
            onClick={() => onChange(id)}
            aria-checked={on}
            className={`tap rounded-full px-3.5 py-2 text-sm font-semibold ${on ? 'bg-saving text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> {p ? p.name : '자유 저축 (적금 아님)'}
          </button>
        )
      })}
    </div>
  )
}

/** 이미 적힌 저축을 눌렀을 때: 어느 적금 돈인지 골라 그 적금 납입으로 센다 (사용자 요청 2026-11-24) */
export function LinkSavingForm({ item, plans, today, onDone, onCancel, onEdit }: { item: Transaction; plans: SavingsPlan[]; today: string; onDone: () => void; onCancel: () => void; onEdit?: () => void }) {
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const [planId, setPlanId] = useState<number>(item.savingsId != null && plans.some((p) => p.id === item.savingsId) ? item.savingsId : 0)
  const plan = plans.find((p) => p.id === planId)
  const toast = useToast()
  const changed = planId !== (item.savingsId ?? 0)

  async function save() {
    try {
      await savingsRepo.link(item.id!, plan?.id ?? null)
      toast(plan ? `${plan.name}에 넣었어요` : '자유 저축으로 바꿨어요')
      onDone()
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={onCancel} className="-ml-1 flex items-center gap-0.5 text-sm font-semibold text-slate-500">
        <ChevronLeft className="size-4" aria-hidden /> 저축
      </button>
      <section className="rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-[22px] font-extrabold text-saving tabular-nums">{formatWon(item.amount)}</p>
        <p className="mt-0.5 truncate text-sm text-slate-500">
          {formatDateLabel(item.date)}
          {item.memo && ` · ${item.memo}`}
          {item.account && (
            <>
              {' · '}
              <MethodIcon name={item.account} methods={methods} /> {item.account}
            </>
          )}
        </p>
      </section>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">어느 적금에 넣은 돈인가요?</span>
        <PlanChips plans={plans} today={today} value={planId} onChange={setPlanId} />
        {plans.length === 0 && <p className="mt-2 text-xs text-slate-400 break-keep">아직 적금이 없어요. '+ 적금 추가'로 먼저 만들어 주세요.</p>}
        <p className="mt-2 text-xs text-slate-400 break-keep">
          {plan
            ? plan.autoDeposit === 1
              ? '이 적금은 자동이체로 넣는 날마다 저절로 적혀요. 같은 돈이면 두 번 셀 수 있어요.'
              : `${plan.name} 납입 횟수와 모은 돈에 들어가요.`
            : '어느 적금에도 넣지 않고 모은 돈에만 들어가요.'}
        </p>
      </div>
      <Button className="w-full" disabled={!changed} onClick={() => void save()}>
        <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> {plan ? `${plan.name}에 넣기` : '자유 저축으로 두기'}
      </Button>
      {onEdit && (
        <button type="button" onClick={onEdit} className="mx-auto flex items-center gap-1 text-sm font-semibold text-slate-500">
          <Pencil className="size-3.5" aria-hidden /> 금액 · 날짜 고치기
        </button>
      )}
    </div>
  )
}

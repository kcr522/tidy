import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, BellOff, ChevronLeft, ImagePlus, Pencil, PiggyBank, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { Freq, InterestType, SavingsPlan, TaxType, Transaction } from '../../db/types'
import { SavingsAiError } from '../../lib/ai/savingsPrompt'
import { readSavings } from '../../lib/ai/savingsAi'
import { formatDateLabel, formatNumber, formatWon } from '../../lib/format'
import { shrinkImage } from '../../lib/image'
import { addMonthsKey, defaultSchedule, INTEREST_LABEL, maturity, progressOf, scheduleLabel, TAX_LABEL } from '../../lib/savings'
import { draftSize, type SavingsDraft } from '../../lib/savingsText'
import { methodEmoji } from '../../lib/payMethods'
import { parseAmount } from '../../lib/validate'
import { requestAlarmPermission } from '../../platform/alarms'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { depositMemo, savingsRepo, type SavingsInput } from '../../repositories/savingsRepo'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'
import PayMethodPicker from '../payMethods/PayMethodPicker'
import { DepositForm, SavingsLogList, useSavingsLog } from './SavingsLog'

type View = { mode: 'list' } | { mode: 'detail'; id: number } | { mode: 'form'; plan?: SavingsPlan } | { mode: 'deposit' }

/** 가계부 → 저축: 모은 돈, 저축 넣기, 적금 목록, 저축 내역 전체, 적금 자세히(만기 금액 계산), 입력 창 */
export default function SavingsManager({ today, startWith, onOpenTransaction }: { today: string; startWith?: 'new' | 'deposit'; onOpenTransaction?: (t: Transaction) => void }) {
  const plans = useLiveQuery(() => savingsRepo.list(), [])
  // 실제로 가계부에 기록된 납입 (적금 id → 합계, 횟수)
  const deposited = useLiveQuery(() => savingsRepo.depositedTotals(), [])
  const log = useSavingsLog()
  const [view, setView] = useState<View>(startWith === 'new' ? { mode: 'form' } : startWith === 'deposit' ? { mode: 'deposit' } : { mode: 'list' })
  const [deleting, setDeleting] = useState<SavingsPlan | null>(null)
  const toast = useToast()

  async function save(input: SavingsInput) {
    try {
      const editing = view.mode === 'form' ? view.plan : undefined
      let id: number
      if (editing?.id != null) {
        await savingsRepo.update(editing.id, input)
        id = editing.id
      } else id = await savingsRepo.add(input)
      const n = await savingsRepo.runDue(today)
      toast(editing ? '수정했어요' : n > 0 ? `적금을 만들고 지난 납입 ${n}건을 기록했어요` : '적금을 만들고 습관에도 추가했어요')
      setView({ mode: 'detail', id })
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    await savingsRepo.remove(deleting.id)
    toast('적금을 지웠어요. 가계부에 기록된 납입 내역은 남아 있어요')
    setDeleting(null)
    setView({ mode: 'list' })
  }

  const detail = view.mode === 'detail' ? plans?.find((p) => p.id === view.id) : undefined

  return (
    <>
      {view.mode === 'deposit' ? (
        plans && <DepositForm plans={plans} today={today} onDone={() => setView({ mode: 'list' })} onCancel={() => setView({ mode: 'list' })} />
      ) : view.mode === 'form' ? (
        <SavingsForm key={view.plan?.id ?? 'new'} initial={view.plan} today={today} onSubmit={save} onCancel={() => setView(view.plan?.id != null ? { mode: 'detail', id: view.plan.id } : { mode: 'list' })} />
      ) : detail ? (
        <SavingsDetail plan={detail} today={today} deposited={deposited?.get(detail.id!)} onBack={() => setView({ mode: 'list' })} onEdit={() => setView({ mode: 'form', plan: detail })} onDelete={() => setDeleting(detail)} />
      ) : (
        <SavingsList
          plans={plans}
          deposited={deposited}
          log={log}
          today={today}
          onOpen={(id) => setView({ mode: 'detail', id })}
          onAdd={() => setView({ mode: 'form' })}
          onDeposit={() => setView({ mode: 'deposit' })}
          onOpenTransaction={onOpenTransaction}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title="적금 지우기"
        message="적금과 같이 만든 습관을 지울까요? 가계부에 기록된 납입 내역은 남아요."
        confirmLabel="지우기"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

type Deposited = Map<number, { count: number; amount: number }>

interface ListProps {
  plans?: SavingsPlan[]
  deposited?: Deposited
  log?: Transaction[]
  today: string
  onOpen: (id: number) => void
  onAdd: () => void
  onDeposit: () => void
  onOpenTransaction?: (t: Transaction) => void
}

function SavingsList({ plans, deposited, log, today, onOpen, onAdd, onDeposit, onOpenTransaction }: ListProps) {
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const totals = useMemo(() => {
    if (!plans) return null
    return plans.reduce((acc, p) => ({ net: acc.net + maturity(p).netTotal }), { net: 0 })
  }, [plans])
  // 모은 돈: 적금 납입 + 자유 저축 + 예전 기록까지 가계부의 저축 전부
  const saved = (log ?? []).reduce((s, t) => s + t.amount, 0)
  const ym = today.slice(0, 7)
  const thisMonth = (log ?? []).reduce((s, t) => (t.date.startsWith(ym) ? s + t.amount : s), 0)

  return (
    <div>
      {((plans && plans.length > 0) || saved > 0) && totals && (
        <section className="bg-grad on-grad mb-4 rounded-3xl p-5 shadow-float">
          <p className="text-sm font-semibold opacity-85">지금까지 모은 돈</p>
          <p className="text-[28px] leading-tight font-extrabold tracking-tight">{formatWon(saved)}</p>
          <p className="mt-1 text-sm font-semibold opacity-90">
            이번 달 {formatWon(thisMonth)}
            {plans && plans.length > 0 && ` · 만기에 받을 돈 (세후) ${formatWon(totals.net)}`}
          </p>
        </section>
      )}
      <div className="mb-5 flex gap-2">
        <Button className="flex-1" onClick={onDeposit}>
          <PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> 저축 넣기
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onAdd}>
          + 적금 추가
        </Button>
      </div>
      <h3 className="mb-2 text-base font-extrabold text-slate-900">적금</h3>
      {plans === undefined ? null : plans.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
          <PiggyBank className="mx-auto size-9 text-slate-300" aria-hidden />
          <p className="mt-2 text-[15px] font-semibold text-slate-600">아직 적금이 없어요</p>
          <p className="mt-1 text-sm text-slate-400 break-keep">은행 앱 화면을 캡처해서 올리면 AI가 칸을 채워 줘요.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {plans.map((p) => {
            const pr = progressOf(p, today)
            const m = maturity(p)
            const got = deposited?.get(p.id!) ?? { count: 0, amount: 0 }
            const pct = pr.total ? Math.round((got.count / pr.total) * 100) : 0
            return (
              <li key={p.id}>
                <button type="button" onClick={() => onOpen(p.id!)} className="w-full rounded-2xl bg-slate-50 p-4 text-left hover:bg-slate-100">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-grad-soft text-saving"><PiggyBank className="size-5" aria-hidden /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold text-slate-800">{p.name}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {p.bank ? `${p.bank} · ` : ''}
                        {scheduleLabel(p.schedule)} {formatWon(p.amount)} · 연 {p.rate}%
                      </span>
                      {p.fromAccount && (
                        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
                          {methodEmoji(p.fromAccount, methods)} {p.fromAccount}에서 나가요
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-extrabold text-brand-600">{pr.matured ? '만기' : `D-${pr.daysLeft}`}</span>
                      {p.alarmOn === 1 && <Bell className="ml-auto size-3.5 text-slate-400" aria-label="알림 켜짐" />}
                    </span>
                  </div>
                  <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-label={`${p.name} 납입`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="bg-grad h-full rounded-full" style={{ width: `${Math.max(pct, 3)}%` }} />
                  </div>
                  <p className="mt-1.5 flex justify-between text-xs text-slate-500">
                    <span>
                      {formatWon(got.amount)} ({got.count}/{pr.total}회)
                    </span>
                    <span className="font-semibold text-slate-700">만기 세후 {formatWon(m.netTotal)}</span>
                  </p>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <h3 className="mt-6 mb-2 text-base font-extrabold text-slate-900">저축 내역</h3>
      {log && plans && <SavingsLogList log={log} plans={plans} onOpen={onOpenTransaction} />}
    </div>
  )
}

function Row({ label, value, strong, sub }: { label: string; value: ReactNode; strong?: boolean; sub?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-3 py-1.5 ${sub ? 'text-sm text-slate-500' : ''}`}>
      <dt className={sub ? '' : 'text-slate-600'}>{label}</dt>
      <dd className={strong ? 'text-lg font-extrabold text-slate-900' : 'font-semibold text-slate-800'}>{value}</dd>
    </div>
  )
}

function SavingsDetail({ plan, today, deposited, onBack, onEdit, onDelete }: { plan: SavingsPlan; today: string; deposited?: { count: number; amount: number }; onBack: () => void; onEdit: () => void; onDelete: () => void }) {
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const m = maturity(plan)
  const pr = progressOf(plan, today)
  return (
    <div>
      <button type="button" onClick={onBack} className="mb-3 -ml-1 flex items-center gap-0.5 text-sm font-semibold text-slate-500">
        <ChevronLeft className="size-4" aria-hidden /> 적금 목록
      </button>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-grad-soft text-saving"><PiggyBank className="size-6" aria-hidden /></span>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold">{plan.name}</p>
          <p className="text-sm text-slate-500">
            {plan.bank ? `${plan.bank} · ` : ''}
            {formatDateLabel(plan.startDate)} ~ {formatDateLabel(plan.endDate)}
          </p>
        </div>
      </div>

      <section className="bg-grad on-grad rounded-3xl p-5 shadow-float">
        <p className="text-sm font-semibold opacity-85">만기에 받을 돈 (세후)</p>
        <p className="text-[30px] leading-tight font-extrabold tracking-tight">{formatWon(m.netTotal)}</p>
        <p className="mt-1 text-sm font-semibold opacity-90">세전 {formatWon(m.grossTotal)}</p>
      </section>

      <dl className="mt-4 rounded-2xl bg-slate-50 px-4 py-2">
        <Row label={`원금 (${formatWon(plan.amount)} × ${m.count}회)`} value={formatWon(m.principal)} />
        <Row label={`이자 (연 ${plan.rate}%, ${INTEREST_LABEL[plan.interestType]})`} value={`+${formatWon(m.interest)}`} />
        <Row label={`세금 (${TAX_LABEL[plan.taxType]})`} value={m.tax ? `-${formatWon(m.tax)}` : '없음'} />
        <div className="my-1 border-t border-slate-200" />
        <Row label="세후 이자" value={`+${formatWon(m.netInterest)}`} />
        <Row label="받을 돈 (세후)" value={formatWon(m.netTotal)} strong />
      </dl>

      <dl className="mt-3 rounded-2xl bg-slate-50 px-4 py-2">
        <Row label="넣는 날" value={`${scheduleLabel(plan.schedule)} ${formatWon(plan.amount)}`} />
        <Row label="지금까지 넣은 돈" value={`${formatWon(deposited?.amount ?? 0)} (${deposited?.count ?? 0}/${pr.total}회)`} />
        {plan.autoDeposit !== 1 && pr.done > (deposited?.count ?? 0) && <Row sub label="넣을 차례였던 횟수" value={`${pr.done}회`} />}
        <Row label="다음 넣는 날" value={pr.next ? formatDateLabel(pr.next) : '다 넣었어요'} />
        <Row label="만기까지" value={pr.matured ? '만기됐어요 🎉' : `${pr.daysLeft}일`} />
        <Row label="나가는 계좌" value={plan.fromAccount ? `${methodEmoji(plan.fromAccount, methods)} ${plan.fromAccount}` : plan.bank ? `${plan.bank} (정해 두지 않음)` : '정해 두지 않음'} />
        <Row label="기록 방법" value={plan.autoDeposit === 1 ? '자동이체 (넣는 날 자동 기록)' : '습관 체크하면 기록'} />
        <Row
          label="알림"
          value={
            plan.alarmOn === 1 ? (
              <span className="flex items-center gap-1">
                <Bell className="size-4" aria-hidden /> {scheduleLabel(plan.schedule)} {plan.alarmTime}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400">
                <BellOff className="size-4" aria-hidden /> 꺼짐
              </span>
            )
          }
        />
      </dl>
      <p className="mt-2 px-1 text-xs text-slate-400 break-keep">할 일 → 습관 탭에 '{depositMemo(plan)} 넣기'가 같이 만들어졌어요. 계산은 은행과 몇 원 다를 수 있어요.</p>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" className="text-expense" onClick={onDelete} aria-label="적금 지우기">
          <Trash2 className="size-4" aria-hidden />
        </Button>
        <Button className="flex-1" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> 고치기
        </Button>
      </div>
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label={label}>
      {options.map(([k, text]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={`min-h-10 flex-1 rounded-xl px-1 text-sm font-semibold whitespace-nowrap ${value === k ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-grad' : 'bg-slate-300'}`}>
      <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}

const FREQS = [
  ['daily', '매일'],
  ['weekly', '매주'],
  ['monthly', '매달'],
] as const
const TERMS = [6, 12, 24, 36]
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

interface FormProps {
  initial?: SavingsPlan
  today: string
  onSubmit: (input: SavingsInput) => Promise<void>
  onCancel: () => void
}

function SavingsForm({ initial, today, onSubmit, onCancel }: FormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [bank, setBank] = useState(initial?.bank ?? '')
  const [fromAccount, setFromAccount] = useState(initial?.fromAccount ?? '')
  const [amountText, setAmountText] = useState(initial ? formatNumber(initial.amount) : '')
  const [startDate, setStartDate] = useState(initial?.startDate ?? today)
  const [endDate, setEndDate] = useState(initial?.endDate ?? addMonthsKey(today, 12))
  const [rateText, setRateText] = useState(initial ? String(initial.rate) : '')
  const [interestType, setInterestType] = useState<InterestType>(initial?.interestType ?? 'simple')
  const [taxType, setTaxType] = useState<TaxType>(initial?.taxType ?? 'normal')
  const [freq, setFreq] = useState<Freq>(initial?.schedule.freq ?? 'monthly')
  const [day, setDay] = useState(initial?.schedule.day ?? Number(today.slice(8)))
  const [weekday, setWeekday] = useState(initial?.schedule.weekday ?? new Date(`${today}T00:00`).getDay())
  const [autoDeposit, setAutoDeposit] = useState(initial ? initial.autoDeposit === 1 : true)
  const [alarmOn, setAlarmOn] = useState(initial ? initial.alarmOn === 1 : false)
  const [alarmTime, setAlarmTime] = useState(initial?.alarmTime ?? '09:00')
  const [errors, setErrors] = useState<Partial<Record<'name' | 'amount' | 'rate' | 'endDate', string>>>({})
  const [filled, setFilled] = useState<string | null>(null)
  const toast = useToast()

  const schedule = freq === 'daily' ? { freq } : freq === 'weekly' ? { freq, weekday } : { freq, day }
  const amount = parseAmount(amountText)
  const rate = Number(rateText)
  const preview =
    amount.ok && rateText !== '' && Number.isFinite(rate) && endDate > startDate ? maturity({ amount: amount.value, rate, interestType, taxType, schedule, startDate, endDate }) : null
  const months = Math.round(((new Date(`${endDate}T00:00`).getTime() - new Date(`${startDate}T00:00`).getTime()) / 86400000 / 30.4375) * 10) / 10

  function changeStart(v: string) {
    if (!v) return
    // 기간은 그대로 두고 만기일을 같이 옮긴다
    const term = TERMS.find((t) => addMonthsKey(startDate, t) === endDate)
    setStartDate(v)
    if (term) setEndDate(addMonthsKey(v, term))
    if (!initial) {
      const s = defaultSchedule(freq, v)
      if (s.day) setDay(s.day)
      if (s.weekday !== undefined) setWeekday(s.weekday)
    }
  }

  function apply(d: SavingsDraft) {
    if (d.name) setName(d.name.slice(0, 30))
    if (d.bank) setBank(d.bank)
    if (d.amount) setAmountText(formatNumber(d.amount))
    const start = d.startDate ?? startDate
    if (d.startDate) setStartDate(d.startDate)
    if (d.endDate) setEndDate(d.endDate)
    else if (d.months) setEndDate(addMonthsKey(start, d.months))
    if (d.rate !== undefined) setRateText(String(d.rate))
    if (d.interestType) setInterestType(d.interestType)
    if (d.taxType) setTaxType(d.taxType)
    if (d.freq) setFreq(d.freq)
    if (d.day) setDay(d.day)
    else if (d.freq === 'monthly') setDay(Number(start.slice(8)))
    if (d.weekday !== undefined) setWeekday(d.weekday)
  }

  async function toggleAlarm(next: boolean) {
    setAlarmOn(next)
    if (!next) return
    const p = await requestAlarmPermission().catch(() => 'unsupported' as const)
    if (p === 'denied') toast('알림이 막혀 있어요. 기기 설정에서 Tidy 알림을 허용해 주세요', 'error')
    if (p === 'unsupported') toast('이 브라우저는 알림을 못 띄워요. 앱을 열면 안내해 드릴게요')
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const next: typeof errors = {}
    if (!name.trim()) next.name = '이름을 적어 주세요 (예: 청년적금)'
    if (!amount.ok) next.amount = amount.error
    if (rateText === '' || !Number.isFinite(rate) || rate < 0 || rate > 50) next.rate = '연 이율을 0~50 사이로 적어 주세요'
    if (endDate <= startDate) next.endDate = '만기일은 가입일보다 뒤여야 해요'
    setErrors(next)
    if (!amount.ok || Object.keys(next).length > 0) return
    await onSubmit({
      name: name.trim().slice(0, 30),
      bank: bank.trim() || undefined,
      fromAccount: fromAccount.trim() || undefined,
      amount: amount.value,
      startDate,
      endDate,
      rate,
      interestType,
      taxType,
      schedule,
      autoDeposit: autoDeposit ? 1 : 0,
      alarmOn: alarmOn ? 1 : 0,
      alarmTime,
      memo: initial?.memo ?? '',
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!initial && <AiFill today={today} onFill={(d, by) => (apply(d), setFilled(by))} />}
      {filled && (
        <p className="-mt-2 rounded-2xl bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand-700 break-keep">
          {filled} 채웠어요. 맞는지 한 번 확인하고 저장해 주세요.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="적금 이름" error={errors.name}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 청년적금" maxLength={30} className={inputClass(!!errors.name)} />
        </Field>
        <Field label="은행 (선택)">
          <input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="예: 카카오뱅크" maxLength={30} className={inputClass(false)} />
        </Field>
      </div>

      {/* 어느 계좌에서 나가는지: 넣을 때 가계부 내역의 결제 수단 칸에 들어간다 */}
      <PayMethodPicker value={fromAccount} onChange={setFromAccount} label="돈이 나가는 계좌 (선택)" />

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">넣는 날</span>
        <Segmented value={freq} options={FREQS} onChange={setFreq} label="넣는 주기" />
        {freq === 'weekly' && (
          <div className="mt-2 grid grid-cols-7 gap-1" role="radiogroup" aria-label="요일">
            {WEEK.map((w, i) => (
              <button key={w} type="button" role="radio" aria-checked={weekday === i} onClick={() => setWeekday(i)} className={`min-h-10 rounded-xl text-sm font-semibold ${weekday === i ? 'bg-grad on-grad' : 'bg-slate-100 text-slate-500'}`}>
                {w}
              </button>
            ))}
          </div>
        )}
        {freq === 'monthly' && (
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={`${inputClass(false)} mt-2`} aria-label="매달 며칠">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                매달 {d === 31 ? '말일' : `${d}일`}
              </option>
            ))}
          </select>
        )}
      </div>

      <Field label={`한 번에 넣는 돈 (${scheduleLabel(schedule)})`} error={errors.amount}>
        <div className="relative">
          <input
            inputMode="numeric"
            value={amountText}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9)
              setAmountText(digits ? formatNumber(Number(digits)) : '')
            }}
            placeholder="0"
            className={`${inputClass(!!errors.amount)} pr-10 text-right text-lg font-bold`}
          />
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500">원</span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="가입일 (첫 납입)">
          <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} className={inputClass(false)} />
        </Field>
        <Field label={`만기일 (${months}개월)`} error={errors.endDate}>
          <input type="date" value={endDate} onChange={(e) => e.target.value && setEndDate(e.target.value)} className={inputClass(!!errors.endDate)} />
        </Field>
      </div>
      <div className="-mt-2 flex gap-1.5">
        {TERMS.map((t) => {
          const on = addMonthsKey(startDate, t) === endDate
          return (
            <button key={t} type="button" onClick={() => setEndDate(addMonthsKey(startDate, t))} aria-pressed={on} className={`rounded-full px-3 py-1.5 text-xs font-bold ${on ? 'bg-grad on-grad' : 'bg-slate-100 text-slate-500'}`}>
              {t}개월
            </button>
          )
        })}
      </div>

      <Field label="연 이율 (우대금리 포함)" error={errors.rate}>
        <div className="relative">
          <input inputMode="decimal" value={rateText} onChange={(e) => setRateText(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} placeholder="3.5" className={`${inputClass(!!errors.rate)} pr-10 text-right text-lg font-bold`} />
          <span className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500">%</span>
        </div>
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">이자 계산</span>
        <Segmented value={interestType} options={[['simple', '단리'], ['compound', '월복리']] as const} onChange={setInterestType} label="이자 계산" />
      </div>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">이자 세금</span>
        <Segmented value={taxType} options={[['normal', '일반 15.4%'], ['preferential', '세금우대 9.5%'], ['free', '비과세']] as const} onChange={setTaxType} label="이자 세금" />
      </div>

      {preview && (
        <section className="rounded-2xl bg-grad-soft px-4 py-3" aria-live="polite">
          <p className="text-xs font-semibold text-slate-500">
            원금 {formatWon(preview.principal)} ({preview.count}회) + 이자 {formatWon(preview.interest)}
          </p>
          <div className="mt-1 flex items-end justify-between">
            <span className="text-sm text-slate-600">세전 {formatWon(preview.grossTotal)}</span>
            <span className="text-right">
              <span className="block text-xs text-slate-500">만기에 받을 돈 (세후)</span>
              <span className="text-xl font-extrabold text-slate-900">{formatWon(preview.netTotal)}</span>
            </span>
          </div>
        </section>
      )}

      <div className="space-y-3 rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-slate-800">자동이체예요</span>
            <span className="block text-xs text-slate-500 break-keep">{autoDeposit ? '넣는 날 가계부에 자동으로 기록하고 습관도 체크해요' : '습관 탭에서 체크하면 그날 가계부에 기록돼요'}</span>
          </span>
          <Toggle on={autoDeposit} onChange={setAutoDeposit} label="자동이체" />
        </div>
        <div className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-slate-800">넣는 날 알림</span>
            <span className="block text-xs text-slate-500">{alarmOn ? `${scheduleLabel(schedule)} ${alarmTime}에 알려 드려요` : '꺼져 있어요'}</span>
          </span>
          <Toggle on={alarmOn} onChange={(v) => void toggleAlarm(v)} label="넣는 날 알림" />
        </div>
        {alarmOn && <input type="time" value={alarmTime} onChange={(e) => e.target.value && setAlarmTime(e.target.value)} className={inputClass(false)} aria-label="알림 시각" />}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" className="flex-1">
          {initial ? '저장' : '적금 만들기'}
        </Button>
      </div>
    </form>
  )
}

/** 붙여 넣은 글이나 캡처를 AI가 읽고 칸을 채운다 */
function AiFill({ today, onFill }: { today: string; onFill: (d: SavingsDraft, by: string) => void }) {
  const [text, setText] = useState('')
  const [image, setImage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function pick(file?: File) {
    if (!file) return
    try {
      setImage(await shrinkImage(file, 1600, 0.85))
      setError(null)
    } catch {
      setError('사진을 열지 못했어요')
    }
  }

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const img = image ? { mediaType: 'image/jpeg' as const, data: image.split(',')[1] } : undefined
      const res = await readSavings({ today, ...(text.trim() ? { text } : {}), ...(img ? { image: img } : {}) })
      if (draftSize(res.draft) === 0) setError('적금 정보를 찾지 못했어요. 직접 적어 주세요')
      else onFill(res.draft, res.by === 'ai' ? 'AI가' : res.note ? `AI 연결이 안 돼서(${res.note}) 글에서 찾아` : '글에서 찾아')
    } catch (err) {
      setError(err instanceof SavingsAiError ? err.message : '읽지 못했어요. 다시 해 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-slate-200 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">
        <Sparkles className="size-4 text-brand-500" aria-hidden /> AI로 채우기
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="은행 앱의 상품 설명이나 가입 완료 문자를 붙여 넣으세요"
        className={`${inputClass(false)} resize-none py-3 text-sm`}
        aria-label="적금 정보 붙여 넣기"
      />
      {image && (
        <div className="relative mt-2 inline-block">
          <img src={image} alt="올린 캡처" className="h-24 rounded-xl object-cover" />
          <button type="button" onClick={() => setImage(null)} className="absolute -top-2 -right-2 rounded-full bg-slate-700 p-1 text-white" aria-label="캡처 빼기">
            <X className="size-3" aria-hidden />
          </button>
        </div>
      )}
      <div className="mt-2 flex gap-2">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
        <Button variant="secondary" className="px-3.5" onClick={() => fileRef.current?.click()}>
          <ImagePlus className="size-4" aria-hidden /> 캡처
        </Button>
        <Button className="flex-1" disabled={busy || (!text.trim() && !image)} onClick={() => void run()}>
          {busy ? '읽는 중…' : '읽고 채우기'}
        </Button>
      </div>
      {error && <p className="mt-2 text-sm text-expense">{error}</p>}
    </section>
  )
}

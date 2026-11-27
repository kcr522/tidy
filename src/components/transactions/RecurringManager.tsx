import { addDays } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, Check, Pause, Play, Repeat, Sparkles, Trash2, X } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import type { Recurring, TransactionType } from '../../db/types'
import { categoriesFor, resolveCategory } from '../../lib/categories'
import { useCategories } from '../common/MoneyIcon'
import { parseDateKey, toDateKey } from '../../lib/date'
import { formatDateLabel, formatNumber, formatWon } from '../../lib/format'
import { matchMerchant } from '../../lib/merchants'
import { dayLabel, ddayFor, ddayLabel } from '../../lib/recurring'
import { fixedSummary, hasRemind, REMIND_CHOICES } from '../../lib/recurringAlarms'
import { guessRecurring, hideGuess, loadHiddenGuesses, type RecurringGuess } from '../../lib/recurringGuess'
import { requestAlarmPermission } from '../../platform/alarms'
import { transactionRepo } from '../../repositories/transactionRepo'
import { parseAmount } from '../../lib/validate'
import { recurringRepo, type RecurringInput } from '../../repositories/recurringRepo'
import Button from '../common/Button'
import PayMethodPicker from '../payMethods/PayMethodPicker'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'
import MerchantAvatar from './MerchantAvatar'

export type RecurringPreset = Partial<Pick<RecurringInput, 'type' | 'category' | 'memo' | 'amount' | 'account' | 'day' | 'startDate'>>

interface Props {
  today: string
  /** 처음부터 입력 창을 열 때 미리 채울 값 (예: 월급) */
  preset?: RecurringPreset
}

/** 정기 내역: 매달 같은 날 자동으로 기록되는 수입/지출 목록과 입력 창 */
export default function RecurringManager({ today, preset }: Props) {
  const rules = useLiveQuery(() => recurringRepo.list(), [])
  const [editing, setEditing] = useState<Recurring | 'new' | null>(preset ? 'new' : null)
  // 가계부에서 찾은 "매달 나가는 것 같은" 지출을 눌렀을 때 미리 채울 값
  const [guessPreset, setGuessPreset] = useState<RecurringPreset | undefined>()
  const [hidden, setHidden] = useState(loadHiddenGuesses)
  const items = useLiveQuery(() => transactionRepo.listAll(), [])
  const guesses = useMemo(() => (items && rules ? guessRecurring(items, rules, today, hidden) : []), [items, rules, today, hidden])
  const summary = rules ? fixedSummary(rules, today) : null
  const toast = useToast()

  function pickGuess(g: RecurringGuess) {
    setGuessPreset({ type: 'EXPENSE', memo: g.memo, amount: g.amount, category: g.category, account: g.account, day: g.day, startDate: toDateKey(addDays(parseDateKey(g.lastDate), 1)) })
    setEditing('new')
  }

  function dismissGuess(g: RecurringGuess) {
    hideGuess(g.key)
    setHidden((h) => [...h, g.key])
  }

  async function save(input: RecurringInput) {
    try {
      if (editing && editing !== 'new' && editing.id != null) await recurringRepo.update(editing.id, input)
      else await recurringRepo.add(input)
      const added = await recurringRepo.runDue(today)
      toast(added > 0 ? `저장하고 ${added}건을 바로 기록했어요` : input.remindDays != null ? '저장했어요. 결제일 전에 알려 드릴게요' : '저장했어요')
      setEditing(null)
      setGuessPreset(undefined)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function remove(r: Recurring) {
    if (r.id == null) return
    await recurringRepo.remove(r.id)
    toast('정기 내역을 지웠어요. 이미 기록된 내역은 남아 있어요')
    setEditing(null)
  }

  if (editing) {
    return (
      <RecurringForm
        key={editing === 'new' ? 'new' : editing.id}
        initial={editing === 'new' ? undefined : editing}
        preset={editing === 'new' ? (guessPreset ?? preset) : undefined}
        today={today}
        onSubmit={save}
        onCancel={() => {
          setEditing(null)
          setGuessPreset(undefined)
        }}
        onDelete={editing !== 'new' ? () => remove(editing) : undefined}
      />
    )
  }

  return (
    <div>
      <p className="mb-4 text-sm text-slate-500">월급, 통신비, 구독료처럼 매달 같은 날 생기는 내역은 여기 한 번만 적어 두면 그날 가계부에 자동으로 기록돼요. 결제일 전에 알림도 받을 수 있어요.</p>
      {summary && summary.monthly > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl bg-brand-50 p-3 text-center">
          <SummaryCell label="매달 고정 지출" value={formatWon(summary.monthly)} />
          <SummaryCell label="1년이면" value={formatWon(summary.yearly)} />
          <SummaryCell label="이번 달 남은 결제" value={summary.leftCount > 0 ? `${summary.leftCount}건 ${formatWon(summary.leftAmount)}` : '다 나갔어요'} />
          {summary.askCount > 0 && <p className="col-span-3 text-[11px] text-slate-400">금액이 매달 다른 {summary.askCount}건은 합에서 뺐어요</p>}
        </div>
      )}
      {guesses.length > 0 && (
        <div className="mb-4 rounded-2xl border border-dashed border-brand-200 p-3">
          <p className="mb-2 flex items-center gap-1 text-sm font-bold text-brand-700">
            <Sparkles className="size-4" aria-hidden />
            가계부를 보니 매달 나가는 것 같아요
          </p>
          <ul className="space-y-1.5">
            {guesses.map((g) => {
              const m = matchMerchant(g.memo)
              return (
                <li key={g.key} className="flex items-center gap-2">
                  <MerchantAvatar brand={m?.brand ?? null} category={g.category} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-800">{g.memo}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {dayLabel(g.day)} · {formatWon(g.amount)} · {g.months}달째
                    </span>
                  </span>
                  <button type="button" onClick={() => pickGuess(g)} className="tap shrink-0 rounded-full bg-grad px-3 py-1.5 text-xs font-bold text-white">
                    정기로 등록
                  </button>
                  <button type="button" onClick={() => dismissGuess(g)} className="tap shrink-0 rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label={`${g.memo} 정기 아님`} title="아니에요">
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {rules === undefined ? null : rules.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
          <Repeat className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-2 text-[15px] font-semibold text-slate-600">아직 정기 내역이 없어요</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-slate-50">
          {rules.map((r) => {
            const m = matchMerchant(r.memo)
            const d = ddayFor(r.day, today)
            const paused = r.isActive !== 1
            return (
              <li key={r.id} className={`flex items-center gap-1 pr-2 ${paused ? 'opacity-50' : ''}`}>
                <button type="button" onClick={() => setEditing(r)} className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3 text-left">
                  <MerchantAvatar brand={m?.brand ?? null} category={r.category} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-slate-800">{m ? m.display : r.memo}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {hasRemind(r) && !paused && <Bell className="mr-0.5 inline size-3 -translate-y-px text-brand-500" aria-label="미리 알림" />}
                      {dayLabel(r.day)} · {paused ? '멈춤' : d.daysLeft === 0 ? (r.askAmount === 1 ? '오늘 금액을 물어봐요' : '오늘 기록돼요') : `다음 ${formatDateLabel(d.date)} (${ddayLabel(d.daysLeft)})`}
                    </span>
                  </span>
                  <span className={`shrink-0 text-[15px] font-bold ${r.type === 'INCOME' ? 'text-income' : 'text-slate-900'}`}>
                    {r.askAmount === 1 ? (
                      <span className="text-xs font-semibold text-slate-400">그날 입력</span>
                    ) : (
                      <>
                        {r.type === 'INCOME' ? '+' : '-'}
                        {formatWon(r.amount)}
                      </>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => r.id != null && recurringRepo.setActive(r.id, paused)}
                  className="tap rounded-full p-2 text-slate-400 hover:bg-slate-200"
                  aria-label={`${r.memo} ${paused ? '다시 켜기' : '멈추기'}`}
                  title={paused ? '다시 켜기' : '멈추기'}
                >
                  {paused ? <Play className="size-4" aria-hidden /> : <Pause className="size-4" aria-hidden />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Button className="mt-4 w-full" onClick={() => setEditing('new')}>
        + 정기 내역 추가
      </Button>
    </div>
  )
}

interface FormProps {
  initial?: Recurring
  preset?: RecurringPreset
  today: string
  onSubmit: (input: RecurringInput) => Promise<void>
  onCancel: () => void
  onDelete?: () => void
}

function RecurringForm({ initial, preset, today, onSubmit, onCancel, onDelete }: FormProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? preset?.type ?? 'EXPENSE')
  const [memo, setMemo] = useState(initial?.memo ?? preset?.memo ?? '')
  const [askAmount, setAskAmount] = useState(initial?.askAmount === 1)
  const [amountText, setAmountText] = useState(initial ? (initial.askAmount !== 1 ? formatNumber(initial.amount) : '') : preset?.amount ? formatNumber(preset.amount) : '')
  const [category, setCategory] = useState(initial?.category ?? preset?.category ?? '')
  const [account, setAccount] = useState(initial?.account ?? preset?.account ?? '')
  const [day, setDay] = useState(initial?.day ?? preset?.day ?? Number(today.slice(8)))
  const [remindDays, setRemindDays] = useState<number | null>(initial ? (initial.remindDays ?? null) : null)
  const [permNote, setPermNote] = useState<string>()
  const [startDate, setStartDate] = useState(initial?.startDate ?? preset?.startDate ?? today)
  const [errors, setErrors] = useState<Partial<Record<'memo' | 'amount' | 'category', string>>>({})
  const categories = useCategories(type).map((c) => c.name)

  function changeType(next: TransactionType) {
    setType(next)
    if (!categoriesFor(next).includes(category)) setCategory('')
  }

  function changeMemo(text: string) {
    setMemo(text)
    const m = matchMerchant(text)
    if (m && type === 'EXPENSE' && !category) setCategory(resolveCategory('EXPENSE', m.brand.category))
  }

  /** 미리 알림을 켜면 알림 허용을 묻는다 */
  async function pickRemind(days: number | null) {
    setRemindDays(days)
    if (days == null) return setPermNote(undefined)
    const p = await requestAlarmPermission().catch(() => 'unsupported' as const)
    setPermNote(
      p === 'granted'
        ? undefined
        : p === 'unsupported'
          ? '이 브라우저는 알림을 못 띄워서, 앱이 열려 있을 때 화면 안에서만 알려 줘요'
          : '알림이 꺼져 있어요. 휴대폰 설정에서 Tidy 알림을 켜야 울려요',
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    const amount = askAmount ? ({ ok: true, value: 0 } as const) : parseAmount(amountText)
    const next: typeof errors = {}
    if (!memo.trim()) next.memo = '이름을 적어 주세요 (예: 넷플릭스, 월급)'
    if (!amount.ok) next.amount = amount.error
    if (!category) next.category = '카테고리를 골라 주세요'
    setErrors(next)
    if (!amount.ok || Object.keys(next).length > 0) return
    await onSubmit({ type, memo: memo.trim().slice(0, 50), amount: amount.value, askAmount: askAmount ? 1 : 0, category, account: account.trim() || undefined, day, startDate, remindDays })
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="구분">
        {(['EXPENSE', 'INCOME'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => changeType(t)}
            className={`min-h-11 rounded-xl text-sm font-semibold ${
              type === t ? `bg-white shadow-card ${t === 'EXPENSE' ? 'text-expense' : 'text-income'}` : 'text-slate-500'
            }`}
          >
            {t === 'EXPENSE' ? '매달 나가는 돈' : '매달 들어오는 돈'}
          </button>
        ))}
      </div>

      <Field label="이름" error={errors.memo}>
        <input value={memo} onChange={(e) => changeMemo(e.target.value)} placeholder={type === 'EXPENSE' ? '예: 넷플릭스, SKT 통신비' : '예: 월급, 용돈'} className={inputClass(!!errors.memo)} />
      </Field>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <span id="recurring-amount-label" className="text-sm font-medium text-slate-600">
            금액
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={askAmount}
            onClick={() => {
              setAskAmount(!askAmount)
              setErrors((e) => ({ ...e, amount: undefined }))
            }}
            className={`tap flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
              askAmount ? 'bg-grad text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {askAmount ? <Check className="size-3.5" strokeWidth={3} aria-hidden /> : null}
            일정하지 않음
          </button>
        </div>
        {askAmount ? (
          <p className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
            금액을 정해 두지 않아요. 매달 {day === 31 ? '말일' : `${day}일`}이 되면 <b>"{type === 'INCOME' ? '월급을' : '금액을'} 입력해주세요"</b> 창이 떠요. 적은 금액이 그날 가계부에 {type === 'INCOME' ? '수입' : '지출'}으로 기록돼요.
          </p>
        ) : (
          <div className="relative">
            <input
              inputMode="numeric"
              aria-labelledby="recurring-amount-label"
              value={amountText}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10)
                setAmountText(digits ? formatNumber(Number(digits)) : '')
              }}
              placeholder="0"
              className={`${inputClass(!!errors.amount)} pr-10 text-right text-lg font-bold`}
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500">원</span>
          </div>
        )}
        {errors.amount && <span className="mt-1 block text-sm text-expense">{errors.amount}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="매달 며칠">
          <select value={day} onChange={(e) => setDay(Number(e.target.value))} className={inputClass(false)} aria-label="매달 며칠">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 31 ? '말일' : `${d}일`}
              </option>
            ))}
          </select>
        </Field>
        <Field label="카테고리" error={errors.category}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass(!!errors.category)}>
            <option value="" disabled>
              선택
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div>
        <span id="recurring-remind-label" className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
          <Bell className="size-3.5" aria-hidden />
          미리 알림
        </span>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-labelledby="recurring-remind-label">
          {REMIND_CHOICES.map((c) => (
            <button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={remindDays === c.days}
              onClick={() => void pickRemind(c.days)}
              className={`min-h-10 rounded-xl text-[13px] font-semibold ${remindDays === c.days ? 'bg-white text-brand-700 shadow-card' : 'text-slate-500'}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {remindDays != null && !permNote && (
          <p className="mt-1 text-xs text-slate-400">
            {type === 'INCOME' ? '들어오는 날' : '결제일'} {remindDays === 0 ? '당일' : remindDays === 1 ? '하루 전' : `${remindDays}일 전`} 아침 9시에 알려 드려요
          </p>
        )}
        {permNote && <p className="mt-1 text-xs text-expense">{permNote}</p>}
      </div>

      <PayMethodPicker value={account} onChange={setAccount} label={type === 'EXPENSE' ? '나가는 카드 · 계좌 (선택)' : '들어오는 계좌 (선택)'} />
      <Field label="시작일">
        <input type="date" value={startDate} onChange={(e) => e.target.value && setStartDate(e.target.value)} className={inputClass(false)} />
      </Field>
      <p className="-mt-2 text-xs text-slate-400">
        시작일이 지난 날짜면 그 뒤로 밀린 달도 한 번에 기록돼요. 규칙을 지워도 이미 기록된 내역은 남아요.
      </p>

      <div className="flex gap-2 pt-1">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        {onDelete && (
          <Button variant="secondary" className="text-expense" onClick={onDelete} aria-label="이 정기 내역 지우기" title="지우기">
            <Trash2 className="size-4" aria-hidden />
          </Button>
        )}
        <Button type="submit" className="flex-1">
          저장
        </Button>
      </div>
    </form>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-extrabold break-keep text-slate-900">{value}</p>
    </div>
  )
}

import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { Calculator, PiggyBank } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Transaction, TransactionType } from '../../db/types'
import { categoriesFor, resolveCategory, SAVING_CATEGORY } from '../../lib/categories'
import { useCategories } from '../common/MoneyIcon'
import NewCategoryInline from './NewCategoryInline'
import { todayKey } from '../../lib/date'
import { formatNumber } from '../../lib/format'
import { isUnclearMerchant, matchMerchant } from '../../lib/merchants'
import { merchantAliasRepo } from '../../repositories/merchantAliasRepo'
import { savingsRepo } from '../../repositories/savingsRepo'
import { PlanChips } from './SavingsLog'
import { MAX_MEMO_LENGTH, parseAmount, validateMemo } from '../../lib/validate'
import { MAX_ACCOUNT_LENGTH } from '../../lib/accounts'
import PayMethodPicker from '../payMethods/PayMethodPicker'
import type { TransactionInput } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import HandwriteButton, { appendHandwritten } from '../common/HandwriteButton'
import { inputClass } from '../common/formStyles'
import AmountCalculator from './AmountCalculator'
import MerchantAvatar from './MerchantAvatar'

interface TransactionFormProps {
  /** 수정할 때 기존 값 */
  initial?: Transaction
  /** 새 내역에 채워 둘 값 (AI 대화창의 "내가 등록할게") */
  draft?: TransactionInput
  onSubmit: (input: TransactionInput) => Promise<void>
  onDelete?: () => void
  /** 새로 추가할 때 날짜 기본값 (가계부 달력에서 고른 날) */
  defaultDate?: string
}

type Errors = Partial<Record<'amount' | 'date' | 'category' | 'memo' | 'note', string>>

/** 수입/지출 입력 폼 (FR-010~013) */
export default function TransactionForm({ initial, draft, onSubmit, onDelete, defaultDate }: TransactionFormProps) {
  const base = initial ?? draft
  const [type, setType] = useState<TransactionType>(base?.type ?? 'EXPENSE')
  const [amountText, setAmountText] = useState(base ? formatNumber(base.amount) : '')
  const [date, setDate] = useState(base?.date ?? defaultDate ?? todayKey())
  const [category, setCategory] = useState(base?.category ?? '')
  const [memo, setMemo] = useState(base?.memo ?? '')
  const [note, setNote] = useState(base?.note ?? '')
  // 새 내역은 지금 시각으로 채운다
  const [time, setTime] = useState(() => (base ? (base.time ?? '') : format(new Date(), 'HH:mm')))
  const [account, setAccount] = useState(base?.account ?? '')
  // 저축이면 어느 적금 돈인지 (0 = 자유 저축)
  const [savingsId, setSavingsId] = useState(base?.savingsId ?? 0)
  const plans = useLiveQuery(() => savingsRepo.list(), [])
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)
  const [calcOpen, setCalcOpen] = useState(false)

  const categories = useCategories(type).map((c) => c.name)
  const merchant = matchMerchant(memo)
  const unclear = !initial?.originalMemo && isUnclearMerchant(memo)
  // 새 내역일 때만: 저장하면 알려 준 가게 이름으로 바뀐다
  const savedAlias = useLiveQuery(() => (!initial && unclear ? merchantAliasRepo.find(memo) : undefined), [initial, unclear, memo])

  /** 아는 가게를 적으면, 카테고리를 아직 안 골랐을 때 대신 골라 준다 */
  function changeMemo(text: string) {
    setMemo(text)
    const m = matchMerchant(text)
    if (m && type === 'EXPENSE' && !category) setCategory(resolveCategory('EXPENSE', m.brand.category))
  }

  function changeType(next: TransactionType) {
    setType(next)
    // 구분이 바뀌면 그 구분에 없는 카테고리는 비운다
    if (!categoriesFor(next).includes(category)) setCategory('')
  }

  /** 입력 중 천 단위 쉼표 자동 (Edge Cases) */
  function changeAmount(text: string) {
    const digits = text.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10)
    setAmountText(digits ? formatNumber(Number(digits)) : '')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const amount = parseAmount(amountText)
    if (!amount.ok) next.amount = amount.error
    if (!date) next.date = '날짜를 골라 주세요'
    if (!category) next.category = '카테고리를 골라 주세요'
    const memoResult = validateMemo(memo)
    if (!memoResult.ok) next.memo = memoResult.error
    const noteResult = validateMemo(note)
    if (!noteResult.ok) next.note = noteResult.error
    setErrors(next)
    if (!amount.ok || !memoResult.ok || !noteResult.ok || Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const acc = account.trim().slice(0, MAX_ACCOUNT_LENGTH)
      await onSubmit({
        type,
        amount: amount.value,
        date,
        category,
        memo: memoResult.value,
        note: noteResult.value || undefined,
        // 비우면 undefined → 수정할 때 예전 값이 지워진다
        time: time || undefined,
        account: acc || undefined,
        // 저축이 아니거나 자유 저축이면 적금 연결을 지운다
        savingsId: type === 'EXPENSE' && category === SAVING_CATEGORY && savingsId ? savingsId : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 구분 */}
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="구분">
        {(['EXPENSE', 'INCOME'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => changeType(t)}
            className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
              type === t ? (t === 'EXPENSE' ? 'bg-white text-expense shadow-card' : 'bg-white text-income shadow-card') : 'text-slate-500'
            }`}
          >
            {t === 'EXPENSE' ? '지출' : '수입'}
          </button>
        ))}
      </div>

      {/* 금액 */}
      <Field label="금액" error={errors.amount}>
        <div className="relative">
          <input
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={amountText}
            onChange={(e) => changeAmount(e.target.value)}
            className={`${inputClass(!!errors.amount)} pr-10 pl-14 text-right text-lg font-bold`}
            aria-invalid={!!errors.amount}
            autoFocus={!initial}
          />
          {/* 계산기 (사용자 요청 2026-11-20) */}
          <button
            type="button"
            onClick={() => setCalcOpen((o) => !o)}
            aria-label={calcOpen ? '계산기 닫기' : '계산기 열기'}
            aria-expanded={calcOpen}
            className={`absolute top-1/2 left-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl transition-colors ${
              calcOpen ? 'bg-brand-500 text-white' : 'bg-white text-slate-500 shadow-card'
            }`}
          >
            <Calculator size={20} aria-hidden />
          </button>
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500">원</span>
        </div>
      </Field>
      {/* 라벨 밖에 둬야 빈 곳을 눌러도 금액칸에 포커스가 가지 않는다 (폰 키보드가 안 뜸) */}
      {calcOpen && (
        <AmountCalculator
          initial={amountText}
          onApply={(n) => {
            setAmountText(formatNumber(n))
            setErrors((e) => ({ ...e, amount: undefined }))
          }}
          onClose={() => setCalcOpen(false)}
        />
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* 날짜 */}
        <Field label="날짜" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass(!!errors.date)} />
        </Field>
        {/* 시각 */}
        <Field label="시간 (선택)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass(false)} aria-label="쓴 시간" />
        </Field>
      </div>

      {/* 카테고리 */}
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
        <NewCategoryInline type={type} onAdded={setCategory} />
        {type === 'EXPENSE' && category === SAVING_CATEGORY && <p className="mt-1.5 text-xs font-semibold text-saving"><PiggyBank className="inline size-[1.1em] -mt-0.5 align-middle" aria-hidden /> 저축은 지출 합계에 넣지 않고 저금통 안에 따로 모여요</p>}
      </Field>

      {/* 저축이면 어느 적금 돈인지 (사용자 요청 2026-11-24) */}
      {type === 'EXPENSE' && category === SAVING_CATEGORY && plans && plans.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">어느 적금에 넣었나요?</span>
          <PlanChips plans={plans} today={todayKey()} value={savingsId} onChange={setSavingsId} />
        </div>
      )}

      {/* 어떤 카드 · 계좌로 (사용자 요청 2026-11-17) */}
      <PayMethodPicker value={account} onChange={setAccount} label={type === 'INCOME' ? '들어온 계좌 (선택)' : '카드 · 계좌 (선택)'} />

      {/* 가게 이름 · 소비처 (메모는 아래 따로, 사용자 요청 2026-11-25) */}
      <Field label={`가게 · 소비처 (선택, ${memo.length}/${MAX_MEMO_LENGTH})`} error={errors.memo}>
        <div className="flex gap-2">
          <input
            value={memo}
            maxLength={MAX_MEMO_LENGTH}
            placeholder="예: 다이소 운남점, 쿠팡, 엄마"
            onChange={(e) => changeMemo(e.target.value)}
            className={inputClass(!!errors.memo)}
          />
          <HandwriteButton compact label="가게 · 소비처" className="self-center" onText={(t) => changeMemo(appendHandwritten(memo, t, false, MAX_MEMO_LENGTH))} />
        </div>
        {savedAlias ? (
          <span className="mt-2 block text-xs text-slate-500">
            전에 알려 준 대로 <b className="font-semibold text-slate-700">{savedAlias.name}</b>(으)로 저장돼요
          </span>
        ) : unclear ? (
          <span className="mt-2 block text-xs text-amber-700">
            결제 대행사 이름 같아요. 저장한 뒤 내역을 누르면 실제 가게를 알려 줄 수 있어요.
          </span>
        ) : null}
        {merchant && !savedAlias && (
          <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <MerchantAvatar brand={merchant.brand} category={category} size={22} />
            <span>
              목록에는 <b className="font-semibold text-slate-700">{merchant.display}</b> 로 보여요
            </span>
          </span>
        )}
      </Field>

      {/* 메모: 가게 이름과 따로 적는다 */}
      <Field label={`메모 (선택, ${note.length}/${MAX_MEMO_LENGTH})`} error={errors.note}>
        <div className="flex gap-2">
          <input
            value={note}
            maxLength={MAX_MEMO_LENGTH}
            placeholder="예: 점심, 친구랑 반반"
            onChange={(e) => setNote(e.target.value)}
            className={inputClass(!!errors.note)}
          />
          <HandwriteButton compact label="메모" className="self-center" onText={(t) => setNote(appendHandwritten(note, t, false, MAX_MEMO_LENGTH))} />
        </div>
      </Field>

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <Button variant="secondary" className="text-expense" onClick={onDelete}>
            삭제
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}

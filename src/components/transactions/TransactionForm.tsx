import { format } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import type { Transaction, TransactionType } from '../../db/types'
import { categoriesFor, categoryEmoji } from '../../lib/categories'
import { todayKey } from '../../lib/date'
import { formatNumber } from '../../lib/format'
import { matchMerchant } from '../../lib/merchants'
import { MAX_MEMO_LENGTH, parseAmount, validateMemo } from '../../lib/validate'
import { ACCOUNT_PRESETS, accountEmoji, MAX_ACCOUNT_LENGTH } from '../../lib/accounts'
import { transactionRepo, type TransactionInput } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import MerchantAvatar from './MerchantAvatar'

interface TransactionFormProps {
  /** 수정할 때 기존 값 */
  initial?: Transaction
  onSubmit: (input: TransactionInput) => Promise<void>
  onDelete?: () => void
}

type Errors = Partial<Record<'amount' | 'date' | 'category' | 'memo', string>>

/** 수입/지출 입력 폼 (FR-010~013) */
export default function TransactionForm({ initial, onSubmit, onDelete }: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>(initial?.type ?? 'EXPENSE')
  const [amountText, setAmountText] = useState(initial ? formatNumber(initial.amount) : '')
  const [date, setDate] = useState(initial?.date ?? todayKey())
  const [category, setCategory] = useState(initial?.category ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  // 새 내역은 지금 시각으로 채운다
  const [time, setTime] = useState(() => (initial ? (initial.time ?? '') : format(new Date(), 'HH:mm')))
  const [account, setAccount] = useState(initial?.account ?? '')
  const usedAccounts = useLiveQuery(() => transactionRepo.usedAccounts(), []) ?? []
  const accountChips = [...new Set([...usedAccounts, '현금', '토스', '카카오페이'])].slice(0, 6)
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const categories = categoriesFor(type)
  const merchant = matchMerchant(memo)

  /** 아는 가게를 적으면, 카테고리를 아직 안 골랐을 때 대신 골라 준다 */
  function changeMemo(text: string) {
    setMemo(text)
    const m = matchMerchant(text)
    if (m && type === 'EXPENSE' && !category && categories.includes(m.brand.category)) setCategory(m.brand.category)
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
    setErrors(next)
    if (!amount.ok || !memoResult.ok || Object.keys(next).length > 0) return

    setSaving(true)
    try {
      const acc = account.trim().slice(0, MAX_ACCOUNT_LENGTH)
      await onSubmit({
        type,
        amount: amount.value,
        date,
        category,
        memo: memoResult.value,
        // 비우면 undefined → 수정할 때 예전 값이 지워진다
        time: time || undefined,
        account: acc || undefined,
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
            className={`${inputClass(!!errors.amount)} pr-10 text-right text-lg font-bold`}
            aria-invalid={!!errors.amount}
            autoFocus={!initial}
          />
          <span className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-500">원</span>
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        {/* 날짜 */}
        <Field label="날짜" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass(!!errors.date)} />
        </Field>

        {/* 카테고리 */}
        <Field label="카테고리" error={errors.category}>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass(!!errors.category)}>
            <option value="" disabled>
              선택
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryEmoji(c)} {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* 시각 */}
        <Field label="시간 (선택)">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass(false)} aria-label="쓴 시간" />
        </Field>
        {/* 결제 수단 */}
        <Field label="결제 수단 (선택)">
          <input
            value={account}
            list="tidy-accounts"
            maxLength={MAX_ACCOUNT_LENGTH}
            placeholder="예: 신한카드"
            onChange={(e) => setAccount(e.target.value)}
            className={inputClass(false)}
            aria-label="결제 수단"
          />
          <datalist id="tidy-accounts">
            {[...new Set([...usedAccounts, ...ACCOUNT_PRESETS])].map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </Field>
      </div>
      <div className="-mt-2 flex flex-wrap gap-1.5" role="group" aria-label="자주 쓰는 결제 수단">
        {accountChips.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={account === a}
            onClick={() => setAccount(account === a ? '' : a)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              account === a ? 'bg-grad on-grad' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {accountEmoji(a)} {a}
          </button>
        ))}
      </div>

      {/* 메모 */}
      <Field label={`가게 · 메모 (선택, ${memo.length}/${MAX_MEMO_LENGTH})`} error={errors.memo}>
        <input
          value={memo}
          maxLength={MAX_MEMO_LENGTH}
          placeholder="예: 다이소 운남점, 점심"
          onChange={(e) => changeMemo(e.target.value)}
          className={inputClass(!!errors.memo)}
        />
        {merchant && (
          <span className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <MerchantAvatar brand={merchant.brand} category={category} size={22} />
            <span>
              목록에는 <b className="font-semibold text-slate-700">{merchant.display}</b> 로 보여요
            </span>
          </span>
        )}
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

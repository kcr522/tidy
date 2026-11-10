import { useState, type FormEvent } from 'react'
import type { Transaction, TransactionType } from '../../db/types'
import { categoriesFor } from '../../lib/categories'
import { todayKey } from '../../lib/date'
import { formatNumber } from '../../lib/format'
import { MAX_MEMO_LENGTH, parseAmount, validateMemo } from '../../lib/validate'
import type { TransactionInput } from '../../repositories/transactionRepo'
import Button from '../common/Button'

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
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const categories = categoriesFor(type)

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
      await onSubmit({ type, amount: amount.value, date, category, memo: memoResult.value })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* 구분 */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="구분">
        {(['EXPENSE', 'INCOME'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => changeType(t)}
            className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${
              type === t ? (t === 'EXPENSE' ? 'bg-white text-expense shadow-sm' : 'bg-white text-income shadow-sm') : 'text-slate-500'
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
                {c}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* 메모 */}
      <Field label={`메모 (선택, ${memo.length}/${MAX_MEMO_LENGTH})`} error={errors.memo}>
        <input
          value={memo}
          maxLength={MAX_MEMO_LENGTH}
          placeholder="예: 점심"
          onChange={(e) => setMemo(e.target.value)}
          className={inputClass(!!errors.memo)}
        />
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

function inputClass(invalid: boolean) {
  return `w-full min-h-11 rounded-lg border bg-white px-3 text-base outline-none focus:ring-2 focus:ring-brand-500 ${
    invalid ? 'border-expense' : 'border-slate-300'
  }`
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-600">{label}</span>
      {children}
      {error && <span className="mt-1 block text-sm text-expense">{error}</span>}
    </label>
  )
}

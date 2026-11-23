import { useState } from 'react'
import type { PayMethod, PayMethodKind } from '../../db/types'
import { guessKind, MAX_PAY_METHOD_NAME, PAY_KIND_LABEL, PAY_METHOD_KINDS } from '../../lib/payMethods'
import { PayMethodError, payMethodRepo, type PayMethodInput } from '../../repositories/payMethodRepo'
import { inputClass } from '../common/formStyles'
import { PayKindIcon } from '../common/MoneyIcon'

interface Props {
  /** 고칠 카드 · 계좌 (없으면 새로 등록) */
  initial?: PayMethod
  /** 새로 등록할 때 미리 채울 이름 (기록에만 있던 이름) */
  name?: string
  onSaved: (name: string, renamed: number) => void
  onCancel: () => void
}

/** 카드 · 계좌 등록 / 고치기: 이름, 종류, 끝 4자리 */
export default function PayMethodEditor({ initial, name: presetName, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? presetName ?? '')
  const [kind, setKind] = useState<PayMethodKind>(initial?.kind ?? (presetName ? guessKind(presetName) : 'card'))
  const [kindTouched, setKindTouched] = useState(!!initial || !!presetName)
  const [last4, setLast4] = useState(initial?.last4 ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const input: PayMethodInput = { name, kind, last4 }
      const renamed = initial?.id != null ? await payMethodRepo.update(initial.id, input) : (await payMethodRepo.add(input), 0)
      onSaved(name.trim().replace(/\s+/g, ' '), renamed)
    } catch (e) {
      setError(e instanceof PayMethodError ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5" role="group" aria-label={initial ? '카드 · 계좌 고치기' : '카드 · 계좌 등록'}>
      <div className="grid grid-cols-4 gap-1 rounded-xl bg-slate-200/70 p-1" role="radiogroup" aria-label="종류">
        {PAY_METHOD_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => {
              setKind(k)
              setKindTouched(true)
            }}
            className={`min-h-9 rounded-lg text-xs font-bold ${kind === k ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
          >
            <PayKindIcon kind={k} /> {PAY_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">이름</span>
          <input
            value={name}
            maxLength={MAX_PAY_METHOD_NAME}
            placeholder={kind === 'account' ? '예: 국민 월급통장' : kind === 'pay' ? '예: 토스페이' : kind === 'cash' ? '현금' : '예: 신한 체크'}
            onChange={(e) => {
              setName(e.target.value)
              // 종류를 직접 안 골랐으면 이름으로 짐작 (…은행 → 계좌)
              if (!kindTouched && e.target.value.trim()) setKind(guessKind(e.target.value))
            }}
            className={inputClass(false)}
            aria-label="카드 · 계좌 이름"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-500">끝 4자리</span>
          <input
            value={last4}
            inputMode="numeric"
            maxLength={4}
            placeholder="1234"
            disabled={kind === 'cash'}
            onChange={(e) => setLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className={inputClass(false)}
            aria-label="카드 · 계좌 번호 끝 4자리"
          />
        </label>
      </div>
      <p className="text-xs text-slate-500">끝 4자리를 적어 두면 결제 알림이 어떤 카드 · 계좌인지 알아서 골라요. 전체 번호는 적지 않아요.</p>
      {error && (
        <p className="text-xs font-semibold text-rose-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          취소
        </button>
        <button type="button" onClick={save} disabled={saving} className="bg-grad on-grad rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">
          {initial ? '고치기' : '등록'}
        </button>
      </div>
    </div>
  )
}

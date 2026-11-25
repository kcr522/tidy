import { useState } from 'react'
import type { TransactionType } from '../../db/types'
import { MAX_CATEGORY_NAME, type CategoryItem } from '../../lib/categories'
import { CategoryError, moneyCategoryRepo } from '../../repositories/moneyCategoryRepo'
import { inputClass } from '../common/formStyles'
import { CATEGORY_ICONS } from '../common/MoneyIcon'

interface Props {
  type: TransactionType
  /** 고칠 카테고리 (없으면 새로 만들기) */
  initial?: CategoryItem
  onSaved: (name: string, moved: number) => void
  onCancel: () => void
}

/** 카테고리 만들기 / 고치기: 이름과 아이콘 (기타 · 저축은 아이콘만) */
export default function CategoryEditor({ type, initial, onSaved, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [icon, setIcon] = useState(initial?.icon ?? 'package')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const nameLocked = initial?.fixed ?? false

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const input = { name, icon }
      const moved = initial ? await moneyCategoryRepo.update(initial.key, input) : (await moneyCategoryRepo.add(type, input), 0)
      onSaved(nameLocked ? initial!.name : name.trim().replace(/\s+/g, ' '), moved)
    } catch (e) {
      setError(e instanceof CategoryError ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-slate-50 p-3.5" role="group" aria-label={initial ? '카테고리 고치기' : '새 카테고리'}>
      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-slate-500">이름{nameLocked && ' (기타 · 저축은 이름을 바꿀 수 없어요)'}</span>
        <input
          value={name}
          maxLength={MAX_CATEGORY_NAME}
          disabled={nameLocked}
          autoFocus={!initial}
          placeholder={type === 'INCOME' ? '예: 이자, 중고 판매' : '예: 카페, 반려동물, 경조사'}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void save()
            }
          }}
          className={`${inputClass(false)} disabled:opacity-60`}
          aria-label="카테고리 이름"
        />
      </label>
      <div>
        <span className="mb-1 block text-xs font-semibold text-slate-500">아이콘</span>
        <div className="grid grid-cols-8 gap-1" role="radiogroup" aria-label="아이콘">
          {Object.entries(CATEGORY_ICONS).map(([k, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={icon === k}
              aria-label={k}
              onClick={() => setIcon(k)}
              className={`flex aspect-square items-center justify-center rounded-xl ${icon === k ? 'bg-grad on-grad shadow-card' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <Icon className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          ))}
        </div>
      </div>
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
          {initial ? '고치기' : '만들기'}
        </button>
      </div>
    </div>
  )
}

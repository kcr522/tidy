import { Plus } from 'lucide-react'
import { useState } from 'react'
import type { TransactionType } from '../../db/types'
import CategoryEditor from '../categories/CategoryEditor'

/** 내역을 적다가 바로 새 카테고리 만들기 (만들면 그 카테고리를 고른다) */
export default function NewCategoryInline({ type, onAdded }: { type: TransactionType; onAdded: (name: string) => void }) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-1.5 flex items-center gap-1 text-xs font-bold text-brand-600 hover:underline">
        <Plus className="size-3.5" aria-hidden /> 새 카테고리 만들기
      </button>
    )
  return (
    <div className="mt-2">
      <CategoryEditor
        type={type}
        onCancel={() => setOpen(false)}
        onSaved={(name) => {
          setOpen(false)
          onAdded(name)
        }}
      />
    </div>
  )
}

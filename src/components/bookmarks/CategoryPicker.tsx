import { Check, Plus } from 'lucide-react'
import { useState } from 'react'
import type { ScrapCategory } from '../../db/types'
import { CategoryNameError, MAX_CATEGORY_NAME, scrapCategoryRepo } from '../../repositories/scrapCategoryRepo'

interface Props {
  categories: ScrapCategory[]
  value: number | null
  onChange: (id: number | null) => void
  /** false면 고르기 칸 없이 "새 카테고리" 만들기만 */
  showChoices?: boolean
}

/** 스크랩을 넣을 카테고리 고르기 (+ 바로 새로 만들기) */
export default function CategoryPicker({ categories, value, onChange, showChoices = true }: Props) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [error, setError] = useState<string>()

  async function add() {
    try {
      const id = await scrapCategoryRepo.add(name)
      onChange(id)
      setAdding(false)
      setName('')
      setError(undefined)
    } catch (e) {
      setError(e instanceof CategoryNameError ? e.message : '만들지 못했어요')
    }
  }

  const chip = (on: boolean) =>
    `tap inline-flex min-h-9 items-center gap-1 rounded-full px-3.5 text-sm font-bold transition ${on ? 'bg-grad on-grad shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`

  return (
    <div>
      <div role="radiogroup" aria-label="카테고리" className="flex flex-wrap gap-1.5">
        {showChoices && categories.map((c) => (
          <button key={c.id} type="button" role="radio" aria-checked={value === c.id} onClick={() => onChange(c.id!)} className={chip(value === c.id)}>
            {value === c.id && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
            {c.name}
          </button>
        ))}
        {showChoices && (
          <button type="button" role="radio" aria-checked={value === null} onClick={() => onChange(null)} className={chip(value === null)}>
            미분류
          </button>
        )}
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="tap inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 text-sm font-bold text-slate-500">
            <Plus className="size-3.5" strokeWidth={3} aria-hidden />새 카테고리
          </button>
        )}
      </div>
      {adding && (
        <div className="mt-2 flex gap-1.5">
          <input
            autoFocus
            value={name}
            maxLength={MAX_CATEGORY_NAME}
            placeholder="예: 운동, 레시피"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void add()
              }
              if (e.key === 'Escape') setAdding(false)
            }}
            className="min-h-10 min-w-0 flex-1 rounded-xl bg-slate-100 px-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
          />
          <button type="button" onClick={add} className="tap rounded-xl bg-grad on-grad px-3.5 text-sm font-bold">
            추가
          </button>
          <button type="button" onClick={() => setAdding(false)} className="tap rounded-xl bg-slate-100 px-3 text-sm font-bold text-slate-500">
            취소
          </button>
        </div>
      )}
      {error && <p className="mt-1 text-sm text-expense">{error}</p>}
    </div>
  )
}

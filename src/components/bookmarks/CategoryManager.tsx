import { ChevronDown, ChevronUp, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { ScrapCategory } from '../../db/types'
import { CategoryNameError, MAX_CATEGORY_NAME, scrapCategoryRepo } from '../../repositories/scrapCategoryRepo'
import ConfirmDialog from '../common/ConfirmDialog'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import CategoryPicker from './CategoryPicker'

interface Props {
  open: boolean
  categories: ScrapCategory[]
  counts: Map<number | null, number>
  onClose: () => void
}

/** 카테고리 이름 바꾸기, 순서 바꾸기, 지우기 */
export default function CategoryManager({ open, categories, counts, onClose }: Props) {
  const [editing, setEditing] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [deleting, setDeleting] = useState<ScrapCategory | null>(null)
  const [error, setError] = useState<string>()
  const toast = useToast()

  async function rename(id: number) {
    try {
      await scrapCategoryRepo.rename(id, name)
      setEditing(null)
      setError(undefined)
    } catch (e) {
      setError(e instanceof CategoryNameError ? e.message : '바꾸지 못했어요')
    }
  }

  return (
    <>
      <Modal open={open} title="카테고리 관리" onClose={onClose}>
        <ul className="mb-4 divide-y divide-slate-100 rounded-2xl bg-slate-50">
          {categories.map((c, i) => (
            <li key={c.id} className="flex min-h-14 items-center gap-2 px-3">
              {editing === c.id ? (
                <>
                  <input
                    autoFocus
                    value={name}
                    maxLength={MAX_CATEGORY_NAME}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && rename(c.id!)}
                    className="min-h-10 min-w-0 flex-1 rounded-xl bg-white px-3 text-sm outline-none ring-2 ring-brand-500"
                  />
                  <button type="button" onClick={() => rename(c.id!)} className="tap rounded-xl bg-grad on-grad px-3 py-2 text-sm font-bold">
                    저장
                  </button>
                </>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate font-bold text-slate-800">
                    {c.name} <span className="ml-1 text-xs font-medium text-slate-400">{counts.get(c.id!) ?? 0}개</span>
                  </span>
                  <button type="button" aria-label={`${c.name} 위로`} disabled={i === 0} onClick={() => scrapCategoryRepo.move(c.id!, -1)} className="tap rounded-full p-2 text-slate-400 disabled:opacity-30">
                    <ChevronUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={`${c.name} 아래로`} disabled={i === categories.length - 1} onClick={() => scrapCategoryRepo.move(c.id!, 1)} className="tap rounded-full p-2 text-slate-400 disabled:opacity-30">
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    aria-label={`${c.name} 이름 바꾸기`}
                    onClick={() => {
                      setEditing(c.id!)
                      setName(c.name)
                      setError(undefined)
                    }}
                    className="tap rounded-full p-2 text-slate-500"
                  >
                    <Pencil className="size-4" aria-hidden />
                  </button>
                  <button type="button" aria-label={`${c.name} 지우기`} onClick={() => setDeleting(c)} className="tap rounded-full p-2 text-expense">
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
        {error && <p className="-mt-2 mb-3 text-sm text-expense">{error}</p>}
        <CategoryPicker categories={categories} value={null} showChoices={false} onChange={() => toast('카테고리를 만들었어요')} />
      </Modal>
      <ConfirmDialog
        open={deleting !== null}
        title="카테고리 지우기"
        message={`'${deleting?.name}' 카테고리를 지울까요? 안에 있던 스크랩 ${counts.get(deleting?.id ?? -1) ?? 0}개는 지우지 않고 '미분류'로 옮겨요.`}
        confirmLabel="지우기"
        danger
        onConfirm={async () => {
          if (deleting?.id != null) await scrapCategoryRepo.remove(deleting.id)
          setDeleting(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

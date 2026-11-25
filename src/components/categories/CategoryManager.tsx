import { ChevronDown, ChevronUp, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { TransactionType } from '../../db/types'
import { OTHER_CATEGORY, type CategoryItem } from '../../lib/categories'
import { moneyCategoryRepo } from '../../repositories/moneyCategoryRepo'
import ConfirmDialog from '../common/ConfirmDialog'
import { CategoryIcon, useCategories } from '../common/MoneyIcon'
import { useToast } from '../common/Toast'
import CategoryEditor from './CategoryEditor'

type Editing = { kind: 'new' } | { kind: 'edit'; key: string } | null

/** 가계부 메뉴 → 카테고리: 지출 · 수입 카테고리를 만들고, 이름 · 아이콘 · 순서를 바꾸고, 지운다 */
export default function CategoryManager() {
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const list = useCategories(type)
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<{ item: CategoryItem; used: number } | null>(null)
  const toast = useToast()

  const saved = (name: string, moved: number) => {
    setEditing(null)
    toast(moved > 0 ? `${name}(으)로 바꿨어요 · 내역 ${moved}개도 같이 바꿨어요` : `${name} 저장했어요`)
  }

  async function askRemove(item: CategoryItem) {
    setRemoving({ item, used: await moneyCategoryRepo.countUsed(item.type, item.name) })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="구분">
        {(['EXPENSE', 'INCOME'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={type === t}
            onClick={() => {
              setType(t)
              setEditing(null)
            }}
            className={`min-h-9 rounded-lg text-sm font-bold ${type === t ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
          >
            {t === 'EXPENSE' ? '지출' : '수입'}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-500 break-keep">
        내가 쓰는 카테고리를 직접 만들고 지울 수 있어요. 지우면 그 카테고리로 적은 내역은 '{OTHER_CATEGORY}'로 옮겨져요.
      </p>

      <ul className="space-y-2">
        {list.map((c, i) =>
          editing?.kind === 'edit' && editing.key === c.key ? (
            <li key={c.key}>
              <CategoryEditor type={type} initial={c} onCancel={() => setEditing(null)} onSaved={saved} />
            </li>
          ) : (
            <Row
              key={c.key}
              item={c}
              first={i === 0}
              last={i === list.length - 1}
              onEdit={() => setEditing({ kind: 'edit', key: c.key })}
              onMove={(dir) => moneyCategoryRepo.swap(c.key, list[i + dir].key)}
              onRemove={() => askRemove(c)}
            />
          ),
        )}
      </ul>

      {editing?.kind === 'new' ? (
        <CategoryEditor type={type} onCancel={() => setEditing(null)} onSaved={saved} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing({ kind: 'new' })}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="size-4" aria-hidden /> {type === 'EXPENSE' ? '지출' : '수입'} 카테고리 만들기
        </button>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="카테고리 지우기"
        message={
          removing
            ? removing.used > 0
              ? `${removing.item.name}을(를) 지울까요? 이 카테고리로 적은 내역 ${removing.used}개는 '${OTHER_CATEGORY}'로 옮겨져요.`
              : `${removing.item.name}을(를) 지울까요?`
            : ''
        }
        confirmLabel="지우기"
        danger
        onConfirm={async () => {
          if (!removing) return
          const moved = await moneyCategoryRepo.remove(removing.item.key)
          toast(moved > 0 ? `${removing.item.name}을(를) 지우고 내역 ${moved}개를 ${OTHER_CATEGORY}로 옮겼어요` : `${removing.item.name}을(를) 지웠어요`)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

interface RowProps {
  item: CategoryItem
  first: boolean
  last: boolean
  onEdit: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function Row({ item: c, first, last, onEdit, onMove, onRemove }: RowProps) {
  const iconBtn = 'flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30'
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-slate-50 py-2.5 pr-2 pl-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-card" aria-hidden>
        <CategoryIcon category={c.name} className="size-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-slate-800">{c.name}</span>
        {c.fixed && (
          <span className="flex items-center gap-0.5 text-[11px] text-slate-400">
            <Lock className="size-3" aria-hidden /> 늘 있어요
          </span>
        )}
        {!c.builtIn && <span className="block text-[11px] font-semibold text-brand-600">내가 만든 것</span>}
      </span>
      <span className="flex shrink-0 items-center">
        <button type="button" className={iconBtn} disabled={first} onClick={() => onMove(-1)} aria-label={`${c.name} 위로`}>
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} disabled={last} onClick={() => onMove(1)} aria-label={`${c.name} 아래로`}>
          <ChevronDown className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onEdit} aria-label={`${c.name} 고치기`}>
          <Pencil className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} disabled={c.fixed} onClick={onRemove} aria-label={`${c.name} 지우기`}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </span>
    </li>
  )
}

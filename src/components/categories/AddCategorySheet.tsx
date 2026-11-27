import { Settings2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { TransactionType } from '../../db/types'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import CategoryEditor from './CategoryEditor'

interface Props {
  open: boolean
  onClose: () => void
  /** 만든 카테고리 이름 (가계부 카테고리별에서 바로 고른다) */
  onAdded: (name: string) => void
  /** 카테고리 전체 관리 (이름 · 아이콘 · 순서 · 지우기) 열기 */
  onManage: () => void
}

/** 가계부 '카테고리별'의 + 카테고리 추가: 지출 · 수입을 고르고 이름 · 아이콘만 정해 바로 만든다 */
export default function AddCategorySheet({ open, onClose, onAdded, onManage }: Props) {
  const [type, setType] = useState<TransactionType>('EXPENSE')
  const [round, setRound] = useState(0)
  const toast = useToast()

  // 열 때마다 빈 칸으로 시작
  useEffect(() => {
    if (open) setRound((r) => r + 1)
  }, [open])

  return (
    <Modal open={open} title="카테고리 추가" onClose={onClose}>
      {open && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="구분">
            {(['EXPENSE', 'INCOME'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={type === t}
                onClick={() => setType(t)}
                className={`min-h-10 rounded-lg text-sm font-bold ${type === t ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
              >
                {t === 'EXPENSE' ? '지출' : '수입'}
              </button>
            ))}
          </div>
          <CategoryEditor
            key={`${type}-${round}`}
            type={type}
            onCancel={onClose}
            onSaved={(name) => {
              toast(`${name} 카테고리를 만들었어요`)
              onAdded(name)
            }}
          />
          <button type="button" onClick={onManage} className="flex w-full items-center justify-center gap-1.5 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">
            <Settings2 className="size-4" aria-hidden /> 이름 · 순서 바꾸기 · 지우기는 카테고리 관리에서
          </button>
        </div>
      )}
    </Modal>
  )
}

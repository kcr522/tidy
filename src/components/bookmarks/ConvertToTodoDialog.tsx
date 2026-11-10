import { useState, type FormEvent } from 'react'
import type { Bookmark } from '../../db/types'
import { todayKey } from '../../lib/date'
import { AlreadyConvertedError, titleFromBookmark, todoRepo } from '../../repositories/todoRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

interface ConvertToTodoDialogProps {
  /** 전환할 스크랩. null이면 닫힌 상태 */
  bookmark: Bookmark | null
  onClose: () => void
}

/** 스크랩 → 할 일 전환: 마감일을 고르는 창, 기본값 오늘 (FR-040) */
export default function ConvertToTodoDialog({ bookmark, onClose }: ConvertToTodoDialogProps) {
  return (
    <Modal open={bookmark !== null} title="할 일로 전환" onClose={onClose}>
      {bookmark && <ConvertForm key={bookmark.id} bookmark={bookmark} onDone={onClose} />}
    </Modal>
  )
}

function ConvertForm({ bookmark, onDone }: { bookmark: Bookmark; onDone: () => void }) {
  const [dueDate, setDueDate] = useState(() => todayKey())
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (bookmark.id == null) return
    setSaving(true)
    try {
      await todoRepo.createFromBookmark(bookmark.id, dueDate || null)
      toast('할 일로 등록했어요')
      onDone()
    } catch (err) {
      if (err instanceof AlreadyConvertedError) {
        toast('이미 할 일로 등록된 스크랩이에요', 'error')
        onDone()
      } else {
        toast('등록하지 못했어요. 다시 시도해 주세요', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="rounded-2xl bg-slate-50 px-4 py-3">
        <p className="text-xs text-slate-500">이렇게 등록돼요</p>
        <p className="mt-1 font-semibold text-slate-900">{titleFromBookmark(bookmark.title)}</p>
        <p className="mt-0.5 text-xs text-slate-500">중요도 보통 · 완료하면 스크랩도 읽음으로 바뀌어요</p>
      </div>
      <Field label="마감일">
        <div className="flex gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass()} />
          {dueDate && (
            <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={() => setDueDate('')}>
              없음
            </Button>
          )}
        </div>
      </Field>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? '등록 중…' : '할 일 등록'}
        </Button>
      </div>
    </form>
  )
}

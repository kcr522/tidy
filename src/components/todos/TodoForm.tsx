import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import type { Priority, Todo } from '../../db/types'
import { MAX_TITLE_LENGTH, validateTitle } from '../../lib/validate'
import { todoCategoryRepo } from '../../repositories/todoCategoryRepo'
import type { TodoInput } from '../../repositories/todoRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { CATEGORY_HEX } from './categoryColors'
import { PRIORITY_LABEL } from './priority'

interface TodoFormProps {
  initial?: Todo
  /** 새로 추가할 때 마감일 기본값 */
  defaultDueDate?: string | null
  /** 새로 추가할 때 카테고리 기본값 (할 일 캘린더의 카테고리 + 버튼) */
  defaultCategoryId?: number
  onSubmit: (input: TodoInput) => Promise<void>
  onDelete?: () => void
}

/** 할 일 입력 폼 (FR-020) */
export default function TodoForm({ initial, defaultDueDate = null, defaultCategoryId, onSubmit, onDelete }: TodoFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial ? (initial.dueDate ?? '') : (defaultDueDate ?? ''))
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'MEDIUM')
  const [categoryId, setCategoryId] = useState<number | undefined>(initial ? initial.categoryId : defaultCategoryId)
  const categories = useLiveQuery(() => todoCategoryRepo.list(), [])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateTitle(title, '할 일을 입력해 주세요')
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      await onSubmit({ title: result.value, dueDate: dueDate || null, priority, categoryId })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label={`할 일 (${title.length}/${MAX_TITLE_LENGTH})`} error={error}>
        <input
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="예: 주간 업무 보고서 작성"
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass(!!error)}
          aria-invalid={!!error}
          autoFocus={!initial}
        />
      </Field>

      <Field label="마감일 (선택)">
        <div className="flex gap-2">
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputClass()} />
          {dueDate && (
            <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={() => setDueDate('')}>
              지우기
            </Button>
          )}
        </div>
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">중요도</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="중요도">
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                priority === p ? `bg-white shadow-card ${PRIORITY_LABEL[p].text}` : 'text-slate-500'
              }`}
            >
              {PRIORITY_LABEL[p].label}
            </button>
          ))}
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">카테고리</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="카테고리">
            {[{ id: undefined, name: '기본', hex: undefined as string | undefined }, ...categories.map((c) => ({ id: c.id, name: c.name, hex: CATEGORY_HEX[c.color] as string | undefined }))].map((c) => {
              const on = categoryId === c.id
              return (
                <button
                  key={c.id ?? 'base'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.hex ?? 'var(--color-slate-400)' }} aria-hidden />
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>
      )}

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

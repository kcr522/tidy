import { useState, type FormEvent } from 'react'
import type { Priority, Todo } from '../../db/types'
import { MAX_TITLE_LENGTH, validateTitle } from '../../lib/validate'
import type { TodoInput } from '../../repositories/todoRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { PRIORITY_LABEL } from './priority'

interface TodoFormProps {
  initial?: Todo
  /** 새로 추가할 때 마감일 기본값 */
  defaultDueDate?: string | null
  onSubmit: (input: TodoInput) => Promise<void>
  onDelete?: () => void
}

/** 할 일 입력 폼 (FR-020) */
export default function TodoForm({ initial, defaultDueDate = null, onSubmit, onDelete }: TodoFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial ? (initial.dueDate ?? '') : (defaultDueDate ?? ''))
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'MEDIUM')
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
      await onSubmit({ title: result.value, dueDate: dueDate || null, priority })
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
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup" aria-label="중요도">
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
              className={`min-h-10 rounded-lg text-sm font-semibold transition-colors ${
                priority === p ? `bg-white shadow-sm ${PRIORITY_LABEL[p].text}` : 'text-slate-500'
              }`}
            >
              {PRIORITY_LABEL[p].label}
            </button>
          ))}
        </div>
      </div>

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

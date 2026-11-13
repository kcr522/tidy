import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { TodoCategory, TodoCategoryColor } from '../../db/types'
import { MAX_TODO_CATEGORY_NAME, TODO_CATEGORY_COLORS } from '../../repositories/todoCategoryRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import { CATEGORY_COLOR_NAME, CATEGORY_HEX } from './categoryColors'

interface TodoCategoryFormProps {
  initial?: TodoCategory
  defaultColor: TodoCategoryColor
  /** 실패하면 사용자에게 보여 줄 문구를 던진다 */
  onSubmit: (name: string, color: TodoCategoryColor) => Promise<void>
  onDelete?: () => void
}

/** 할 일 카테고리 만들기·고치기 */
export default function TodoCategoryForm({ initial, defaultColor, onSubmit, onDelete }: TodoCategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState<TodoCategoryColor>(initial?.color ?? defaultColor)
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSubmit(name, color)
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label={`이름 (${name.trim().length}/${MAX_TODO_CATEGORY_NAME})`} error={error}>
        <input
          value={name}
          maxLength={MAX_TODO_CATEGORY_NAME + 4}
          placeholder="예: 공부, 운동, 집안일"
          onChange={(e) => setName(e.target.value)}
          className={inputClass(!!error)}
          aria-invalid={!!error}
          autoFocus={!initial}
        />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">색</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="카테고리 색">
          {TODO_CATEGORY_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={CATEGORY_COLOR_NAME[c]}
              title={CATEGORY_COLOR_NAME[c]}
              onClick={() => setColor(c)}
              className={`flex size-11 items-center justify-center rounded-full text-white transition ${color === c ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : ''}`}
              style={{ backgroundColor: CATEGORY_HEX[c] }}
            >
              {color === c && <Check className="size-5" strokeWidth={3} aria-hidden />}
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

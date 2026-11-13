import { useState, type FormEvent } from 'react'
import type { Habit } from '../../db/types'
import { validateTitle } from '../../lib/validate'
import type { HabitInput } from '../../repositories/habitRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'

const HABIT_EMOJIS = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🦷', '💪', '🌱', '☀️']
const MAX_HABIT_LENGTH = 30

interface HabitFormProps {
  initial?: Habit
  onSubmit: (input: HabitInput) => Promise<void>
  onDelete?: () => void
}

/** 습관 만들기 / 고치기 */
export default function HabitForm({ initial, onSubmit, onDelete }: HabitFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? HABIT_EMOJIS[0])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateTitle(title, '습관 이름을 입력해 주세요')
    if (!result.ok) return setError(result.error)
    if (result.value.length > MAX_HABIT_LENGTH) return setError(`${MAX_HABIT_LENGTH}자까지 입력할 수 있어요`)
    setError(undefined)
    setSaving(true)
    try {
      await onSubmit({ title: result.value, emoji })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label={`습관 이름 (${title.length}/${MAX_HABIT_LENGTH})`} error={error}>
        <input
          value={title}
          maxLength={MAX_HABIT_LENGTH}
          placeholder="예: 물 2L 마시기"
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass(!!error)}
          aria-invalid={!!error}
          autoFocus={!initial}
        />
      </Field>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">아이콘</span>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="아이콘">
          {HABIT_EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              role="radio"
              aria-checked={emoji === e}
              onClick={() => setEmoji(e)}
              className={`flex aspect-square items-center justify-center rounded-2xl text-2xl transition ${
                emoji === e ? 'bg-grad shadow-float scale-105' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500 break-keep">매일 체크하면 🔥 연속 기록이 쌓여요. 오늘 아직 안 했어도 어제까지 했으면 기록은 이어져요.</p>

      <div className="flex gap-2 pt-1">
        {onDelete && (
          <Button variant="secondary" className="text-expense" onClick={onDelete}>
            삭제
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={saving}>
          {initial ? '수정' : '만들기'}
        </Button>
      </div>
    </form>
  )
}

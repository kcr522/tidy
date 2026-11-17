import { Check } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { MemoFolder } from '../../db/types'
import { MAX_FOLDER_NAME, MEMO_FOLDER_COLORS } from '../../lib/memo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'

interface Props {
  initial?: MemoFolder
  defaultColor: string
  /** 실패하면 사용자에게 보여 줄 문구를 던진다 */
  onSubmit: (name: string, color: string) => Promise<void>
  onDelete?: () => void
}

/** 메모 파일집 만들기·고치기: 이름 + 색 */
export default function MemoFolderForm({ initial, defaultColor, onSubmit, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState(initial?.color ?? defaultColor)
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
      <Field label={`이름 (${name.trim().length}/${MAX_FOLDER_NAME})`} error={error}>
        <input
          value={name}
          maxLength={MAX_FOLDER_NAME + 4}
          placeholder="예: 레시피, 회의, 아이디어"
          onChange={(e) => setName(e.target.value)}
          className={inputClass(!!error)}
          aria-invalid={!!error}
          autoFocus={!initial}
        />
      </Field>
      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">색</span>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="파일집 색">
          {MEMO_FOLDER_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={color === c.hex}
              aria-label={c.name}
              title={c.name}
              onClick={() => setColor(c.hex)}
              className={`mx-auto flex size-11 items-center justify-center rounded-full text-white transition ${color === c.hex ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : ''}`}
              style={{ backgroundColor: c.hex }}
            >
              {color === c.hex && <Check className="size-5" strokeWidth={3} aria-hidden />}
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

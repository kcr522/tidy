import { useState, type FormEvent } from 'react'
import type { Bookmark } from '../../db/types'
import { MAX_MEMO_LENGTH, MAX_TITLE_LENGTH, domainOf, normalizeUrl, validateMemo } from '../../lib/validate'
import type { BookmarkInput } from '../../repositories/bookmarkRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'

interface BookmarkFormProps {
  initial?: Bookmark
  /** 같은 URL이 이미 있으면 true */
  isDuplicate: (url: string) => Promise<boolean>
  onSubmit: (input: BookmarkInput) => Promise<void>
  onDelete?: () => void
}

type Errors = Partial<Record<'url' | 'title' | 'memo', string>>

/** 스크랩 입력 폼 (FR-030~033) */
export default function BookmarkForm({ initial, isDuplicate, onSubmit, onDelete }: BookmarkFormProps) {
  const [url, setUrl] = useState(initial?.url ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [errors, setErrors] = useState<Errors>({})
  /** 중복 안내를 본 뒤 한 번 더 누르면 저장 */
  const [dupConfirmedFor, setDupConfirmedFor] = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState(false)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const next: Errors = {}
    const u = normalizeUrl(url)
    if (!u.ok) next.url = u.error
    const t = title.trim()
    if (t.length > MAX_TITLE_LENGTH) next.title = `${MAX_TITLE_LENGTH}자까지 입력할 수 있어요`
    const m = validateMemo(memo)
    if (!m.ok) next.memo = m.error
    setErrors(next)
    if (!u.ok || !m.ok || Object.keys(next).length > 0) return

    // 중복 URL 확인 (FR-033)
    if (dupConfirmedFor !== u.value && (await isDuplicate(u.value))) {
      setDupWarning(true)
      setDupConfirmedFor(u.value)
      return
    }

    setSaving(true)
    try {
      // 제목이 비면 도메인 (FR-032)
      await onSubmit({ url: u.value, title: t || domainOf(u.value), memo: m.value })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label="주소 (URL)" error={errors.url}>
        <input
          type="url"
          inputMode="url"
          autoCapitalize="off"
          autoCorrect="off"
          placeholder="예: react.dev/learn"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setDupWarning(false)
          }}
          className={inputClass(!!errors.url)}
          aria-invalid={!!errors.url}
          autoFocus={!initial}
        />
      </Field>

      <Field label={`제목 (선택, 비우면 사이트 주소로 · ${title.length}/${MAX_TITLE_LENGTH})`} error={errors.title}>
        <input value={title} maxLength={MAX_TITLE_LENGTH} placeholder="예: React 성능 최적화 팁" onChange={(e) => setTitle(e.target.value)} className={inputClass(!!errors.title)} />
      </Field>

      <Field label={`메모 (선택, ${memo.length}/${MAX_MEMO_LENGTH})`} error={errors.memo}>
        <textarea
          rows={2}
          value={memo}
          maxLength={MAX_MEMO_LENGTH}
          placeholder="왜 저장했는지 짧게"
          onChange={(e) => setMemo(e.target.value)}
          className={`${inputClass(!!errors.memo)} py-2`}
        />
      </Field>

      {dupWarning && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700" role="alert">
          이미 저장된 주소예요. 그래도 저장하려면 한 번 더 눌러 주세요.
        </p>
      )}

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <Button variant="secondary" className="text-expense" onClick={onDelete}>
            삭제
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? '저장 중…' : dupWarning ? '그래도 저장' : '저장'}
        </Button>
      </div>
    </form>
  )
}

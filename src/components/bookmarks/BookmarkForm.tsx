import { ImageOff, Loader2, Play, RefreshCw } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Bookmark, ScrapCategory } from '../../db/types'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { fetchLinkPreview, type LinkPreview } from '../../lib/scrap/fetchPreview'
import { detectSource } from '../../lib/scrap/link'
import { MAX_MEMO_LENGTH, MAX_TITLE_LENGTH, domainOf, normalizeUrl, validateMemo } from '../../lib/validate'
import type { BookmarkInput } from '../../repositories/bookmarkRepo'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'
import CategoryPicker from './CategoryPicker'
import SourceBadge from './SourceBadge'

export interface BookmarkFormValue {
  input: BookmarkInput
  /** 새로 받아 온 썸네일 (없으면 그대로) */
  thumb?: Blob
  /** 제목을 사용자가 직접 썼는지 (같은 게시물을 합칠 때 직접 쓴 제목만 바꾼다) */
  titleByUser?: boolean
}

interface BookmarkFormProps {
  initial?: Bookmark
  /** 공유받기로 들어온 값 */
  prefill?: { url: string; title?: string }
  categories: ScrapCategory[]
  defaultCategoryId: number | null
  /** 같은 게시물이 이미 있으면 true (새로 저장할 때는 하나로 합친다고 알려 주고, 수정할 때는 한 번 더 묻는다) */
  isDuplicate: (url: string) => Promise<boolean>
  onSubmit: (value: BookmarkFormValue) => Promise<void>
  onDelete?: () => void
}

type Errors = Partial<Record<'url' | 'title' | 'memo', string>>
type PreviewState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; data: LinkPreview } | { status: 'error'; message: string }

/** 스크랩 입력 폼 (FR-030~033) + 카테고리, 링크 미리보기 */
export default function BookmarkForm({ initial, prefill, categories, defaultCategoryId, isDuplicate, onSubmit, onDelete }: BookmarkFormProps) {
  const [url, setUrl] = useState(initial?.url ?? prefill?.url ?? '')
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '')
  /** 사용자가 제목을 직접 고쳤으면 미리보기 제목으로 덮어쓰지 않는다 */
  // 공유받은 글의 제목은 임시: 미리보기 제목이 오면 그걸로 바꾼다
  const titleTouched = useRef(!!initial)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [categoryId, setCategoryId] = useState<number | null>(initial ? (initial.categoryId ?? null) : defaultCategoryId)
  const [errors, setErrors] = useState<Errors>({})
  /** 중복 안내를 본 뒤 한 번 더 누르면 저장 */
  const [dupConfirmedFor, setDupConfirmedFor] = useState<string | null>(null)
  const [dupWarning, setDupWarning] = useState(false)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<PreviewState>({ status: 'idle' })
  const [retry, setRetry] = useState(0)

  const normalized = normalizeUrl(url)
  const target = normalized.ok ? normalized.value : null
  /** 새로 저장하는데 같은 게시물이 이미 있음 → 저장하면 그 스크랩을 최신 내용으로 바꾼다 */
  const [sameFor, setSameFor] = useState<string | null>(null)
  const sameExists = !initial && !!target && sameFor === target
  const isDuplicateRef = useRef(isDuplicate)
  useEffect(() => {
    isDuplicateRef.current = isDuplicate
  })

  useEffect(() => {
    if (initial || !target) return
    let alive = true
    isDuplicateRef.current(target)
      .then((v) => alive && setSameFor(v ? target : null))
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [target, initial])

  // 주소를 쓰고 잠깐 멈추면 미리보기를 가져온다 (수정 화면에서 주소를 안 바꿨으면 다시 안 가져온다)
  useEffect(() => {
    if (!target || (initial && target === initial.url && retry === 0)) {
      setPreview({ status: 'idle' })
      return
    }
    const ctrl = new AbortController()
    const timer = setTimeout(() => {
      setPreview({ status: 'loading' })
      fetchLinkPreview(target, ctrl.signal)
        .then((data) => {
          setPreview({ status: 'done', data })
          if (!titleTouched.current && data.title) setTitle(data.title.slice(0, MAX_TITLE_LENGTH))
        })
        .catch((err: unknown) => {
          if (!ctrl.signal.aborted) setPreview({ status: 'error', message: err instanceof Error ? err.message : '미리보기를 가져오지 못했어요' })
        })
    }, 500)
    return () => {
      clearTimeout(timer)
      ctrl.abort()
    }
  }, [target, initial, retry])

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

    // 중복 URL 확인 (FR-033). 새로 저장할 때는 묻지 않고 기존 스크랩을 최신 내용으로 바꾼다 (bookmarkRepo.addOrMerge)
    if (initial && dupConfirmedFor !== u.value && (await isDuplicate(u.value))) {
      setDupWarning(true)
      setDupConfirmedFor(u.value)
      return
    }

    const p = preview.status === 'done' ? preview.data : undefined
    setSaving(true)
    try {
      await onSubmit({
        input: {
          url: u.value,
          // 제목이 비면 미리보기 제목, 그것도 없으면 도메인 (FR-032)
          title: (t || p?.title?.slice(0, MAX_TITLE_LENGTH) || domainOf(u.value)).trim(),
          memo: m.value,
          categoryId,
          source: detectSource(u.value),
          ...(p ? { description: p.description, siteName: p.siteName, isVideo: !!p.isVideo } : {}),
        },
        thumb: p?.thumb,
        titleByUser: !!t && titleTouched.current,
      })
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
          placeholder="인스타그램, 네이버, X 링크를 붙여 넣어 보세요"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value)
            setDupWarning(false)
          }}
          className={inputClass(!!errors.url)}
          aria-invalid={!!errors.url}
          autoFocus={!initial && !prefill}
        />
      </Field>

      <PreviewBox state={preview} url={target} onRetry={() => setRetry((n) => n + 1)} />

      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-600">카테고리</span>
        <CategoryPicker categories={categories} value={categoryId} onChange={setCategoryId} />
      </div>

      <Field label={`제목 (선택, 비우면 미리보기 제목으로 · ${title.length}/${MAX_TITLE_LENGTH})`} error={errors.title}>
        <input
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="예: 성수 브런치 맛집"
          onChange={(e) => {
            titleTouched.current = true
            setTitle(e.target.value)
          }}
          className={inputClass(!!errors.title)}
        />
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

      {sameExists && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700" role="status">
          이미 저장한 게시물이에요. 저장하면 새로 만들지 않고 그 스크랩을 지금 내용으로 바꿔요. 전에 적어 둔 메모 · 제목은 비워 두면 그대로 남아요.
        </p>
      )}

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

function PreviewBox({ state, url, onRetry }: { state: PreviewState; url: string | null; onRetry: () => void }) {
  const thumbUrl = useBlobUrl(state.status === 'done' ? state.data.thumb : undefined)
  if (state.status === 'idle' || !url) return null
  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3" aria-busy="true">
        <div className="size-16 shrink-0 animate-pulse rounded-xl bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
        </div>
        <Loader2 className="size-4 animate-spin text-slate-400" aria-label="미리보기 가져오는 중" />
      </div>
    )
  }
  if (state.status === 'error') {
    return (
      <div className="flex items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2.5 text-sm text-slate-500">
        <ImageOff className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">{state.message}. 링크는 그대로 저장돼요.</span>
        <button type="button" onClick={onRetry} className="tap flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600">
          <RefreshCw className="size-3" aria-hidden />
          다시
        </button>
      </div>
    )
  }
  const d = state.data
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-grad-soft p-3" aria-label="링크 미리보기">
      <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-white">
        {thumbUrl ? <img src={thumbUrl} alt="" className="size-full object-cover" /> : <ImageOff className="m-auto mt-5 size-6 text-slate-300" aria-hidden />}
        {d.isVideo && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="size-5 fill-white text-white" aria-label="동영상" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <SourceBadge source={d.source} />
          <span className="truncate text-xs text-slate-500">{d.siteName ?? domainOf(url)}</span>
        </div>
        <p className="line-clamp-2 text-sm font-bold text-slate-800">{d.title ?? '제목 없음'}</p>
        {d.description && <p className="line-clamp-1 text-xs text-slate-500">{d.description}</p>}
      </div>
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { Loader2, LayoutGrid, List, Plus, Search, Settings2, Wand2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BookmarkCard from '../components/bookmarks/BookmarkCard'
import BookmarkRow from '../components/bookmarks/BookmarkRow'
import BookmarkForm, { type BookmarkFormValue } from '../components/bookmarks/BookmarkForm'
import AutoShotDialog from '../components/bookmarks/AutoShotDialog'
import CaptureAskDialog from '../components/bookmarks/CaptureAskDialog'
import CategoryManager from '../components/bookmarks/CategoryManager'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import ScrapSortDialog from '../components/bookmarks/ScrapSortDialog'
import ScrapDetail from '../components/bookmarks/ScrapDetail'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import type { Bookmark, ScrapCategory } from '../db/types'
import { matchBookmark, splitQuery } from '../lib/search'
import { detectSource } from '../lib/scrap/link'
import { applyTidy, planTidy, undoTidy, type TidyResult } from '../lib/scrap/autoTidy'
import { enrichMany, enrichScrap, fillThumbs, needsFill, tidyOldScrapTitles } from '../lib/scrap/enrich'
import { askCaptureEnabled, autoCaptureEnabled, lastCategoryFor, rememberCategory } from '../lib/scrap/settings'
import { makeSuggester } from '../lib/scrap/suggest'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo, type BookmarkFilter } from '../repositories/bookmarkRepo'
import { CategoryNameError, MAX_CATEGORY_NAME, scrapCategoryRepo } from '../repositories/scrapCategoryRepo'
import { scrapMediaRepo } from '../repositories/scrapMediaRepo'
import { todoRepo } from '../repositories/todoRepo'

type Editor = { mode: 'add'; prefill?: { url: string; title?: string } } | { mode: 'edit'; item: Bookmark } | null
/** 카테고리 필터: 전체 / 카테고리 id / 미분류 */
type CatFilter = 'all' | 'none' | number

const NO_CATEGORIES: ScrapCategory[] = []
const TITLE_FIX_KEY = 'tidy.scrap.titleFix.v2'
/** 예전 스크랩 한 번에 정리 (끝나면 표시) · 결과(되돌리기용) */
const AUTO_TIDY_KEY = 'tidy.scrap.autoTidy.v1'
const AUTO_TIDY_RESULT = 'tidy.scrap.autoTidy.result'
type TidyBanner = { kind: 'running'; done: number; total: number } | ({ kind: 'done'; filled: number } & TidyResult)
function readTidyResult(): TidyBanner | null {
  try {
    const v = localStorage.getItem(AUTO_TIDY_RESULT)
    return v ? (JSON.parse(v) as TidyBanner) : null
  } catch {
    return null
  }
}
/** 카드 보기 / 목록 보기 (기기마다 기억) */
const VIEW_KEY = 'tidy.scrap.view'
type View = 'card' | 'list'
function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'card'
  } catch {
    return 'card'
  }
}

/** 공유받기(/share)에서 넘어오는 값 */
export interface ShareState {
  share?: { url: string; title?: string }
}

/** 스크랩 화면 (spec US3) + 카테고리, 미리보기, 캡처, AI 정리 */
export default function BookmarksPage() {
  const [filter, setFilter] = useState<BookmarkFilter>('all')
  const [picked, setCat] = useState<CatFilter>('all')
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<Bookmark | null>(null)
  const [converting, setConverting] = useState<Bookmark | null>(null)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [askCapture, setAskCapture] = useState<{ id: number; url: string; isVideo: boolean } | null>(null)
  const [autoShot, setAutoShot] = useState<{ id: number; url: string } | null>(null)
  const [managing, setManaging] = useState(false)
  const [sorting, setSorting] = useState(false)
  /** 카테고리 줄에서 바로 새 카테고리 만들기 */
  const [newCat, setNewCat] = useState<string | null>(null)
  const [newCatError, setNewCatError] = useState<string>()
  const [view, setViewState] = useState<View>(readView)
  /** 스크랩 안에서 찾기: 제목 · 내용 · 메모 · 요약 · 해시태그 · 카테고리 */
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(id)
  }, [query])
  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      // 기억 못 해도 지금 화면은 바뀐다
    }
  }
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const linked = useLiveQuery(() => todoRepo.linkedBookmarks(), [])
  const loadedCategories = useLiveQuery(() => scrapCategoryRepo.list(), [])
  const categories = loadedCategories ?? NO_CATEGORIES
  // 보고 있던 카테고리를 지웠으면 전체로
  const cat: CatFilter = typeof picked === 'number' && !categories.some((c) => c.id === picked) ? 'all' : picked
  const covers = useLiveQuery(() => scrapMediaRepo.covers(), [])

  const all = useLiveQuery(() => bookmarkRepo.list('all'), [])
  const items = useMemo(
    () =>
      (all ?? []).filter(
        (b) => (filter === 'all' || b.isRead === 0) && (cat === 'all' || (cat === 'none' ? b.categoryId == null : b.categoryId === cat)),
      ),
    [all, filter, cat],
  )
  const terms = useMemo(() => splitQuery(debounced), [debounced])
  const searching = terms.length > 0
  // 검색 중이면 지금 고른 카테고리 · 안 읽음 안에서 찾는다
  const found = useMemo(() => {
    if (!searching) return []
    const names = new Map(categories.map((c) => [c.id, c.name]))
    return items.flatMap((b) => {
      const m = matchBookmark(b, terms, b.categoryId != null ? names.get(b.categoryId) : undefined)
      return m ? [{ b, m }] : []
    })
  }, [items, terms, searching, categories])
  const counts = useMemo(() => {
    const byCat = new Map<number | null, number>()
    for (const b of all ?? []) byCat.set(b.categoryId ?? null, (byCat.get(b.categoryId ?? null) ?? 0) + 1)
    const inCat = (all ?? []).filter((b) => cat === 'all' || (cat === 'none' ? b.categoryId == null : b.categoryId === cat))
    return { all: inCat.length, unread: inCat.filter((b) => b.isRead === 0).length, byCat }
  }, [all, cat])
  // 미분류로 남은 스크랩 → AI 없이 정리하기
  const unsortedCount = counts.byCat.get(null) ?? 0
  // 저장할 때 카테고리 추천 (AI 없이: 낱말 + 전에 나눈 스크랩)
  const suggester = useMemo(() => makeSuggester(categories, all ?? []), [categories, all])

  async function addCategory() {
    try {
      const id = await scrapCategoryRepo.add(newCat ?? '')
      setNewCat(null)
      setNewCatError(undefined)
      setCat(id)
      toast('카테고리를 만들었어요')
    } catch (e) {
      setNewCatError(e instanceof CategoryNameError ? e.message : '만들지 못했어요')
    }
  }
  const catName = (id: number | undefined) => categories.find((c) => c.id === id)?.name

  // 예전에 저장한 "Instagram의 OO님 : …" 제목을 한 번 짧게 정리한다
  useEffect(() => {
    if (!all?.length) return
    try {
      if (localStorage.getItem(TITLE_FIX_KEY)) return
      localStorage.setItem(TITLE_FIX_KEY, '1')
    } catch {
      return
    }
    tidyOldScrapTitles(all).catch(() => undefined)
  }, [all])

  // 예전 스크랩 한 번에 정리: 빈 제목 · 내용 채우기 → 미분류를 내 카테고리(없으면 새 카테고리)로. AI 안 씀
  const [tidy, setTidy] = useState<TidyBanner | null>(readTidyResult)
  const tidyStarted = useRef(false)
  useEffect(() => {
    if (!all?.length || !loadedCategories || tidyStarted.current) return
    try {
      if (localStorage.getItem(AUTO_TIDY_KEY)) return
    } catch {
      return
    }
    tidyStarted.current = true
    void (async () => {
      const fill = all.filter(needsFill).map((b) => b.id!)
      if (fill.length) {
        setTidy({ kind: 'running', done: 0, total: fill.length })
        await enrichMany(fill, (done, total) => setTidy({ kind: 'running', done, total }))
      }
      const fresh = await bookmarkRepo.list('all')
      const cats = await scrapCategoryRepo.list()
      const r = await applyTidy(planTidy(fresh, cats))
      const filled = fill.length ? (await Promise.all(fill.map((id) => bookmarkRepo.get(id)))).filter((b) => b && !needsFill(b)).length : 0
      const result: TidyBanner = { kind: 'done', filled, ...r }
      try {
        localStorage.setItem(AUTO_TIDY_KEY, '1')
        if (r.moved || filled) localStorage.setItem(AUTO_TIDY_RESULT, JSON.stringify(result))
      } catch {
        // 다음에 다시 해도 이미 나눈 건 건드리지 않는다
      }
      setTidy(r.moved || filled ? result : null)
    })().catch(() => setTidy(null))
  }, [all, loadedCategories])

  // 카드 사진이 없는 스크랩(가져온 인스타, 다른 기기에서 저장한 것)은 미리보기 사진을 받아 채운다. 하루 한 번, 뒤에서
  const thumbStarted = useRef(false)
  useEffect(() => {
    if (!all?.length || !covers || thumbStarted.current || tidy?.kind === 'running') return
    const KEY = 'tidy.scrap.thumbFill.day'
    const today = new Date().toDateString()
    try {
      if (localStorage.getItem(KEY) === today) return
    } catch {
      return
    }
    const missing = all.filter((b) => b.id != null && !covers.has(b.id))
    thumbStarted.current = true
    if (!missing.length) return
    void fillThumbs(missing).then(() => {
      try {
        localStorage.setItem(KEY, today)
      } catch {
        // 다음에 다시
      }
    })
  }, [all, covers, tidy])

  function closeTidy() {
    setTidy(null)
    try {
      localStorage.removeItem(AUTO_TIDY_RESULT)
    } catch {
      // 괜찮다
    }
  }

  // 다른 앱에서 공유하기로 들어왔으면 바로 저장 창을 연다
  useEffect(() => {
    const share = (location.state as ShareState | null)?.share
    // 카테고리를 다 읽은 뒤에 연다 (지난번에 고른 카테고리를 미리 골라 두려고)
    if (share?.url && loadedCategories) {
      setEditor({ mode: 'add', prefill: share })
      navigate('.', { replace: true, state: null })
    }
  }, [location.state, navigate, loadedCategories])

  const defaultCategory = (url?: string): number | null => {
    if (typeof cat === 'number') return cat
    const remembered = url ? lastCategoryFor(detectSource(url)) : null
    return remembered != null && categories.some((c) => c.id === remembered) ? remembered : null
  }

  async function save({ input, thumb, titleByUser }: BookmarkFormValue) {
    try {
      let id: number
      let merged = false
      const isNew = editor?.mode !== 'edit'
      if (editor?.mode === 'edit' && editor.item.id != null) {
        id = editor.item.id
        await bookmarkRepo.update(id, input)
        toast('수정했어요')
      } else {
        // 같은 게시물이 이미 있으면 새로 만들지 않고 그 스크랩을 최신 내용으로 바꾼다
        const r = await bookmarkRepo.addOrMerge(input, { titleByUser })
        id = r.id
        merged = r.merged
        toast(merged ? '이미 있던 스크랩을 최신 내용으로 바꿨어요' : input.categoryId != null ? `'${catName(input.categoryId) ?? ''}'에 저장했어요` : '저장했어요')
      }
      if (thumb) await scrapMediaRepo.setThumb(id, thumb).catch(() => undefined)
      if (input.source) rememberCategory(input.source, input.categoryId ?? null)
      setEditor(null)
      if (!isNew) return
      // 동영상 캡션·게시글 본문을 서버에서 읽어 같이 남기고, "OO님의 Instagram" 같은 제목은 본문으로 짧게 (기다리지 않고 뒤에서)
      bookmarkRepo
        .get(id)
        .then((b) => b && enrichScrap(b))
        .catch(() => undefined)
      // 새 링크면 서버가 사이트 화면을 자동으로 찍고 → 보여 주면서 "편집" / "그냥 올리기". 끄면 예전처럼 "캡처본도 같이 저장할까요?"
      // 합친 스크랩은 이미 찍어 둔 화면이 있으니 다시 찍지 않는다
      if (merged) return
      if (autoCaptureEnabled()) setAutoShot({ id, url: input.url })
      else if (askCaptureEnabled()) setAskCapture({ id, url: input.url, isVideo: !!input.isVideo })
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function open(b: Bookmark) {
    openUrl(b.url)
    if (b.id != null && b.isRead === 0) await bookmarkRepo.markRead(b.id)
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await bookmarkRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setEditor(null)
  }

  const editingId = editor?.mode === 'edit' ? editor.item.id : undefined
  const detail = all?.find((b) => b.id === detailId) ?? null

  const catChip = (on: boolean) =>
    `tap shrink-0 min-h-9 rounded-full px-3.5 text-sm font-bold whitespace-nowrap transition ${on ? 'bg-grad on-grad shadow-sm' : 'bg-white text-slate-600 shadow-card'}`

  return (
    <>
      <PageHeader title="스크랩" action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 링크 저장</Button>} />

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          placeholder="스크랩 찾기 (제목 · 내용 · 메모 · #태그)"
          aria-label="스크랩 찾기"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-2xl bg-white pr-11 pl-11 text-[15px] shadow-card outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-brand-500 [&::-webkit-search-cancel-button]:hidden"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="tap absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100" aria-label="검색어 지우기">
            <X className="size-5" aria-hidden />
          </button>
        )}
      </div>

      {/* 카테고리: 칩은 옆으로 넘기고, "+ 카테고리" · 관리는 오른쪽에 늘 보이게 */}
      <div className="-mx-4 mb-3 flex items-center gap-1.5 pr-4 md:mx-0 md:pr-0">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 pl-4 md:flex-wrap md:pl-0" role="tablist" aria-label="카테고리">
          <button type="button" role="tab" aria-selected={cat === 'all'} onClick={() => setCat('all')} className={catChip(cat === 'all')}>
            전체 {all?.length ?? 0}
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" role="tab" aria-selected={cat === c.id} onClick={() => setCat(c.id!)} className={catChip(cat === c.id)}>
              {c.name} {counts.byCat.get(c.id!) ?? 0}
            </button>
          ))}
          {(counts.byCat.get(null) ?? 0) > 0 && (
            <button type="button" role="tab" aria-selected={cat === 'none'} onClick={() => setCat('none')} className={catChip(cat === 'none')}>
              미분류 {counts.byCat.get(null)}
            </button>
          )}
        </div>
        <button type="button" onClick={() => setNewCat((v) => (v === null ? '' : null))} className="tap mb-1 flex min-h-9 shrink-0 items-center gap-0.5 rounded-full border border-dashed border-brand-400 bg-white/80 px-2.5 text-sm font-bold text-brand-700" aria-label="새 카테고리 만들기">
          <Plus className="size-4" strokeWidth={2.6} aria-hidden />
          카테고리
        </button>
        <button type="button" onClick={() => setManaging(true)} className="tap mb-1 flex size-9 shrink-0 items-center justify-center rounded-full text-slate-500" aria-label="카테고리 관리" title="카테고리 관리">
          <Settings2 className="size-5" aria-hidden />
        </button>
      </div>
      {newCat !== null && (
        <form
          className="mb-3 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            void addCategory()
          }}
        >
          <input
            autoFocus
            value={newCat}
            maxLength={MAX_CATEGORY_NAME}
            placeholder="새 카테고리 이름 (예: 여행, 운동)"
            aria-label="새 카테고리 이름"
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setNewCat(null)}
            className="min-h-11 min-w-0 flex-1 rounded-2xl bg-white px-4 text-sm shadow-card outline-none focus:ring-2 focus:ring-brand-500"
          />
          <button type="submit" className="tap min-h-11 rounded-2xl bg-grad on-grad px-4 text-sm font-bold">
            만들기
          </button>
          <button type="button" onClick={() => (setNewCat(null), setNewCatError(undefined))} className="tap min-h-11 rounded-2xl bg-white px-3 text-sm font-bold text-slate-500 shadow-card">
            취소
          </button>
        </form>
      )}
      {newCatError && <p className="-mt-2 mb-2 text-sm text-expense">{newCatError}</p>}

      {tidy?.kind === 'running' && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl bg-grad-soft px-4 py-3 shadow-card" role="status">
          <Loader2 className="size-5 shrink-0 animate-spin text-brand-600" aria-hidden />
          <span className="min-w-0 flex-1 text-sm">
            <b className="block text-slate-800">예전 스크랩 정리하는 중</b>
            <span className="text-xs text-slate-500">
              제목 · 내용 읽어 오는 중 {tidy.done} / {tidy.total} · 끝나면 카테고리로 나눠요 (AI 안 씀)
            </span>
          </span>
        </div>
      )}
      {tidy?.kind === 'done' && (
        <div className="mb-3 rounded-2xl bg-grad-soft px-4 py-3 shadow-card" role="status">
          <p className="text-sm font-bold text-slate-800">예전 스크랩을 정리했어요</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
            {tidy.moved > 0 && `${tidy.moved}개를 카테고리로 나눴어요. `}
            {tidy.created.length > 0 && `새 카테고리 ${tidy.created.length}개: ${tidy.created.join(', ')}. `}
            {tidy.filled > 0 && `제목 · 내용 ${tidy.filled}개를 채웠어요. `}
            직접 넣어 둔 카테고리는 그대로예요.
          </p>
          <div className="mt-2 flex gap-2">
            {tidy.moved > 0 && (
              <button
                type="button"
                onClick={() => {
                  void undoTidy(tidy.undo).then(() => toast('나눈 것을 되돌렸어요'))
                  closeTidy()
                }}
                className="tap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm"
              >
                나눈 것 되돌리기
              </button>
            )}
            <button type="button" onClick={closeTidy} className="tap rounded-full bg-grad on-grad px-3 py-1.5 text-xs font-bold shadow-sm">
              확인
            </button>
          </div>
        </div>
      )}

      {!searching && tidy?.kind !== 'running' && unsortedCount > 0 && (cat === 'all' || cat === 'none') && (
        <button type="button" onClick={() => setSorting(true)} className="tap mb-3 flex w-full items-center gap-3 rounded-2xl bg-grad-soft px-4 py-3 text-left shadow-card">
          <Wand2 className="size-5 shrink-0 text-brand-600" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-slate-800">미분류 스크랩 {unsortedCount}개</span>
            <span className="block text-xs text-slate-500">{categories.length ? '내 카테고리로 나눠 볼까요? AI 없이 금방 끝나요' : '카테고리를 만들고 나눠 볼까요?'}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand-700 shadow-sm">정리하기</span>
        </button>
      )}

      <div className="mb-4 flex items-center gap-2">
      <div className="grid flex-1 grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 md:max-w-xs md:flex-none md:basis-80" role="tablist">
        {(
          [
            ['all', `전체 (${counts.all})`],
            ['unread', `안 읽음 (${counts.unread})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`min-h-11 rounded-xl text-sm font-semibold ${filter === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>
        <div className="ml-auto flex shrink-0 gap-1 rounded-2xl bg-slate-200/70 p-1" role="radiogroup" aria-label="보기">
          {(
            [
              ['card', '카드로 보기', LayoutGrid],
              ['list', '목록으로 보기', List],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              aria-label={label}
              title={label}
              onClick={() => setView(key)}
              className={`flex size-11 items-center justify-center rounded-xl ${view === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {all === undefined ? null : searching ? (
        <>
          <p className="mb-2 flex flex-wrap items-center gap-x-2 px-1 text-sm text-slate-500" role="status">
            <span>
              {cat !== 'all' || filter === 'unread' ? `${[cat === 'all' ? '' : cat === 'none' ? '미분류' : catName(cat), filter === 'unread' ? '안 읽음' : ''].filter(Boolean).join(' · ')} 안에서 ` : ''}
              <b className="text-slate-800">{found.length}개</b> 찾았어요
            </span>
            {(cat !== 'all' || filter === 'unread') && (
              <button type="button" onClick={() => (setCat('all'), setFilter('all'))} className="tap font-bold text-brand-700 underline underline-offset-2">
                전체에서 찾기
              </button>
            )}
          </p>
          {found.length === 0 ? (
            <EmptyState icon="🔍" title={`'${debounced.trim()}' 들어간 스크랩이 없어요`} description="다른 낱말로 찾아보세요. 여러 낱말은 모두 들어간 것만 나와요" />
          ) : (
            <ul className="card divide-y divide-slate-100 overflow-hidden py-1">
              {found.map(({ b, m }) => (
                <BookmarkRow
                  key={b.id}
                  bookmark={b}
                  cover={b.id != null ? covers?.get(b.id)?.cover : undefined}
                  categoryName={catName(b.categoryId)}
                  onOpen={() => open(b)}
                  onDetail={() => setDetailId(b.id ?? null)}
                  search={{ terms, field: m.field, snippet: m.snippet }}
                />
              ))}
            </ul>
          )}
        </>
      ) : items.length === 0 ? (
        <EmptyState
          icon="🔖"
          title={filter === 'unread' ? '안 읽은 스크랩이 없어요' : cat !== 'all' ? '이 카테고리에 저장한 링크가 없어요' : '나중에 볼 링크를 저장해 보세요'}
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 링크 저장</Button>}
        />
      ) : view === 'list' ? (
        <ul className="card divide-y divide-slate-100 overflow-hidden py-1">
          {items.map((b) => (
            <BookmarkRow
              key={b.id}
              bookmark={b}
              cover={b.id != null ? covers?.get(b.id)?.cover : undefined}
              categoryName={catName(b.categoryId)}
              onOpen={() => open(b)}
              onDetail={() => setDetailId(b.id ?? null)}
            />
          ))}
        </ul>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => {
            const cv = b.id != null ? covers?.get(b.id) : undefined
            return (
              <BookmarkCard
                key={b.id}
                bookmark={b}
                cover={cv?.cover}
                captures={cv?.captures ?? 0}
                categoryName={catName(b.categoryId)}
                onOpen={() => open(b)}
                onDetail={() => setDetailId(b.id ?? null)}
                onEdit={() => setEditor({ mode: 'edit', item: b })}
                converted={b.id != null && !!linked?.has(b.id)}
                onConvert={() => setConverting(b)}
                onViewTodo={() => navigate('/todos', { state: { tab: 'all' } })}
              />
            )
          })}
        </div>
      )}

      <Modal open={editor !== null} title={editor?.mode === 'edit' ? '스크랩 수정' : '링크 저장'} onClose={() => setEditor(null)}>
        {editor && (
          <BookmarkForm
            key={editingId ?? (editor.mode === 'add' ? editor.prefill?.url : undefined) ?? 'new'}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            prefill={editor.mode === 'add' ? editor.prefill : undefined}
            categories={categories}
            defaultCategoryId={defaultCategory(editor.mode === 'add' ? editor.prefill?.url : undefined)}
            suggest={suggester}
            isDuplicate={async (url) => !!(await bookmarkRepo.findSame(url, editingId))}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <ScrapDetail
        bookmark={detail}
        categoryName={catName(detail?.categoryId)}
        onClose={() => setDetailId(null)}
        onOpen={open}
        onEdit={(b) => {
          setDetailId(null)
          setEditor({ mode: 'edit', item: b })
        }}
      />

      <AutoShotDialog bookmarkId={autoShot?.id ?? null} url={autoShot?.url} onClose={() => setAutoShot(null)} />

      <CaptureAskDialog bookmarkId={askCapture?.id ?? null} url={askCapture?.url} isVideo={askCapture?.isVideo} onClose={() => setAskCapture(null)} />

      <ScrapSortDialog open={sorting} all={all ?? []} categories={categories} onClose={() => setSorting(false)} />

      <CategoryManager open={managing} categories={categories} counts={counts.byCat} onClose={() => setManaging(false)} onSort={() => (setManaging(false), setSorting(true))} />

      <ConvertToTodoDialog bookmark={converting} onClose={() => setConverting(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title="스크랩 삭제"
        message="이 스크랩을 삭제할까요? 같이 저장한 캡처도 지워지고, 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

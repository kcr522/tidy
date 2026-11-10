import { useLiveQuery } from 'dexie-react-hooks'
import { Settings2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BookmarkCard from '../components/bookmarks/BookmarkCard'
import BookmarkForm, { type BookmarkFormValue } from '../components/bookmarks/BookmarkForm'
import CaptureAskDialog from '../components/bookmarks/CaptureAskDialog'
import CategoryManager from '../components/bookmarks/CategoryManager'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import ScrapDetail from '../components/bookmarks/ScrapDetail'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import type { Bookmark, ScrapCategory } from '../db/types'
import { detectSource } from '../lib/scrap/link'
import { askCaptureEnabled, lastCategoryFor, rememberCategory } from '../lib/scrap/settings'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo, type BookmarkFilter } from '../repositories/bookmarkRepo'
import { scrapCategoryRepo } from '../repositories/scrapCategoryRepo'
import { scrapMediaRepo } from '../repositories/scrapMediaRepo'
import { todoRepo } from '../repositories/todoRepo'

type Editor = { mode: 'add'; prefill?: { url: string; title?: string } } | { mode: 'edit'; item: Bookmark } | null
/** 카테고리 필터: 전체 / 카테고리 id / 미분류 */
type CatFilter = 'all' | 'none' | number

const NO_CATEGORIES: ScrapCategory[] = []

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
  const [askCapture, setAskCapture] = useState<{ id: number; isVideo: boolean } | null>(null)
  const [managing, setManaging] = useState(false)
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
  const counts = useMemo(() => {
    const byCat = new Map<number | null, number>()
    for (const b of all ?? []) byCat.set(b.categoryId ?? null, (byCat.get(b.categoryId ?? null) ?? 0) + 1)
    const inCat = (all ?? []).filter((b) => cat === 'all' || (cat === 'none' ? b.categoryId == null : b.categoryId === cat))
    return { all: inCat.length, unread: inCat.filter((b) => b.isRead === 0).length, byCat }
  }, [all, cat])
  const catName = (id: number | undefined) => categories.find((c) => c.id === id)?.name

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

  async function save({ input, thumb }: BookmarkFormValue) {
    try {
      let id: number
      const isNew = editor?.mode !== 'edit'
      if (editor?.mode === 'edit' && editor.item.id != null) {
        id = editor.item.id
        await bookmarkRepo.update(id, input)
        toast('수정했어요')
      } else {
        id = await bookmarkRepo.add(input)
        toast(input.categoryId != null ? `'${catName(input.categoryId) ?? ''}'에 저장했어요` : '저장했어요')
      }
      if (thumb) await scrapMediaRepo.setThumb(id, thumb).catch(() => undefined)
      if (input.source) rememberCategory(input.source, input.categoryId ?? null)
      setEditor(null)
      // 새 링크면 "캡처본도 같이 저장할까요?" (설정에서 끌 수 있다)
      if (isNew && askCaptureEnabled()) setAskCapture({ id, isVideo: !!input.isVideo })
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

      {/* 카테고리 */}
      <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="tablist" aria-label="카테고리">
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
        <button type="button" onClick={() => setManaging(true)} className="tap flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-bold text-slate-500" aria-label="카테고리 관리">
          <Settings2 className="size-4" aria-hidden />
          관리
        </button>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 md:max-w-xs" role="tablist">
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

      {all === undefined ? null : items.length === 0 ? (
        <EmptyState
          icon="🔖"
          title={filter === 'unread' ? '안 읽은 스크랩이 없어요' : cat !== 'all' ? '이 카테고리에 저장한 링크가 없어요' : '나중에 볼 링크를 저장해 보세요'}
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 링크 저장</Button>}
        />
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
                onToggleRead={() => b.id != null && bookmarkRepo.toggleRead(b.id)}
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
            isDuplicate={async (url) => !!(await bookmarkRepo.findByUrl(url, editingId))}
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

      <CaptureAskDialog bookmarkId={askCapture?.id ?? null} isVideo={askCapture?.isVideo} onClose={() => setAskCapture(null)} />

      <CategoryManager open={managing} categories={categories} counts={counts.byCat} onClose={() => setManaging(false)} />

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

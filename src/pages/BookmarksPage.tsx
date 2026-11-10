import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookmarkCard from '../components/bookmarks/BookmarkCard'
import BookmarkForm from '../components/bookmarks/BookmarkForm'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import type { Bookmark } from '../db/types'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo, type BookmarkFilter, type BookmarkInput } from '../repositories/bookmarkRepo'
import { todoRepo } from '../repositories/todoRepo'

type Editor = { mode: 'add' } | { mode: 'edit'; item: Bookmark } | null

/** 스크랩 화면 (spec US3) */
export default function BookmarksPage() {
  const [filter, setFilter] = useState<BookmarkFilter>('all')
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<Bookmark | null>(null)
  const [converting, setConverting] = useState<Bookmark | null>(null)
  const toast = useToast()
  const navigate = useNavigate()
  const linked = useLiveQuery(() => todoRepo.linkedBookmarks(), [])

  const items = useLiveQuery(() => bookmarkRepo.list(filter), [filter])
  const counts = useLiveQuery(async () => {
    const all = await bookmarkRepo.list('all')
    return { all: all.length, unread: all.filter((b) => b.isRead === 0).length }
  }, [])

  async function save(input: BookmarkInput) {
    try {
      if (editor?.mode === 'edit' && editor.item.id != null) {
        await bookmarkRepo.update(editor.item.id, input)
        toast('수정했어요')
      } else {
        await bookmarkRepo.add(input)
        toast('저장했어요')
      }
      setEditor(null)
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

  return (
    <>
      <PageHeader title="스크랩" action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 링크 저장</Button>} />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-200/70 p-1 md:max-w-xs" role="tablist">
        {(
          [
            ['all', `전체 (${counts?.all ?? 0})`],
            ['unread', `안 읽음 (${counts?.unread ?? 0})`],
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

      {items === undefined ? null : items.length === 0 ? (
        <EmptyState
          icon="🔖"
          title={filter === 'unread' ? '안 읽은 스크랩이 없어요' : '나중에 볼 링크를 저장해 보세요'}
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 링크 저장</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {items.map((b) => (
            <BookmarkCard
              key={b.id}
              bookmark={b}
              onOpen={() => open(b)}
              onToggleRead={() => b.id != null && bookmarkRepo.toggleRead(b.id)}
              onEdit={() => setEditor({ mode: 'edit', item: b })}
              converted={b.id != null && !!linked?.has(b.id)}
              onConvert={() => setConverting(b)}
              onViewTodo={() => navigate('/todos', { state: { tab: 'all' } })}
            />
          ))}
        </div>
      )}

      <Modal open={editor !== null} title={editor?.mode === 'edit' ? '스크랩 수정' : '링크 저장'} onClose={() => setEditor(null)}>
        {editor && (
          <BookmarkForm
            key={editingId ?? 'new'}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            isDuplicate={async (url) => !!(await bookmarkRepo.findByUrl(url, editingId))}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <ConvertToTodoDialog bookmark={converting} onClose={() => setConverting(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title="스크랩 삭제"
        message="이 스크랩을 삭제할까요? 삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

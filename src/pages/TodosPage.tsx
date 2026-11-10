import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import TodoForm from '../components/todos/TodoForm'
import TodoItem from '../components/todos/TodoItem'
import type { Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { sortTodos, todayProgress, todayTodos } from '../lib/summary'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo } from '../repositories/bookmarkRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'

type Tab = 'today' | 'all'
type Editor = { mode: 'add' } | { mode: 'edit'; item: Todo } | null

/** 할 일 화면 (spec US2) */
export default function TodosPage() {
  const today = useToday()
  const location = useLocation()
  // 스크랩의 "할 일 보기"로 들어오면 전체 탭을 연다
  const [tab, setTab] = useState<Tab>(() => ((location.state as { tab?: Tab } | null)?.tab === 'all' ? 'all' : 'today'))
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<Todo | null>(null)
  const toast = useToast()

  const all = useLiveQuery(() => todoRepo.listAll(), [])
  const bookmarkUrls = useLiveQuery(async () => new Map((await bookmarkRepo.list('all')).map((b) => [b.id, b.url])), [])
  const visible = useMemo(() => (all ? (tab === 'today' ? todayTodos(all, today) : sortTodos(all)) : undefined), [all, tab, today])
  const progress = useMemo(() => todayProgress(all ?? [], today), [all, today])

  async function save(input: TodoInput) {
    try {
      if (editor?.mode === 'edit' && editor.item.id != null) {
        await todoRepo.update(editor.item.id, input)
        toast('수정했어요')
      } else {
        await todoRepo.add(input)
        toast('저장했어요')
      }
      setEditor(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function toggle(todo: Todo) {
    if (todo.id == null) return
    try {
      await todoRepo.toggleComplete(todo.id)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function openLink(todo: Todo) {
    const url = todo.bookmarkId != null ? bookmarkUrls?.get(todo.bookmarkId) : undefined
    if (!url || todo.bookmarkId == null) return
    openUrl(url)
    await bookmarkRepo.markRead(todo.bookmarkId)
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await todoRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setEditor(null)
  }

  const firstDone = visible?.findIndex((t) => t.isCompleted === 1) ?? -1

  return (
    <>
      <PageHeader title="할 일" action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 할 일 추가</Button>} />

      <div className="mb-4 flex items-center gap-3">
        <div className="grid flex-1 grid-cols-2 gap-1 rounded-xl bg-slate-200/60 p-1 md:max-w-xs" role="tablist">
          {(
            [
              ['today', `오늘 (${progress.done}/${progress.total})`],
              ['all', `전체 (${all?.length ?? 0})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-lg text-sm font-semibold ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {visible === undefined ? null : visible.length === 0 ? (
        <EmptyState
          icon="✅"
          title={tab === 'today' ? '오늘 할 일이 없어요' : '할 일을 추가해 보세요'}
          description={tab === 'today' ? '마감일을 오늘로 정한 할 일이 여기에 보여요.' : undefined}
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 할 일 추가</Button>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
          {visible.map((t, i) => (
            <TodoRow key={t.id} showDoneHeader={i === firstDone && i > 0}>
              <TodoItem todo={t} today={today} onToggle={() => toggle(t)} onSelect={() => setEditor({ mode: 'edit', item: t })}
                onOpenLink={t.bookmarkId != null && bookmarkUrls?.has(t.bookmarkId) ? () => openLink(t) : undefined}
              />
            </TodoRow>
          ))}
        </ul>
      )}

      <Modal open={editor !== null} title={editor?.mode === 'edit' ? '할 일 수정' : '할 일 추가'} onClose={() => setEditor(null)}>
        {editor && (
          <TodoForm
            key={editor.mode === 'edit' ? editor.item.id : 'new'}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            defaultDueDate={tab === 'today' ? today : null}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="할 일 삭제"
        message="이 할 일을 삭제할까요? 삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

/** 완료 영역이 시작되는 곳에 구분 제목을 넣는다 */
function TodoRow({ showDoneHeader, children }: { showDoneHeader: boolean; children: React.ReactNode }) {
  if (!showDoneHeader) return <>{children}</>
  return (
    <>
      <li className="bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-500">완료</li>
      {children}
    </>
  )
}

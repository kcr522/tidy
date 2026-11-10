import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookmarkForm from '../components/bookmarks/BookmarkForm'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import MoneyCard from '../components/dashboard/MoneyCard'
import TodayTodoCard from '../components/dashboard/TodayTodoCard'
import UnreadScrapCard from '../components/dashboard/UnreadScrapCard'
import TodoForm from '../components/todos/TodoForm'
import TransactionForm from '../components/transactions/TransactionForm'
import type { Bookmark, Todo } from '../db/types'
import { todayKey } from '../lib/date'
import { formatDateLabel } from '../lib/format'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo, type BookmarkInput } from '../repositories/bookmarkRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

type Sheet = { kind: 'money' } | { kind: 'todo'; item?: Todo } | { kind: 'scrap' } | null

const SHEET_TITLE = { money: '수입/지출 추가', todo: '할 일 추가', scrap: '링크 저장' } as const

/** 대시보드: 앱의 첫 화면 (spec US4, FR-050~055) */
export default function DashboardPage() {
  // 화면을 연 시점의 오늘
  const [today] = useState(() => todayKey())
  const [year, month] = today.split('-').map(Number)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [converting, setConverting] = useState<Bookmark | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const transactions = useLiveQuery(() => transactionRepo.listByMonth(year, month), [year, month])
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const unread = useLiveQuery(() => bookmarkRepo.list('unread'), [])
  const linked = useLiveQuery(() => todoRepo.linkedBookmarks(), [])

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      await action()
      toast(done)
      setSheet(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  const saveMoney = (input: TransactionInput) => run(() => transactionRepo.add(input), '저장했어요')
  const saveScrap = (input: BookmarkInput) => run(() => bookmarkRepo.add(input), '저장했어요')
  const saveTodo = (input: TodoInput) =>
    sheet?.kind === 'todo' && sheet.item?.id != null
      ? run(() => todoRepo.update(sheet.item!.id!, input), '수정했어요')
      : run(() => todoRepo.add(input), '저장했어요')

  async function toggle(todo: Todo) {
    if (todo.id == null) return
    try {
      await todoRepo.toggleComplete(todo.id)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function open(b: Bookmark) {
    openUrl(b.url)
    if (b.id != null) await bookmarkRepo.markRead(b.id)
  }

  const viewTodos = () => navigate('/todos', { state: { tab: 'all' } })
  const loading = transactions === undefined || todos === undefined || unread === undefined

  return (
    <>
      <PageHeader title="대시보드" action={<span className="text-sm text-slate-500">{formatDateLabel(today)}</span>} />

      {!loading && (
        // 폰: 세로 3단, 컴퓨터: 가로 3칸 (FR-050)
        <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MoneyCard month={month} items={transactions} today={today} onAdd={() => setSheet({ kind: 'money' })} />
          <TodayTodoCard
            todos={todos}
            today={today}
            onAdd={() => setSheet({ kind: 'todo' })}
            onToggle={toggle}
            onSelect={(item) => setSheet({ kind: 'todo', item })}
          />
          <UnreadScrapCard
            unread={unread}
            linked={linked ?? new Map()}
            onAdd={() => setSheet({ kind: 'scrap' })}
            onOpen={open}
            onConvert={setConverting}
            onViewTodo={viewTodos}
          />
        </div>
      )}

      <Modal
        open={sheet !== null}
        title={sheet?.kind === 'todo' && sheet.item ? '할 일 수정' : sheet ? SHEET_TITLE[sheet.kind] : ''}
        onClose={() => setSheet(null)}
      >
        {sheet?.kind === 'money' && <TransactionForm onSubmit={saveMoney} />}
        {sheet?.kind === 'todo' && <TodoForm key={sheet.item?.id ?? 'new'} initial={sheet.item} defaultDueDate={today} onSubmit={saveTodo} />}
        {sheet?.kind === 'scrap' && <BookmarkForm isDuplicate={async (url) => !!(await bookmarkRepo.findByUrl(url))} onSubmit={saveScrap} />}
      </Modal>

      <ConvertToTodoDialog bookmark={converting} onClose={() => setConverting(null)} />
    </>
  )
}

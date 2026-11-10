import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BookmarkForm, { type BookmarkFormValue } from '../components/bookmarks/BookmarkForm'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import AiFeedbackCard from '../components/dashboard/AiFeedbackCard'
import MoneyCard from '../components/dashboard/MoneyCard'
import PaydayCard from '../components/dashboard/PaydayCard'
import TodayTodoCard from '../components/dashboard/TodayTodoCard'
import UnreadScrapCard from '../components/dashboard/UnreadScrapCard'
import TodoForm from '../components/todos/TodoForm'
import RecurringManager from '../components/transactions/RecurringManager'
import TransactionForm from '../components/transactions/TransactionForm'
import type { Bookmark, Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { formatDateLabel } from '../lib/format'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo } from '../repositories/bookmarkRepo'
import { scrapCategoryRepo } from '../repositories/scrapCategoryRepo'
import { scrapMediaRepo } from '../repositories/scrapMediaRepo'
import { recurringRepo } from '../repositories/recurringRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

type Sheet = { kind: 'money' } | { kind: 'todo'; item?: Todo } | { kind: 'scrap' } | { kind: 'payday'; fresh: boolean } | null

const SHEET_TITLE = { money: '수입/지출 추가', todo: '할 일 추가', scrap: '링크 저장', payday: '정기 내역' } as const

/** 대시보드: 앱의 첫 화면 (spec US4, FR-050~055) */
export default function DashboardPage() {
  // 자정이 지나거나 앱이 다시 보이면 새로 계산된다
  const today = useToday()
  const [year, month] = today.split('-').map(Number)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [converting, setConverting] = useState<Bookmark | null>(null)
  const toast = useToast()
  const navigate = useNavigate()

  const transactions = useLiveQuery(() => transactionRepo.listByMonth(year, month), [year, month])
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const unread = useLiveQuery(() => bookmarkRepo.list('unread'), [])
  const linked = useLiveQuery(() => todoRepo.linkedBookmarks(), [])
  const incomes = useLiveQuery(async () => (await recurringRepo.list()).filter((r) => r.type === 'INCOME' && r.isActive === 1), [])

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
  const scrapCategories = useLiveQuery(() => scrapCategoryRepo.list(), []) ?? []
  const saveScrap = ({ input, thumb }: BookmarkFormValue) =>
    run(async () => {
      const id = await bookmarkRepo.add(input)
      if (thumb) await scrapMediaRepo.setThumb(id, thumb).catch(() => undefined)
    }, '저장했어요')
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
          <AiFeedbackCard items={transactions} today={today} />
          <PaydayCard incomes={incomes ?? []} today={today} onAdd={() => setSheet({ kind: 'payday', fresh: (incomes ?? []).length === 0 })} />
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
        {sheet?.kind === 'payday' && (
          <RecurringManager today={today} preset={sheet.fresh ? { type: 'INCOME', category: '월급', memo: '월급' } : undefined} />
        )}
        {sheet?.kind === 'scrap' && <BookmarkForm categories={scrapCategories} defaultCategoryId={null} isDuplicate={async (url) => !!(await bookmarkRepo.findByUrl(url))} onSubmit={saveScrap} />}
      </Modal>

      <ConvertToTodoDialog bookmark={converting} onClose={() => setConverting(null)} />
    </>
  )
}

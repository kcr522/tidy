import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import BookmarkForm, { type BookmarkFormValue } from '../components/bookmarks/BookmarkForm'
import ConvertToTodoDialog from '../components/bookmarks/ConvertToTodoDialog'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import AssistantButton from '../components/assistant/AssistantButton'
import AiFeedbackCard from '../components/dashboard/AiFeedbackCard'
import MoneyCard from '../components/dashboard/MoneyCard'
import BackupReminder from '../components/dashboard/BackupReminder'
import ReportTeaser from '../components/dashboard/ReportTeaser'
import PaydayCard from '../components/dashboard/PaydayCard'
import UnreadScrapCard from '../components/dashboard/UnreadScrapCard'
import RouteWidget from '../components/dashboard/RouteWidget'
import { DateWidget, DdayWidget, HabitWeekWidget, ProgressWidget, TimelineWidget, TodoListWidget, TrackerWidget } from '../components/dashboard/MiniWidgets'
import WidgetGrid from '../components/dashboard/WidgetGrid'
import HabitForm from '../components/habits/HabitForm'
import TodoForm from '../components/todos/TodoForm'
import RecurringManager from '../components/transactions/RecurringManager'
import TransactionForm from '../components/transactions/TransactionForm'
import type { Bookmark, Habit, Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { formatDateLabel } from '../lib/format'
import type { DashWidgetKind } from '../lib/dashLayout'
import { parseDateKey, toDateKey } from '../lib/date'
import { pickResurface, snoozeScrap, useResurfaceSettings, useSnoozes } from '../lib/scrap/resurface'
import { openUrl } from '../platform/openUrl'
import { diaryRepo } from '../repositories/diaryRepo'
import { eventRepo } from '../repositories/eventRepo'
import { bookmarkRepo } from '../repositories/bookmarkRepo'
import { scrapCategoryRepo } from '../repositories/scrapCategoryRepo'
import { scrapMediaRepo } from '../repositories/scrapMediaRepo'
import { groupChecks, habitRepo, type HabitInput } from '../repositories/habitRepo'
import { recurringRepo } from '../repositories/recurringRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

type Sheet = { kind: 'money' } | { kind: 'todo'; item?: Todo } | { kind: 'scrap' } | { kind: 'payday'; fresh: boolean } | { kind: 'habit' } | null

const SHEET_TITLE = { money: '수입/지출 추가', todo: '할 일 추가', scrap: '링크 저장', payday: '정기 내역', habit: '습관 추가' } as const

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
  // 저장만 하고 안 본 스크랩 하나를 날마다 바꿔 가며 다시 꺼낸다
  const [resurfaceSettings] = useResurfaceSettings()
  const snoozes = useSnoozes()
  const resurface = useMemo(() => (resurfaceSettings.card ? (pickResurface(unread ?? [], today, snoozes)[0] ?? null) : null), [resurfaceSettings.card, unread, today, snoozes])
  const habits = useLiveQuery(() => habitRepo.list(), [])
  const checkRows = useLiveQuery(() => habitRepo.allChecks(), [])
  const checks = useMemo(() => groupChecks(checkRows ?? []), [checkRows])
  const [editing, setEditing] = useState(false)
  // 이번 달 + 앞으로 한 달 일정 (달력 점, 다가오는 일정, 오늘 종일 일정)
  const monthStart = `${today.slice(0, 7)}-01`
  const ahead = useMemo(() => {
    const d = parseDateKey(today)
    d.setDate(d.getDate() + 45)
    return toDateKey(d)
  }, [today])
  const eventRows = useLiveQuery(() => eventRepo.listBetween(monthStart, ahead), [monthStart, ahead])
  const events = useMemo(() => eventRows ?? [], [eventRows])
  const upcoming = useMemo(() => events.filter((e) => e.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0], [events, today])
  const diary = useLiveQuery(() => diaryRepo.get(today), [today])
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
  const saveScrap = ({ input, thumb, titleByUser }: BookmarkFormValue) =>
    run(async () => {
      // 같은 게시물이 이미 있으면 그 스크랩을 최신 내용으로 바꾼다
      const { id } = await bookmarkRepo.addOrMerge(input, { titleByUser })
      if (thumb) await scrapMediaRepo.setThumb(id, thumb).catch(() => undefined)
    }, '저장했어요')
  const saveTodo = (input: TodoInput) =>
    sheet?.kind === 'todo' && sheet.item?.id != null
      ? run(() => todoRepo.update(sheet.item!.id!, input), '수정했어요')
      : run(() => todoRepo.add(input), '저장했어요')

  async function toggle(todo: Todo) {
    if (todo.id == null) return
    try {
      const next = await todoRepo.toggleComplete(todo.id)
      if (next) toast(`다음 할 일을 ${formatDateLabel(next)}에 만들었어요`)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  const saveHabit = (input: HabitInput) => run(() => habitRepo.add(input), '습관을 만들었어요')

  async function toggleHabit(habit: Habit) {
    if (habit.id == null) return
    try {
      await habitRepo.toggle(habit.id, today)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function open(b: Bookmark) {
    openUrl(b.url)
    if (b.id != null) await bookmarkRepo.markRead(b.id)
  }

  function later(b: Bookmark) {
    if (b.id == null) return
    snoozeScrap(b.id, today)
    toast('일주일 뒤에 다시 보여 드릴게요')
  }

  async function done(b: Bookmark) {
    if (b.id == null) return
    await bookmarkRepo.markRead(b.id)
    toast('본 것으로 표시했어요')
  }

  const viewTodos = () => navigate('/todos', { state: { tab: 'all' } })
  const loading = transactions === undefined || todos === undefined || unread === undefined

  // 위젯 종류마다 그릴 것. 가계부·AI·월급·스크랩은 예전 카드를 그대로 위젯 칸에 넣는다
  const card = (node: ReactNode) => <div className="h-full overflow-y-auto rounded-3xl [scrollbar-width:none] [&>section]:min-h-full">{node}</div>
  const renderWidget = (kind: DashWidgetKind, box: Parameters<typeof DateWidget>[0]['box']): ReactNode => {
    const list = todos ?? []
    switch (kind) {
      case 'date':
        return <DateWidget today={today} box={box} events={events} />
      case 'timeline':
        return <TimelineWidget today={today} todos={list} diary={diary} events={events} />
      case 'progress':
        return <ProgressWidget todos={list} today={today} box={box} />
      case 'dday':
        return <DdayWidget today={today} upcoming={upcoming} box={box} />
      case 'todos':
        return <TodoListWidget todos={list} today={today} onToggle={toggle} onSelect={(item) => setSheet({ kind: 'todo', item })} onAdd={() => setSheet({ kind: 'todo' })} />
      case 'habitWeek':
        return <HabitWeekWidget habits={habits ?? []} checks={checks} today={today} box={box} onToggle={toggleHabit} />
      case 'tracker':
        return <TrackerWidget todos={list} today={today} box={box} />
      case 'money':
        return card(<MoneyCard month={month} items={transactions ?? []} today={today} onAdd={() => setSheet({ kind: 'money' })} />)
      case 'ai':
        return card(<AiFeedbackCard items={transactions ?? []} today={today} />)
      case 'payday':
        return card(<PaydayCard incomes={incomes ?? []} today={today} onAdd={() => setSheet({ kind: 'payday', fresh: (incomes ?? []).length === 0 })} />)
      case 'route':
        return <RouteWidget today={today} box={box} />
      case 'scrap':
        return card(
          <UnreadScrapCard unread={unread ?? []} linked={linked ?? new Map()} onAdd={() => setSheet({ kind: 'scrap' })} onOpen={open} onConvert={setConverting} onViewTodo={viewTodos} resurface={resurface} today={today} onLater={later} onDone={done} />,
        )
    }
  }

  return (
    <>
      <PageHeader
        title="대시보드"
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">{formatDateLabel(today)}</span>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label="위젯 편집"
                title="위젯 편집 (위젯을 꾹 눌러도 돼요)"
                className="tap flex size-8 items-center justify-center rounded-full bg-white/70 text-slate-500 shadow-card"
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            )}
          </div>
        }
      />

      {!loading && !editing && <BackupReminder hasData={(transactions?.length ?? 0) + (todos?.length ?? 0) > 0} />}
      {!loading && !editing && <ReportTeaser today={today} />}

      {/* 위젯 격자: 꾹 누르면 옮기고 크기를 바꾼다 (사용자 요청 2026-11-18) */}
      {!loading && <WidgetGrid editing={editing} onEditingChange={setEditing} render={renderWidget} />}

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
        {sheet?.kind === 'habit' && <HabitForm onSubmit={saveHabit} />}
        {sheet?.kind === 'scrap' && <BookmarkForm categories={scrapCategories} defaultCategoryId={null} isDuplicate={async (url) => !!(await bookmarkRepo.findSame(url))} onSubmit={saveScrap} />}
      </Modal>

      <ConvertToTodoDialog bookmark={converting} onClose={() => setConverting(null)} />
      <AssistantButton />
    </>
  )
}

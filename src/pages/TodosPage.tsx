import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import HabitDetail from '../components/habits/HabitDetail'
import HabitForm from '../components/habits/HabitForm'
import HabitsPanel from '../components/habits/HabitsPanel'
import CalendarView from '../components/todos/CalendarView'
import TodoForm from '../components/todos/TodoForm'
import TodoItem from '../components/todos/TodoItem'
import type { Habit, Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { isDueOn } from '../lib/savings'
import { laterTodos, sortTodos, todayProgress, todayTodos } from '../lib/summary'
import { openUrl } from '../platform/openUrl'
import { bookmarkRepo } from '../repositories/bookmarkRepo'
import { groupChecks, habitRepo, type HabitInput } from '../repositories/habitRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'

type Tab = 'today' | 'later' | 'all' | 'habits'
type View = 'list' | 'calendar'
type Editor = { mode: 'add'; dueDate?: string; categoryId?: number } | { mode: 'edit'; item: Todo } | null
type HabitSheet = { mode: 'add' } | { mode: 'edit'; habit: Habit } | { mode: 'detail'; id: number } | null

const VIEW_KEY = 'tidy:todo-view'

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list'
  } catch {
    return 'list'
  }
}

/** 할 일 화면 (spec US2) */
export default function TodosPage() {
  const today = useToday()
  const location = useLocation()
  const [params] = useSearchParams()
  // 스크랩의 "할 일 보기"로 들어오면 전체 탭, 대시보드 습관 카드로 들어오면 습관 탭을 연다
  const [tab, setTab] = useState<Tab>(() => {
    const want = params.get('tab') ?? (location.state as { tab?: Tab } | null)?.tab
    return want === 'all' || want === 'habits' ? want : 'today'
  })
  const [habitSheet, setHabitSheet] = useState<HabitSheet>(null)
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null)
  const [view, setViewState] = useState<View>(loadView)
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<Todo | null>(null)
  const toast = useToast()

  const all = useLiveQuery(() => todoRepo.listAll(), [])
  const bookmarkUrls = useLiveQuery(async () => new Map((await bookmarkRepo.list('all')).map((b) => [b.id, b.url])), [])
  const habits = useLiveQuery(() => habitRepo.list(), [])
  const checkRows = useLiveQuery(() => habitRepo.allChecks(), [])
  const checks = useMemo(() => groupChecks(checkRows ?? []), [checkRows])
  // 오늘 할 습관만 센다 (적금 습관은 넣는 날에만)
  const habitsDue = (habits ?? []).filter((h) => !h.schedule || isDueOn(h.schedule, today))
  const habitsDone = habitsDue.filter((h) => checks.get(h.id!)?.has(today)).length
  const visible = useMemo(
    () => (all ? (tab === 'today' ? todayTodos(all, today) : tab === 'later' ? laterTodos(all, today) : tab === 'all' ? sortTodos(all) : []) : undefined),
    [all, tab, today],
  )
  const progress = useMemo(() => todayProgress(all ?? [], today), [all, today])
  const laterOpen = useMemo(() => laterTodos(all ?? [], today).filter((t) => t.isCompleted === 0).length, [all, today])

  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* 저장 못 해도 화면은 바뀐다 */
    }
  }

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

  async function toggleHabit(habit: Habit, date: string) {
    if (habit.id == null) return
    try {
      const done = await habitRepo.toggle(habit.id, date)
      if (done && date === today) toast(`${habit.emoji} ${habit.title} 했어요`)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function saveHabit(input: HabitInput) {
    try {
      if (habitSheet?.mode === 'edit' && habitSheet.habit.id != null) {
        await habitRepo.update(habitSheet.habit.id, input)
        toast('수정했어요')
      } else {
        await habitRepo.add(input)
        toast('습관을 만들었어요')
      }
      setHabitSheet(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function confirmDeleteHabit() {
    if (deletingHabit?.id == null) return
    try {
      await habitRepo.remove(deletingHabit.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeletingHabit(null)
    setHabitSheet(null)
  }

  const detailHabit = habitSheet?.mode === 'detail' ? habits?.find((h) => h.id === habitSheet.id) : undefined
  const isHabits = view === 'list' && tab === 'habits'

  const openLinkFor = (t: Todo) => (t.bookmarkId != null && bookmarkUrls?.has(t.bookmarkId) ? () => openLink(t) : undefined)

  const firstDone = visible?.findIndex((t) => t.isCompleted === 1) ?? -1

  return (
    <>
      <PageHeader
        title="할 일"
        action={
          isHabits ? (
            <Button onClick={() => setHabitSheet({ mode: 'add' })}>+ 습관 추가</Button>
          ) : (
            <Button onClick={() => setEditor({ mode: 'add', dueDate: view === 'calendar' ? selected : undefined })}>+ 할 일 추가</Button>
          )
        }
      />

      <div className="mb-4 flex items-center gap-2">
        {view === 'list' && (
        <div className="grid flex-1 grid-cols-4 gap-1 rounded-2xl bg-slate-200/70 p-1 md:max-w-md" role="tablist">
          {(
            [
              ['today', `오늘 ${progress.done}/${progress.total}`],
              ['later', `나중 ${laterOpen}`],
              ['all', `전체 ${all?.length ?? 0}`],
              ['habits', `습관 ${habitsDone}/${habitsDue.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`min-h-11 rounded-xl px-1 text-[13px] font-semibold whitespace-nowrap sm:text-sm ${tab === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
        )}
        {view === 'calendar' && <p className="flex-1 text-sm text-slate-500">날짜를 눌러 그날 할 일을 카테고리별로 봐요</p>}
        {!isHabits && (
        <div className="ml-auto flex shrink-0 gap-1 rounded-2xl bg-slate-200/70 p-1" role="radiogroup" aria-label="보기 방식">
          {(
            [
              ['list', '목록', List],
              ['calendar', '캘린더', CalendarDays],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              aria-label={`${label}으로 보기`}
              title={label}
              onClick={() => setView(key)}
              className={`flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${view === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              <Icon className="size-[18px]" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
        )}
      </div>

      {view === 'calendar' ? (
        all && (
          <CalendarView
            todos={all}
            today={today}
            month={month}
            selected={selected}
            onMonthChange={setMonth}
            onSelect={setSelected}
            onAdd={(d, categoryId) => {
              setSelected(d)
              setEditor({ mode: 'add', dueDate: d, categoryId })
            }}
            onToggle={toggle}
            onEdit={(t) => setEditor({ mode: 'edit', item: t })}
            openLinkFor={openLinkFor}
          />
        )
      ) : isHabits ? (
        habits && (
          <HabitsPanel
            habits={habits}
            checks={checks}
            today={today}
            onAdd={() => setHabitSheet({ mode: 'add' })}
            onToggle={toggleHabit}
            onOpen={(h) => h.id != null && setHabitSheet({ mode: 'detail', id: h.id })}
          />
        )
      ) : (
      <>

      {visible === undefined ? null : visible.length === 0 ? (
        <EmptyState
          icon="✅"
          title={tab === 'today' ? '오늘 할 일이 없어요' : tab === 'later' ? '나중에 할 일이 없어요' : '할 일을 추가해 보세요'}
          description={tab === 'today' ? '마감일을 오늘로 정한 할 일이 여기에 보여요.' : tab === 'later' ? '내일 이후로 정했거나 날짜 없이 둔 할 일이 여기에 보여요.' : undefined}
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 할 일 추가</Button>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 card overflow-hidden">
          {visible.map((t, i) => (
            <TodoRow key={t.id} showDoneHeader={i === firstDone && i > 0}>
              <TodoItem todo={t} today={today} onToggle={() => toggle(t)} onSelect={() => setEditor({ mode: 'edit', item: t })}
                onOpenLink={openLinkFor(t)}
              />
            </TodoRow>
          ))}
        </ul>
      )}
      </>
      )}

      <Modal open={editor !== null} title={editor?.mode === 'edit' ? '할 일 수정' : '할 일 추가'} onClose={() => setEditor(null)}>
        {editor && (
          <TodoForm
            key={editor.mode === 'edit' ? editor.item.id : `new-${editor.dueDate ?? ''}-${editor.categoryId ?? ''}`}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            defaultDueDate={editor.mode === 'add' && editor.dueDate ? editor.dueDate : view === 'list' && tab === 'today' ? today : null}
            defaultCategoryId={editor.mode === 'add' ? editor.categoryId : undefined}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <Modal
        open={habitSheet !== null}
        title={habitSheet?.mode === 'add' ? '습관 추가' : habitSheet?.mode === 'edit' ? '습관 수정' : detailHabit ? `${detailHabit.emoji} ${detailHabit.title}` : ''}
        onClose={() => setHabitSheet(null)}
      >
        {habitSheet?.mode === 'add' && <HabitForm onSubmit={saveHabit} />}
        {habitSheet?.mode === 'edit' && <HabitForm initial={habitSheet.habit} onSubmit={saveHabit} onDelete={() => setDeletingHabit(habitSheet.habit)} />}
        {detailHabit && (
          <HabitDetail
            habit={detailHabit}
            done={checks.get(detailHabit.id!) ?? new Set()}
            today={today}
            onToggle={(d) => toggleHabit(detailHabit, d)}
            onEdit={() => setHabitSheet({ mode: 'edit', habit: detailHabit })}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingHabit !== null}
        title="습관 삭제"
        message="이 습관과 지금까지의 체크 기록을 모두 삭제할까요? 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDeleteHabit}
        onCancel={() => setDeletingHabit(null)}
      />

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

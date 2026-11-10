import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { Todo, TodoCategory, TodoCategoryColor } from '../../db/types'
import { dayProgress, dayTitle, groupByCategory, monthGrid, shiftMonth, todosOn } from '../../lib/calendar'
import { TODO_CATEGORY_COLORS, todoCategoryRepo } from '../../repositories/todoCategoryRepo'
import ConfirmDialog from '../common/ConfirmDialog'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import { CATEGORY_HEX } from './categoryColors'
import DayBlob from './DayBlob'
import TodoCategoryForm from './TodoCategoryForm'
import TodoItem from './TodoItem'

interface CalendarViewProps {
  todos: Todo[]
  today: string
  month: string
  selected: string
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
  onAdd: (date: string, categoryId?: number) => void
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  openLinkFor: (todo: Todo) => (() => void) | undefined
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

type CategorySheet = { mode: 'add' } | { mode: 'edit'; category: TodoCategory } | null

/**
 * 할 일 전용 캘린더
 * 날짜마다 조약돌 모양이 그날 할 일을 끝낸 만큼 차오르고, 다 끝내면 체크가 뜬다.
 * 아래에는 고른 날의 할 일을 카테고리별로 묶어 보여 주고, 카테고리마다 + 로 바로 추가한다.
 */
export default function CalendarView({ todos, today, month, selected, onMonthChange, onSelect, onAdd, onToggle, onEdit, openLinkFor }: CalendarViewProps) {
  const days = useMemo(() => monthGrid(month), [month])
  const progress = useMemo(() => dayProgress(todos), [todos])
  const dayTodos = useMemo(() => todosOn(todos, selected), [todos, selected])
  const categories = useLiveQuery(() => todoCategoryRepo.list(), [])
  const groups = useMemo(() => (categories ? groupByCategory(dayTodos, categories) : []), [dayTodos, categories])
  const [sheet, setSheet] = useState<CategorySheet>(null)
  const [deleting, setDeleting] = useState<TodoCategory | null>(null)
  const toast = useToast()
  const [y, m] = month.split('-').map(Number)

  // 이번 달에 할 일을 다 끝낸 날 수
  const doneDays = useMemo(
    () => days.filter((d) => d.slice(0, 7) === month && progress.get(d) && progress.get(d)!.done === progress.get(d)!.total).length,
    [days, month, progress],
  )
  const selDone = dayTodos.filter((t) => t.isCompleted === 1).length

  // 폰에서 좌우로 밀어 달 넘기기
  const touchX = useRef<number | null>(null)
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 50) onMonthChange(shiftMonth(month, dx < 0 ? 1 : -1))
  }

  function pick(date: string) {
    onSelect(date)
    if (date.slice(0, 7) !== month) onMonthChange(date.slice(0, 7))
  }

  async function saveCategory(name: string, color: TodoCategoryColor) {
    if (sheet?.mode === 'edit' && sheet.category.id != null) {
      await todoCategoryRepo.update(sheet.category.id, name, color)
      toast('수정했어요')
    } else {
      await todoCategoryRepo.add(name, color)
      toast('카테고리를 만들었어요')
    }
    setSheet(null)
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await todoCategoryRepo.remove(deleting.id)
      toast('삭제했어요. 그 할 일은 기본으로 옮겼어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setSheet(null)
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
      <section
        className="card p-3 sm:p-4"
        aria-label={`${y}년 ${m}월 할 일 캘린더`}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <div className="mb-2 flex items-center gap-1 px-1">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold tracking-tight">
              {y}년 <span className="text-brand-600">{m}월</span>
            </h2>
            <p className="text-xs text-slate-400">{doneDays > 0 ? `${doneDays}일 동안 할 일을 다 끝냈어요` : '할 일을 다 끝낸 날은 체크가 떠요'}</p>
          </div>
          {month !== today.slice(0, 7) || selected !== today ? (
            <button type="button" onClick={() => pick(today)} className="mr-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
              오늘
            </button>
          ) : null}
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, -1))} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => onMonthChange(shiftMonth(month, 1))} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
          {WEEK.map((w, i) => (
            <div key={w} className={`py-1.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-sky-500' : ''}`}>
              {w}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-y-1" role="grid">
          {days.map((d, i) => {
            const inMonth = d.slice(0, 7) === month
            const isToday = d === today
            const isSel = d === selected
            const p = progress.get(d) ?? { total: 0, done: 0 }
            const overdue = d < today && p.done < p.total
            const dow = i % 7
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${dayTitle(d)}${isToday ? ', 오늘' : ''}${p.total ? `, 할 일 ${p.total}개 중 ${p.done}개 완료` : ''}`}
                onClick={() => pick(d)}
                onDoubleClick={() => onAdd(d)}
                className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 transition ${isSel ? 'bg-brand-50' : ''}`}
              >
                <DayBlob total={p.total} done={p.done} overdue={overdue} dim={!inMonth} className="size-9 sm:size-10" />
                <span
                  className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] leading-none ${
                    isToday
                      ? 'bg-slate-900 font-bold text-white'
                      : !inMonth
                        ? 'text-slate-300'
                        : isSel
                          ? 'font-bold text-brand-700'
                          : dow === 0
                            ? 'text-red-400'
                            : dow === 6
                              ? 'text-sky-500'
                              : 'text-slate-700'
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="space-y-3" aria-label={`${dayTitle(selected)} 할 일`}>
        <div className="flex items-baseline gap-2 px-1">
          <h3 className="text-[17px] font-bold">{dayTitle(selected)}</h3>
          <p className="text-xs text-slate-400">{dayTodos.length > 0 ? `${dayTodos.length}개 중 ${selDone}개 끝냄` : '아직 할 일이 없어요'}</p>
        </div>

        {groups.map(({ category, todos: list }) => {
          const hex = category ? CATEGORY_HEX[category.color] : undefined
          const name = category?.name ?? '기본'
          return (
            <div key={category?.id ?? 'base'} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1 pl-1">
                  <button
                    type="button"
                    onClick={() => category && setSheet({ mode: 'edit', category })}
                    disabled={!category}
                    className="flex min-h-8 items-center gap-2 rounded-full pr-1 pl-2.5 disabled:cursor-default"
                    aria-label={category ? `${name} 카테고리 고치기` : undefined}
                  >
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: hex ?? 'var(--color-slate-400)' }} aria-hidden />
                    <span className="text-[15px] font-bold" style={hex ? { color: hex } : undefined}>
                      {name}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onAdd(selected, category?.id)}
                    className="flex size-8 items-center justify-center rounded-full bg-white text-slate-700 shadow-card"
                    aria-label={`${name}에 할 일 추가`}
                  >
                    <Plus className="size-4" strokeWidth={3} aria-hidden />
                  </button>
                </div>
                {list.length > 0 && (
                  <span className="ml-auto pr-1 text-xs text-slate-400">
                    {list.filter((t) => t.isCompleted === 1).length}/{list.length}
                  </span>
                )}
              </div>
              {list.length === 0 ? (
                <p className="px-4 pt-1 pb-3 text-xs text-slate-400">+ 를 눌러 이날 할 일을 넣어요</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {list.map((t) => (
                    <TodoItem key={t.id} todo={t} today={today} onToggle={() => onToggle(t)} onSelect={() => onEdit(t)} onOpenLink={openLinkFor(t)} />
                  ))}
                </ul>
              )}
            </div>
          )
        })}

        <button
          type="button"
          onClick={() => setSheet({ mode: 'add' })}
          className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50"
        >
          <Plus className="size-4" strokeWidth={3} aria-hidden /> 카테고리 만들기
        </button>
      </section>

      <Modal open={sheet !== null} title={sheet?.mode === 'edit' ? '카테고리 고치기' : '카테고리 만들기'} onClose={() => setSheet(null)}>
        {sheet && (
          <TodoCategoryForm
            key={sheet.mode === 'edit' ? sheet.category.id : 'new'}
            initial={sheet.mode === 'edit' ? sheet.category : undefined}
            defaultColor={TODO_CATEGORY_COLORS[(categories?.length ?? 0) % TODO_CATEGORY_COLORS.length]}
            onSubmit={saveCategory}
            onDelete={sheet.mode === 'edit' ? () => setDeleting(sheet.category) : undefined}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="카테고리 삭제"
        message={`'${deleting?.name ?? ''}' 카테고리를 지울까요? 안에 있던 할 일은 지우지 않고 기본으로 옮겨요.`}
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

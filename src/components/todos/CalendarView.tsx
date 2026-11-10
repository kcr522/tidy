import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useRef } from 'react'
import type { Todo } from '../../db/types'
import { dayMarks, dayTitle, expenseOn, monthGrid, shiftMonth, todosOn, type DayMark } from '../../lib/calendar'
import { formatWon } from '../../lib/format'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import TodoItem from './TodoItem'

interface CalendarViewProps {
  todos: Todo[]
  today: string
  month: string
  selected: string
  onMonthChange: (month: string) => void
  onSelect: (date: string) => void
  onAdd: (date: string) => void
  onToggle: (todo: Todo) => void
  onEdit: (todo: Todo) => void
  openLinkFor: (todo: Todo) => (() => void) | undefined
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

const DOT: Record<DayMark, string> = {
  open: 'bg-brand-500',
  done: 'bg-slate-300',
  overdue: 'bg-expense',
}

/** 월간 캘린더 + 선택한 날의 할 일 (spec 002 US1, US2) */
export default function CalendarView({ todos, today, month, selected, onMonthChange, onSelect, onAdd, onToggle, onEdit, openLinkFor }: CalendarViewProps) {
  const days = useMemo(() => monthGrid(month), [month])
  const marks = useMemo(() => dayMarks(todos, today), [todos, today])
  const dayTodos = useMemo(() => todosOn(todos, selected), [todos, selected])
  const [y, m] = month.split('-').map(Number)
  const selectedMonth = selected.slice(0, 7)
  const [sy, sm] = selectedMonth.split('-').map(Number)
  const monthTx = useLiveQuery(() => transactionRepo.listByMonth(sy, sm), [sy, sm])
  const spent = monthTx ? expenseOn(monthTx, selected) : 0

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

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start">
      <section
        className="card p-3 sm:p-4"
        aria-label={`${y}년 ${m}월 캘린더`}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={onTouchEnd}
      >
        <div className="mb-2 flex items-center gap-1 px-1">
          <h2 className="flex-1 text-lg font-extrabold tracking-tight">
            {y}년 <span className="text-brand-600">{m}월</span>
          </h2>
          {month !== today.slice(0, 7) || selected !== today ? (
            <button
              type="button"
              onClick={() => pick(today)}
              className="mr-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"
            >
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

        <div className="grid grid-cols-7" role="grid">
          {days.map((d, i) => {
            const inMonth = d.slice(0, 7) === month
            const isToday = d === today
            const isSel = d === selected
            const info = marks.get(d)
            const dow = i % 7
            return (
              <button
                key={d}
                type="button"
                role="gridcell"
                aria-selected={isSel}
                aria-label={`${dayTitle(d)}${isToday ? ', 오늘' : ''}${info ? `, 할 일 ${info.total}개${info.open ? `, 남은 일 ${info.open}개` : ', 모두 완료'}` : ''}`}
                onClick={() => pick(d)}
                onDoubleClick={() => onAdd(d)}
                className="flex h-12 flex-col items-center justify-start gap-1 pt-1 sm:h-14"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-[15px] transition ${
                    isSel
                      ? 'bg-grad on-grad font-bold shadow-float'
                      : isToday
                        ? 'font-bold text-brand-700 ring-2 ring-brand-400'
                        : !inMonth
                          ? 'text-slate-300'
                          : dow === 0
                            ? 'text-red-400'
                            : dow === 6
                              ? 'text-sky-500'
                              : 'text-slate-700'
                  }`}
                >
                  {Number(d.slice(8))}
                </span>
                <span className={`size-1.5 rounded-full ${info ? DOT[info.mark] : 'bg-transparent'} ${!inMonth ? 'opacity-40' : ''}`} aria-hidden />
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex justify-center gap-4 text-[11px] text-slate-400">
          <Legend className="bg-brand-500" label="할 일" />
          <Legend className="bg-slate-300" label="모두 완료" />
          <Legend className="bg-expense" label="기한 지남" />
        </div>
      </section>

      <section className="card overflow-hidden" aria-label={`${dayTitle(selected)} 할 일`}>
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[17px] font-bold">{dayTitle(selected)}</h3>
            <p className="text-xs text-slate-400">
              할 일 {dayTodos.length}개{spent > 0 && <> · 지출 <span className="font-semibold text-expense">{formatWon(spent)}</span></>}
            </p>
          </div>
          <Button className="min-h-10 px-3.5 text-sm" onClick={() => onAdd(selected)} aria-label={`${dayTitle(selected)}에 할 일 추가`}>
            <Plus className="size-4" strokeWidth={3} aria-hidden /> 추가
          </Button>
        </div>
        {dayTodos.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-[15px] font-semibold text-slate-600">이날은 할 일이 없어요</p>
            <p className="mt-1 text-xs text-slate-400">추가 버튼을 누르거나 날짜를 두 번 누르면 바로 추가돼요.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {dayTodos.map((t) => (
              <TodoItem key={t.id} todo={t} today={today} onToggle={() => onToggle(t)} onSelect={() => onEdit(t)} onOpenLink={openLinkFor(t)} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`size-1.5 rounded-full ${className}`} aria-hidden />
      {label}
    </span>
  )
}

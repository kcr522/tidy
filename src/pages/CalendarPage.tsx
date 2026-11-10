import { useLiveQuery } from 'dexie-react-hooks'
import { BookHeart, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import CalendarAddForm from '../components/calendar/CalendarAddForm'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
import { useToast } from '../components/common/Toast'
import TodoForm from '../components/todos/TodoForm'
import type { CalendarEvent, Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { dayTitle, monthGrid, shiftMonth, todosOn } from '../lib/calendar'
import { EVENT_COLORS, eventCovers, eventDays, layoutWeeks, type Bar } from '../lib/eventLayout'
import { diaryRepo } from '../repositories/diaryRepo'
import { eventRepo, type EventInput } from '../repositories/eventRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
/** 한 칸에 그리는 막대 줄 수. 넘치면 "+n" */
const MAX_LANES = 3

type Editor = { mode: 'add' } | { mode: 'event'; item: CalendarEvent } | { mode: 'todo'; item: Todo } | null

/** 월간 캘린더: 일정(여러 날은 긴 막대)과 할 일을 한 화면에 */
export default function CalendarPage() {
  const today = useToday()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<CalendarEvent | Todo | null>(null)
  const toast = useToast()

  const grid = useMemo(() => monthGrid(month), [month])
  const events = useLiveQuery(() => eventRepo.listBetween(grid[0], grid[grid.length - 1]), [grid])
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const diaryList = useLiveQuery(() => diaryRepo.listBetween(grid[0], grid[grid.length - 1]), [grid])
  const diaries = useMemo(() => new Map((diaryList ?? []).map((d) => [d.date, d])), [diaryList])
  const selDiary = diaries.get(selected)
  const navigate = useNavigate()
  const weeks = useMemo(() => layoutWeeks(grid, events ?? [], todos ?? [], MAX_LANES), [grid, events, todos])

  const selEvents = useMemo(
    () => (events ?? []).filter((e) => eventCovers(e, selected)).sort((a, b) => eventDays(b) - eventDays(a)),
    [events, selected],
  )
  const selTodos = useMemo(() => todosOn(todos ?? [], selected), [todos, selected])

  const [y, m] = month.split('-').map(Number)
  const [, sm, sd] = selected.split('-').map(Number)

  const touchX = useRef<number | null>(null)
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 60) setMonth(shiftMonth(month, dx < 0 ? 1 : -1))
  }

  function pick(date: string) {
    setSelected(date)
    if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7))
  }

  async function saveEvent(input: EventInput) {
    try {
      if (editor?.mode === 'event' && editor.item.id != null) {
        await eventRepo.update(editor.item.id, input)
        toast('일정을 수정했어요')
      } else {
        await eventRepo.add(input)
        toast('일정을 저장했어요')
      }
      setEditor(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function saveTodo(input: TodoInput) {
    try {
      if (editor?.mode === 'todo' && editor.item.id != null) {
        await todoRepo.update(editor.item.id, input)
        toast('수정했어요')
      } else {
        await todoRepo.add(input)
        toast(input.dueDate === today ? "할 일 '오늘'에 넣었어요" : "할 일 '나중'에 넣었어요")
      }
      setEditor(null)
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function toggle(t: Todo) {
    if (t.id != null) await todoRepo.toggleComplete(t.id).catch(() => toast('바꾸지 못했어요', 'error'))
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      if ('startDate' in deleting) await eventRepo.remove(deleting.id)
      else await todoRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setEditor(null)
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:items-start">
        <section
          className="card overflow-hidden p-2 sm:p-4"
          aria-label={`${y}년 ${m}월 캘린더`}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={onTouchEnd}
        >
          <div className="mb-1 flex items-center gap-1 px-2 pt-1">
            <h1 className="flex-1 text-[26px] font-extrabold tracking-tight">
              {m}월 <span className="text-base font-semibold text-slate-400">{y}</span>
            </h1>
            {(month !== today.slice(0, 7) || selected !== today) && (
              <button type="button" onClick={() => pick(today)} className="mr-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                오늘
              </button>
            )}
            <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
              <ChevronLeft className="size-5" aria-hidden />
            </button>
            <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="다음 달">
              <ChevronRight className="size-5" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500">
            {WEEK.map((w, i) => (
              <div key={w} className={`py-1.5 ${i === 0 ? 'text-red-400' : i === 6 ? 'text-sky-500' : ''}`}>
                {w}
              </div>
            ))}
          </div>

          <div role="grid" className="flex flex-col gap-1">
            {weeks.map((week) => (
              <div key={week.days[0]} role="row" className="relative h-[104px] [--lane-h:19px] sm:h-[114px] sm:[--lane-h:21px]">
                <div className="absolute inset-0 grid grid-cols-7 gap-1">
                  {week.days.map((d, c) => {
                    const inMonth = d.slice(0, 7) === month
                    const isSel = d === selected
                    const isToday = d === today
                    const diary = diaries.get(d)
                    return (
                      <button
                        key={d}
                        type="button"
                        role="gridcell"
                        aria-selected={isSel}
                        aria-label={`${dayTitle(d)}${isToday ? ', 오늘' : ''}${diary ? ', 일기 있음' : ''}`}
                        onClick={() => pick(d)}
                        onDoubleClick={() => {
                          pick(d)
                          setEditor({ mode: 'add' })
                        }}
                        className={`relative flex flex-col items-center overflow-hidden rounded-xl pt-1 transition-colors ${
                          isSel ? 'bg-brand-50 ring-2 ring-brand-500/60 ring-inset' : inMonth ? 'bg-slate-50' : ''
                        }`}
                      >
                        {diary?.photo && (
                          // 사진 일기: 날짜 뒤에 사진을 흐리게
                          <img src={diary.photo} alt="" className={`absolute inset-0 size-full object-cover ${inMonth ? 'opacity-40' : 'opacity-20'}`} aria-hidden />
                        )}
                        <span
                          style={diary && !diary.photo && !isToday ? { background: diary.color } : undefined}
                          className={`relative flex size-6 items-center justify-center rounded-full text-[13px] font-bold ${
                            isToday
                              ? 'bg-grad on-grad'
                              : !inMonth
                                ? 'text-slate-300'
                                : c === 0
                                  ? 'text-red-400'
                                  : c === 6
                                    ? 'text-sky-500'
                                    : 'text-slate-700'
                          }`}
                        >
                          {Number(d.slice(8))}
                        </span>
                        {week.hidden[c] > 0 && (
                          <span className="relative mt-auto mb-0.5 text-[10px] font-semibold text-slate-400">+{week.hidden[c]}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {week.bars.map((bar) => (
                  <BarView key={bar.key} bar={bar} dim={!bar.event && bar.todo?.dueDate?.slice(0, 7) !== month} />
                ))}
              </div>
            ))}
          </div>
        </section>

        <section className="card overflow-hidden" aria-label={`${dayTitle(selected)} 일정`}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-bold">{dayTitle(selected)}</h2>
              <p className="text-xs text-slate-400">
                일정 {selEvents.length}개 · 할 일 {selTodos.length}개
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/diary', { state: { date: selected } })}
            className="flex w-full items-center gap-3 border-b border-slate-100 px-4 py-3 text-left"
          >
            {selDiary?.photo ? (
              <img src={selDiary.photo} alt="" className="size-11 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400" style={selDiary ? { background: selDiary.color, color: '#191f28' } : undefined}>
                <BookHeart className="size-5" aria-hidden />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{selDiary ? '일기' : selected <= today ? '일기 쓰기' : '일기'}</span>
              <span className="line-clamp-1 text-sm text-slate-500">
                {selDiary ? selDiary.text || '사진만 있어요' : selected <= today ? '이날 한 일을 남겨 보세요' : '그날이 되면 쓸 수 있어요'}
              </span>
            </span>
            <ChevronRight className="size-4 text-slate-300" aria-hidden />
          </button>
          {selEvents.length === 0 && selTodos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              아직 비어 있어요.
              <br />
              아래 버튼이나 날짜를 두 번 눌러 추가해요.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {selEvents.map((e) => (
                <li key={`e${e.id}`}>
                  <button type="button" onClick={() => setEditor({ mode: 'event', item: e })} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                    <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: EVENT_COLORS[e.color].bg }} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{e.title}</span>
                      <span className="block text-xs text-slate-400">
                        {e.startDate === e.endDate ? '하루 일정' : `${shortDate(e.startDate)} ~ ${shortDate(e.endDate)} · ${eventDays(e)}일`}
                        {e.memo && ` · ${e.memo}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {selTodos.map((t) => (
                <li key={`t${t.id}`} className="flex items-center">
                  <button type="button" role="checkbox" aria-checked={t.isCompleted === 1} aria-label={`${t.title} 완료`} onClick={() => toggle(t)} className="flex min-h-12 items-center px-4">
                    <span className={`flex size-6 items-center justify-center rounded-full ${t.isCompleted ? 'bg-grad on-grad' : 'border-2 border-slate-300'}`}>
                      {t.isCompleted === 1 && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
                    </span>
                  </button>
                  <button type="button" onClick={() => setEditor({ mode: 'todo', item: t })} className="min-w-0 flex-1 py-3 pr-4 text-left">
                    <span className={`block truncate text-[15px] ${t.isCompleted ? 'text-slate-400 line-through' : 'font-medium'}`}>{t.title}</span>
                    <span className="block text-xs text-slate-400">할 일 · {t.dueDate === today ? '오늘' : t.dueDate! < today ? '지난 날' : '나중'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 아래에 떠 있는 추가 버튼 (스크린샷의 "8월 1일에 추가") */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 flex justify-center px-6 md:bottom-8 md:left-60">
        <button
          type="button"
          onClick={() => setEditor({ mode: 'add' })}
          className="bg-grad on-grad pointer-events-auto flex min-h-14 w-full max-w-sm items-center justify-between rounded-full pr-4 pl-6 text-[16px] font-bold shadow-float active:scale-[0.98]"
        >
          {sm}월 {sd}일에 추가
          <Plus className="size-6" strokeWidth={2.6} aria-hidden />
        </button>
      </div>
      <div className="h-16" aria-hidden />

      <Modal
        open={editor !== null}
        title={editor?.mode === 'event' ? '일정 수정' : editor?.mode === 'todo' ? '할 일 수정' : `${dayTitle(selected)}에 추가`}
        onClose={() => setEditor(null)}
      >
        {editor?.mode === 'todo' ? (
          <TodoForm key={editor.item.id} initial={editor.item} onSubmit={saveTodo} onDelete={() => setDeleting(editor.item)} />
        ) : editor ? (
          <CalendarAddForm
            key={editor.mode === 'event' ? `e${editor.item.id}` : `new-${selected}`}
            date={selected}
            today={today}
            initial={editor.mode === 'event' ? editor.item : undefined}
            onSaveEvent={saveEvent}
            onSaveTodo={saveTodo}
            onDelete={editor.mode === 'event' ? () => setDeleting(editor.item) : undefined}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="삭제"
        message="삭제하면 되돌릴 수 없어요. 삭제할까요?"
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function shortDate(key: string): string {
  return `${Number(key.slice(5, 7))}.${Number(key.slice(8))}`
}

/** 막대 하나. 날짜 숫자 아래 줄(lane)에 7칸 기준으로 위치를 잡는다 */
function BarView({ bar, dim }: { bar: Bar; dim: boolean }) {
  const style = {
    left: `calc(${(bar.col / 7) * 100}% + 2px)`,
    width: `calc(${(bar.span / 7) * 100}% - 4px)`,
    top: `calc(30px + ${bar.lane} * var(--lane-h))`,
  }
  const round = `${bar.fromPrev ? 'rounded-l-none' : 'rounded-l-md'} ${bar.toNext ? 'rounded-r-none' : 'rounded-r-md'}`
  if (bar.event) {
    return (
      <div
        className={`pointer-events-none absolute flex h-[calc(var(--lane-h)-3px)] items-center overflow-hidden px-1.5 text-[11px] leading-none font-semibold whitespace-nowrap text-white sm:text-xs ${round} ${bar.span > 1 ? 'justify-center' : ''}`}
        style={{ ...style, background: EVENT_COLORS[bar.event.color].bg }}
        aria-hidden
      >
        <span className="truncate">{bar.title}</span>
      </div>
    )
  }
  const done = bar.todo?.isCompleted === 1
  return (
    <div
      className={`pointer-events-none absolute flex h-[calc(var(--lane-h)-3px)] items-center gap-1 overflow-hidden rounded-md bg-white px-1 text-[11px] leading-none font-medium whitespace-nowrap text-slate-700 shadow-[inset_0_0_0_1px_var(--color-slate-200)] sm:text-xs ${dim ? 'opacity-50' : ''}`}
      style={style}
      aria-hidden
    >
      <span className={`size-2 shrink-0 rounded-full ${done ? 'bg-slate-300' : 'bg-brand-500'}`} />
      <span className={`truncate ${done ? 'text-slate-400 line-through' : ''}`}>{bar.title}</span>
    </div>
  )
}

import { formatDateLabel } from '../lib/format'
import { useLiveQuery } from 'dexie-react-hooks'
import { BookHeart, ChevronLeft, ChevronRight, Plus, SmilePlus, Wallet } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import CalendarAddForm from '../components/calendar/CalendarAddForm'
import { DropOverlay, filesToAttachments } from '../components/common/AttachmentField'
import { useFileDrop } from '../hooks/useFileDrop'
import { MAX_ATTACHMENTS } from '../lib/attachments'
import DiaryMonth from '../components/calendar/DiaryMonth'
import DiaryViewer from '../components/calendar/DiaryViewer'
import ConfirmDialog from '../components/common/ConfirmDialog'
import Modal from '../components/common/Modal'
import { useToast } from '../components/common/Toast'
import TodoForm from '../components/todos/TodoForm'
import type { Attachment, CalendarEvent, Diary, Todo } from '../db/types'
import { useToday } from '../hooks/useToday'
import { dayTitle, monthGrid, shiftMonth, todosOn } from '../lib/calendar'
import { eventBg, eventCovers, eventDays, eventFg, layoutWeeks, shortDate, type Bar } from '../lib/eventLayout'
import { HOLIDAY_COLOR, holidaysBetween } from '../lib/holidays'
import { stickerRepo } from '../repositories/stickerRepo'
import StickerPanel from '../components/calendar/StickerPanel'
import DayItems from '../components/calendar/DayItems'
import DayPopup from '../components/calendar/DayPopup'
import { diaryRepo } from '../repositories/diaryRepo'
import { eventRepo, type EventInput } from '../repositories/eventRepo'
import { todoRepo, type TodoInput } from '../repositories/todoRepo'
import { calOf, loadGoogleCals, onGoogleCalChange } from '../platform/googleCalendar'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
/** 한 칸에 그리는 막대 줄 수. 넘치면 "+n" */
const MAX_LANES = 4

type Editor = { mode: 'add'; draft?: EventInput; files?: Attachment[] } | { mode: 'event'; item: CalendarEvent } | { mode: 'todo'; item: Todo } | null

/** 월간 캘린더: 일정(여러 날은 긴 막대)과 할 일을 한 화면에 */
export default function CalendarPage() {
  const today = useToday()
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [selected, setSelected] = useState(today)
  const [editor, setEditor] = useState<Editor>(null)
  // 구글 캘린더에서 가져온 일정은 고칠 수 없어서 보기만 한다
  const [googleItem, setGoogleItem] = useState<CalendarEvent | null>(null)
  const [googleCals, setGoogleCals] = useState(loadGoogleCals)
  useEffect(() => onGoogleCalChange(() => setGoogleCals(loadGoogleCals())), [])
  const [deleting, setDeleting] = useState<CalendarEvent | Todo | null>(null)
  const toast = useToast()

  const grid = useMemo(() => monthGrid(month), [month])
  const events = useLiveQuery(() => eventRepo.listBetween(grid[0], grid[grid.length - 1]), [grid])
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const diaryList = useLiveQuery(() => diaryRepo.listBetween(grid[0], grid[grid.length - 1]), [grid])
  const diaries = useMemo(() => new Map((diaryList ?? []).map((d) => [d.date, d])), [diaryList])
  const selDiary = diaries.get(selected)
  // 일기 달력: 일기 쓴 날만 사진/색으로 보여 주고, 누르면 그 일기를 연다 (사용자 요청 2026-11-12)
  const [diaryView, setDiaryView] = useState(() => readDiaryView())
  const [viewing, setViewing] = useState<Diary | null>(null)
  function toggleDiaryView() {
    const next = !diaryView
    setDiaryView(next)
    try {
      localStorage.setItem(DIARY_VIEW_KEY, next ? '1' : '0')
    } catch {
      // 저장 못 해도 이번에는 바뀐다
    }
  }
  const navigate = useNavigate()
  const location = useLocation()
  // AI 대화창의 "내가 등록할게": 찾은 일정을 하나씩 채워서 추가 창을 연다
  const [queue, setQueue] = useState<EventInput[]>(() => (location.state as { drafts?: EventInput[] } | null)?.drafts ?? [])
  useEffect(() => {
    if (!queue.length) return
    navigate(location.pathname, { replace: true, state: null })
    openDraft(queue[0])
    // 처음 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  function openDraft(d: EventInput) {
    setSelected(d.startDate)
    setMonth(d.startDate.slice(0, 7))
    setEditor({ mode: 'add', draft: d })
  }
  /** 추가 창을 닫거나 저장하면 다음 일정으로 */
  function nextDraft() {
    const rest = queue.slice(1)
    setQueue(rest)
    if (rest.length) openDraft(rest[0])
    else setEditor(null)
  }
  const closeEditor = () => (editor?.mode === 'add' && editor.draft ? nextDraft() : setEditor(null))
  // 컴퓨터에서 파일을 끌어다 놓으면: 고른 날에 새 일정을 열고 파일을 붙여 둔다 (창이 열려 있으면 그 창이 받는다)
  const dragging = useFileDrop(async (files) => {
    const { added, error } = await filesToAttachments(files, MAX_ATTACHMENTS)
    if (error) toast(error, 'error')
    if (added.length) setEditor({ mode: 'add', files: added })
  }, editor === null)
  const holidays = useMemo(() => holidaysBetween(grid[0], grid[grid.length - 1]), [grid])
  const stickerList = useLiveQuery(() => stickerRepo.listBetween(grid[0], grid[grid.length - 1]), [grid])
  const stickers = useMemo(() => new Map((stickerList ?? []).map((st) => [st.date, st])), [stickerList])
  // 스티커 고르는 창을 연 날
  const [stickerFor, setStickerFor] = useState<string | null>(null)
  // 날짜를 누르면 그날 일정을 바로 띄운다 (아래로 내려서 보지 않아도 되게, 사용자 요청 2026-11-13)
  const [dayOpen, setDayOpen] = useState<string | null>(null)
  const weeks = useMemo(() => layoutWeeks(grid, events ?? [], todos ?? [], MAX_LANES, holidays), [grid, events, todos, holidays])

  const selEvents = useMemo(
    () => (events ?? []).filter((e) => eventCovers(e, selected)).sort((a, b) => eventDays(b) - eventDays(a)),
    [events, selected],
  )
  const selTodos = useMemo(() => todosOn(todos ?? [], selected), [todos, selected])
  const selHolidays = holidays.get(selected) ?? []

  const [y, m] = month.split('-').map(Number)
  const [, sm, sd] = selected.split('-').map(Number)

  const touchX = useRef<number | null>(null)
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    touchX.current = null
    if (Math.abs(dx) > 60) setMonth(shiftMonth(month, dx < 0 ? 1 : -1))
  }

  function openEvent(e: CalendarEvent) {
    if (e.source === 'google') setGoogleItem(e)
    else setEditor({ mode: 'event', item: e })
  }

  function pick(date: string) {
    setSelected(date)
    if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7))
  }

  /** 날짜 누르기: 일정·할 일·공휴일이 있으면 바로 띄우고, 빈 날은 고르기만 (한 번 더 누르면 추가) */
  function tapDay(date: string) {
    if (stickerFor && stickerFor !== date) setStickerFor(null)
    const has = holidays.has(date) || (events ?? []).some((e) => eventCovers(e, date)) || todosOn(todos ?? [], date).length > 0
    if (has) setDayOpen(date)
    else if (date === selected) setEditor({ mode: 'add' })
    pick(date)
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
      closeEditor()
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
    if (t.id == null) return
    const next = await todoRepo.toggleComplete(t.id).catch(() => void toast('바꾸지 못했어요', 'error'))
    if (next) toast(`다음 할 일을 ${formatDateLabel(next)}에 만들었어요`)
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
          // 달력이 한 화면을 꽉 채우게: 위 머리 줄과 아래 추가 버튼·메뉴를 뺀 높이 (사용자 요청 2026-11-13)
          className="card flex min-h-[calc(100dvh-15.5rem-env(safe-area-inset-bottom))] flex-col -mx-3 overflow-hidden px-1 pt-2 pb-1 sm:mx-0 sm:p-4 md:min-h-[calc(100dvh-10rem)]"
          aria-label={`${y}년 ${m}월 캘린더`}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={onTouchEnd}
        >
          <div className="mb-1 flex items-center gap-1 px-2 pt-1">
            <h1 className="flex-1 text-[26px] whitespace-nowrap font-extrabold tracking-tight">
              {m}월 {/* 폰은 버튼이 많아 올해면 연도를 뺀다 */}
              <span className={`text-base font-semibold text-slate-400 ${y === Number(today.slice(0, 4)) ? 'hidden sm:inline' : ''}`}>{y}</span>
            </h1>
            <button
              type="button"
              // 금액은 칸이 좁아 넘쳐서, 가계부의 금액 전용 달력으로 보낸다 (사용자 요청 2026-11-10)
              onClick={() => navigate('/money', { state: { view: 'calendar', date: selected } })}
              className="mr-1 flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500"
              title="금액 달력 열기 (가계부)"
              aria-label="금액 달력"
            >
              <Wallet className="size-3.5" aria-hidden />
              금액
              {/* 폰은 칸이 좁아 '달력'을 뺀다 */}
              <span className="hidden sm:inline">달력</span>
            </button>
            <button
              type="button"
              onClick={toggleDiaryView}
              aria-pressed={diaryView}
              aria-label="일기 달력"
              className={`mr-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${diaryView ? 'bg-pink-100 text-pink-600' : 'bg-slate-100 text-slate-500'}`}
              title={diaryView ? '일정 달력으로 돌아가기' : '일기 쓴 날 보기'}
            >
              <BookHeart className="size-3.5" aria-hidden />
              일기
              <span className="hidden sm:inline">달력</span>
            </button>
            {(month !== today.slice(0, 7) || selected !== today) && (
              <button type="button" onClick={() => pick(today)} className="mr-1 shrink-0 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
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

          {diaryView && <DiaryMonth grid={grid} month={month} today={today} selected={selected} diaries={diaries} onPick={pick} onOpen={setViewing} />}
          <div role="grid" className={`flex flex-1 flex-col gap-[3px] ${diaryView ? 'hidden' : ''}`}>
            {weeks.map((week) => (
              <div
                key={week.days[0]}
                role="row"
                // 줄마다 높이가 글자 길이에 맞게 늘어난다 (일정 이름이 세 줄까지 보이게, 사용자 요청 2026-11-13)
                className="grid min-h-[96px] flex-[1_0_auto] grid-cols-7 gap-x-[3px] sm:min-h-[110px]"
                style={{ gridTemplateRows: `28px repeat(${week.lanes}, auto) minmax(26px, 1fr)` }}
              >
                {week.days.map((d, c) => {
                  const inMonth = d.slice(0, 7) === month
                  const isSel = d === selected
                  const isToday = d === today
                  const diary = diaries.get(d)
                  const holiday = holidays.get(d)
                  const sticker = stickers.get(d)
                  return (
                    <div
                      key={d}
                      role="gridcell"
                      tabIndex={0}
                      aria-selected={isSel}
                      aria-label={`${dayTitle(d)}${isToday ? ', 오늘' : ''}${holiday ? `, ${holiday.map((h) => h.name).join(', ')}` : ''}${diary ? ', 일기 있음' : ''}`}
                      onClick={() => tapDay(d)}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tapDay(d))}
                      onDoubleClick={() => {
                        pick(d)
                        setDayOpen(null)
                        setEditor({ mode: 'add' })
                      }}
                      style={{ gridColumn: c + 1, gridRow: '1 / -1' }}
                      className={`relative flex cursor-pointer flex-col items-center overflow-hidden rounded-md pt-1 transition-colors select-none ${
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
                              ? holiday || c === 0
                                ? 'text-red-200'
                                : 'text-slate-300'
                              : holiday || c === 0
                                ? 'text-red-500'
                                : c === 6
                                  ? 'text-sky-500'
                                  : 'text-slate-700'
                        }`}
                      >
                        {Number(d.slice(8))}
                      </span>
                      {week.hidden[c] > 0 && <span className="absolute bottom-1 left-1 text-[10px] leading-none font-semibold text-slate-400">+{week.hidden[c]}</span>}
                      <span className="relative mt-auto mb-1 flex h-[26px] items-end justify-center">
                        {sticker ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              pick(d)
                              setStickerFor(d)
                            }}
                            className="text-[22px] leading-none sm:text-[26px]"
                            aria-label={`${dayTitle(d)} 스티커 ${sticker.emoji} 바꾸기`}
                          >
                            {sticker.emoji}
                          </button>
                        ) : isSel ? (
                          // 고른 날에만 스티커 붙이기 버튼 (스크린샷의 웃는 얼굴)
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setStickerFor(stickerFor === d ? null : d)
                            }}
                            className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200/70"
                            aria-label={`${dayTitle(d)}에 스티커 붙이기`}
                            aria-expanded={stickerFor === d}
                          >
                            <SmilePlus className="size-5" aria-hidden />
                          </button>
                        ) : null}
                      </span>
                    </div>
                  )
                })}
                {week.bars.map((bar) => (
                  <BarView key={bar.key} bar={bar} dim={bar.kind === 'todo' ? bar.todo?.dueDate?.slice(0, 7) !== month : bar.kind === 'holiday' ? bar.holiday!.date.slice(0, 7) !== month : false} />
                ))}
              </div>
            ))}
          </div>

          {/* 스티커 고르기: 달력 아래에 이모티콘이 나온다 (사용자 요청 2026-11-13) */}
          {stickerFor && !diaryView && (
            <StickerPanel
              date={stickerFor}
              current={stickers.get(stickerFor)?.emoji}
              onPick={(emoji) => {
                stickerRepo
                  .set(stickerFor, emoji)
                  .then(() => setStickerFor(null))
                  .catch(() => toast('붙이지 못했어요. 다시 시도해 주세요', 'error'))
              }}
              onClose={() => setStickerFor(null)}
            />
          )}
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
            onClick={() => (selDiary ? setViewing(selDiary) : navigate('/diary', { state: { date: selected } }))}
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
                {selDiary ? selDiary.text || (selDiary.photo ? '사진만 있어요' : '파일만 있어요') : selected <= today ? '이날 한 일을 남겨 보세요' : '그날이 되면 쓸 수 있어요'}
              </span>
            </span>
            <ChevronRight className="size-4 text-slate-300" aria-hidden />
          </button>
          <DayItems
            holidays={selHolidays}
            events={selEvents}
            todos={selTodos}
            today={today}
            googleCals={googleCals}
            onEvent={openEvent}
            onTodo={(t) => setEditor({ mode: 'todo', item: t })}
            onToggle={toggle}
            empty={
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                아직 비어 있어요.
                <br />
                아래 버튼이나 날짜를 한 번 더 눌러 추가해요.
              </p>
            }
          />
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
        title={
          editor?.mode === 'event'
            ? '일정 수정'
            : editor?.mode === 'todo'
              ? '할 일 수정'
              : editor?.draft
                ? `AI가 찾은 일정${queue.length > 1 ? ` (${queue.length}개 남음)` : ''}`
                : `${dayTitle(selected)}에 추가`
        }
        onClose={closeEditor}
      >
        {editor?.mode === 'todo' ? (
          <TodoForm key={editor.item.id} initial={editor.item} onSubmit={saveTodo} onDelete={() => setDeleting(editor.item)} />
        ) : editor ? (
          <CalendarAddForm
            key={editor.mode === 'event' ? `e${editor.item.id}` : editor.draft ? `draft-${queue.length}` : `new-${selected}`}
            date={selected}
            today={today}
            initial={editor.mode === 'event' ? editor.item : undefined}
            draft={editor.mode === 'add' ? editor.draft : undefined}
            initialFiles={editor.mode === 'add' ? editor.files : undefined}
            onSaveEvent={saveEvent}
            onSaveTodo={saveTodo}
            onDelete={editor.mode === 'event' ? () => setDeleting(editor.item) : undefined}
          />
        ) : null}
      </Modal>

      {/* 날짜 팝업: 누르면 그날 일정이 바로 뜬다 */}
      <Modal open={dayOpen !== null && editor === null && googleItem === null} title={dayOpen ? dayTitle(dayOpen) : ''} onClose={() => setDayOpen(null)}>
        {dayOpen && (
          <DayPopup
            date={dayOpen}
            holidays={holidays.get(dayOpen) ?? []}
            events={(events ?? []).filter((e) => eventCovers(e, dayOpen)).sort((a, b) => eventDays(b) - eventDays(a))}
            todos={todosOn(todos ?? [], dayOpen)}
            today={today}
            googleCals={googleCals}
            sticker={stickers.get(dayOpen)?.emoji}
            onEvent={openEvent}
            onTodo={(t) => setEditor({ mode: 'todo', item: t })}
            onToggle={toggle}
            onSticker={() => {
              setStickerFor(dayOpen)
              setDayOpen(null)
            }}
            onAdd={() => {
              setDayOpen(null)
              setEditor({ mode: 'add' })
            }}
          />
        )}
      </Modal>

      <Modal open={googleItem !== null} title={googleItem?.title ?? ''} onClose={() => setGoogleItem(null)}>
        {googleItem && (
          <div className="space-y-2 text-sm text-slate-700">
            <p>{googleItem.startDate === googleItem.endDate ? dayTitle(googleItem.startDate) : `${shortDate(googleItem.startDate)} ~ ${shortDate(googleItem.endDate)} · ${eventDays(googleItem)}일`}</p>
            {googleItem.memo && <p className="text-slate-500">{googleItem.memo}</p>}
            <p className="rounded-2xl bg-blue-50 px-3 py-2.5 text-xs break-keep text-blue-700">구글 캘린더{calOf(googleItem, googleCals) ? ` "${calOf(googleItem, googleCals)?.name}"` : ''}에서 가져온 일정이에요. 바꾸려면 구글 캘린더에서 고쳐 주세요. 다음에 가져올 때 같이 바뀌어요.</p>
          </div>
        )}
      </Modal>

      <Modal open={viewing !== null} title={viewing ? `${dayTitle(viewing.date)} 일기` : ''} onClose={() => setViewing(null)}>
        {viewing && (
          <DiaryViewer
            diary={diaries.get(viewing.date) ?? viewing}
            onEdit={() => navigate('/diary', { state: { date: viewing.date } })}
            onCover={(src) =>
              diaryRepo
                .setCover(viewing.date, src)
                .then(() => toast('대표 사진으로 정했어요'))
                .catch(() => toast('바꾸지 못했어요. 다시 시도해 주세요', 'error'))
            }
          />
        )}
      </Modal>

      <DropOverlay show={dragging} label={`${dayTitle(selected)} 일정에 첨부해요`} />

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

const DIARY_VIEW_KEY = 'tidy.calendar.diaryView'
function readDiaryView(): boolean {
  try {
    return localStorage.getItem(DIARY_VIEW_KEY) === '1'
  } catch {
    return false
  }
}


/** 막대 하나. 날짜 숫자 아래 줄(lane)에 놓이고, 이름이 길면 세 줄까지 줄바꿈한다 */
function BarView({ bar, dim }: { bar: Bar; dim: boolean }) {
  const style = { gridColumn: `${bar.col + 1} / span ${bar.span}`, gridRow: bar.lane + 2 }
  const round = `${bar.fromPrev ? 'rounded-l-none' : 'rounded-l-[3px]'} ${bar.toNext ? 'rounded-r-none' : 'rounded-r-[3px]'}`
  const text = 'line-clamp-3 break-all text-[11px] leading-[13px] sm:text-xs sm:leading-[15px]'
  if (bar.kind === 'todo') {
    const done = bar.todo?.isCompleted === 1
    return (
      <div
        className={`pointer-events-none relative mx-0.5 mb-[2px] flex items-start gap-0.5 overflow-hidden rounded-[3px] bg-white py-[2px] pr-0.5 pl-[3px] font-medium text-slate-700 shadow-[inset_0_0_0_1px_var(--color-slate-200)] ${dim ? 'opacity-50' : ''}`}
        style={style}
        aria-hidden
      >
        <span className={`mt-[3px] size-[7px] shrink-0 rounded-full ${done ? 'bg-slate-300' : 'bg-brand-500'}`} />
        <span className={`${text} ${done ? 'text-slate-400 line-through' : ''}`}>{bar.title}</span>
      </div>
    )
  }
  const bg = bar.kind === 'holiday' ? HOLIDAY_COLOR : eventBg(bar.event?.color)
  const fg = bar.kind === 'holiday' ? '#ffffff' : eventFg(bar.event?.color)
  return (
    <div
      className={`pointer-events-none relative mb-[2px] overflow-hidden px-[3px] py-[2px] font-semibold ${bar.fromPrev ? '' : 'ml-0.5'} ${bar.toNext ? '' : 'mr-0.5'} ${round} ${bar.span > 1 ? 'text-center' : ''} ${dim ? 'opacity-50' : ''}`}
      style={{ ...style, background: bg, color: fg }}
      aria-hidden
    >
      <span className={text}>{bar.title}</span>
    </div>
  )
}

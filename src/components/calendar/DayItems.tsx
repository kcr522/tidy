import { Check, Paperclip } from 'lucide-react'
import type { CalendarEvent, Todo } from '../../db/types'
import { eventBg, eventDays, shortDate } from '../../lib/eventLayout'
import { HOLIDAY_COLOR, type Holiday } from '../../lib/holidays'
import { calOf, type GoogleCal } from '../../platform/googleCalendar'

interface Props {
  holidays: Holiday[]
  events: CalendarEvent[]
  todos: Todo[]
  today: string
  googleCals: GoogleCal[]
  onEvent: (e: CalendarEvent) => void
  onTodo: (t: Todo) => void
  onToggle: (t: Todo) => void
  /** 팝업: 제목과 메모를 자르지 않고 다 보여 준다 */
  full?: boolean
  /** 아무것도 없을 때 문구 */
  empty: React.ReactNode
  className?: string
}

/** 그날 공휴일·일정·할 일 목록 (캘린더 아래 목록과 날짜 팝업이 같이 쓴다) */
export default function DayItems({ holidays, events, todos, today, googleCals, onEvent, onTodo, onToggle, full, empty, className = '' }: Props) {
  if (holidays.length === 0 && events.length === 0 && todos.length === 0) return <>{empty}</>
  const clip = full ? 'break-words whitespace-pre-wrap' : 'truncate'
  return (
    <ul className={`divide-y divide-slate-100 ${className}`}>
      {holidays.map((h) => (
        <li key={`h${h.name}`} className="flex items-center gap-3 px-4 py-3">
          <span className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: HOLIDAY_COLOR }} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-red-500">{h.name}</span>
            <span className="block text-xs text-slate-400">{h.substitute ? `${h.substitute} 대신 쉬는 날` : '공휴일 · 쉬는 날'}</span>
          </span>
        </li>
      ))}
      {events.map((e) => (
        <li key={`e${e.id}`}>
          <button type="button" onClick={() => onEvent(e)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
            <span className={`w-1.5 shrink-0 self-stretch rounded-full ${full ? 'min-h-9' : 'h-9 self-center'}`} style={{ background: eventBg(e.color) }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={`block text-[15px] font-semibold ${clip}`}>{e.title}</span>
              <span className={`block text-xs text-slate-400 ${full ? '' : 'truncate'}`}>
                {e.source === 'google' && (
                  <span className="mr-1 rounded px-1 py-px text-[10px] font-bold text-white" style={{ background: eventBg(e.color) }}>
                    {calOf(e, googleCals)?.name ?? '구글'}
                  </span>
                )}
                {e.startDate === e.endDate ? '하루 일정' : `${shortDate(e.startDate)} ~ ${shortDate(e.endDate)} · ${eventDays(e)}일`}
                {!full && e.memo && ` · ${e.memo}`}
                {!!e.attachments?.length && (
                  <span className="ml-1 inline-flex items-center gap-0.5 align-[-2px]">
                    · <Paperclip className="size-3" aria-label="첨부" />
                    {e.attachments.length}
                  </span>
                )}
              </span>
              {full && e.memo && <span className="mt-1 block rounded-xl bg-slate-50 px-2.5 py-1.5 text-[13px] break-words whitespace-pre-wrap text-slate-600">{e.memo}</span>}
            </span>
          </button>
        </li>
      ))}
      {todos.map((t) => (
        <li key={`t${t.id}`} className="flex items-center">
          <button type="button" role="checkbox" aria-checked={t.isCompleted === 1} aria-label={`${t.title} 완료`} onClick={() => onToggle(t)} className="flex min-h-12 items-center px-4">
            <span className={`flex size-6 items-center justify-center rounded-full ${t.isCompleted ? 'bg-grad on-grad' : 'border-2 border-slate-300'}`}>
              {t.isCompleted === 1 && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
            </span>
          </button>
          <button type="button" onClick={() => onTodo(t)} className="min-w-0 flex-1 py-3 pr-4 text-left">
            <span className={`block text-[15px] ${clip} ${t.isCompleted ? 'text-slate-400 line-through' : 'font-medium'}`}>{t.title}</span>
            <span className="block text-xs text-slate-400">할 일 · {t.dueDate === today ? '오늘' : t.dueDate! < today ? '지난 날' : '나중'}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

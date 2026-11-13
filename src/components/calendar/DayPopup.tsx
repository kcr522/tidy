import { Plus, SmilePlus } from 'lucide-react'
import type { CalendarEvent, Todo } from '../../db/types'
import type { Holiday } from '../../lib/holidays'
import type { GoogleCal } from '../../platform/googleCalendar'
import DayItems from './DayItems'

interface Props {
  date: string
  holidays: Holiday[]
  events: CalendarEvent[]
  todos: Todo[]
  today: string
  googleCals: GoogleCal[]
  sticker?: string
  onEvent: (e: CalendarEvent) => void
  onTodo: (t: Todo) => void
  onToggle: (t: Todo) => void
  onSticker: () => void
  onAdd: () => void
}

/** 날짜를 누르면 뜨는 창: 그날 공휴일·일정·할 일을 자르지 않고 다 보여 준다 */
export default function DayPopup({ date, holidays, events, todos, today, googleCals, sticker, onEvent, onTodo, onToggle, onSticker, onAdd }: Props) {
  const [, m, d] = date.split('-').map(Number)
  return (
    <div>
      <DayItems
        holidays={holidays}
        events={events}
        todos={todos}
        today={today}
        googleCals={googleCals}
        onEvent={onEvent}
        onTodo={onTodo}
        onToggle={onToggle}
        full
        className="-mx-5 -mt-2 md:-mx-6"
        empty={<p className="py-6 text-center text-sm text-slate-500">이날은 비어 있어요</p>}
      />
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={onSticker} className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-slate-100 px-4 text-sm font-bold text-slate-600">
          {sticker ? <span className="text-lg leading-none">{sticker}</span> : <SmilePlus className="size-4" aria-hidden />}
          스티커
        </button>
        <button type="button" onClick={onAdd} className="bg-grad on-grad flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold">
          <Plus className="size-4" strokeWidth={2.6} aria-hidden />
          {m}월 {d}일에 추가
        </button>
      </div>
    </div>
  )
}

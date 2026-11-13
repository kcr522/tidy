import { CalendarRange, ListChecks } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Attachment, CalendarEvent, EventColor } from '../../db/types'
import { dayTitle } from '../../lib/calendar'
import { eventDays } from '../../lib/eventLayout'
import EventColorPicker from './EventColorPicker'
import { MAX_TITLE_LENGTH, validateMemo, validateTitle } from '../../lib/validate'
import type { EventInput } from '../../repositories/eventRepo'
import type { TodoInput } from '../../repositories/todoRepo'
import AttachmentField from '../common/AttachmentField'
import Button from '../common/Button'
import Field from '../common/FormField'
import { inputClass } from '../common/formStyles'

type Kind = 'event' | 'todo'
/** 할 일을 언제로: 오늘 / 고른 날 / 날짜 없이 나중에 */
type When = 'today' | 'day' | 'later'

interface Props {
  /** 캘린더에서 고른 날 */
  date: string
  today: string
  /** 수정할 일정 (있으면 일정 수정 모드) */
  initial?: CalendarEvent
  /** 새 일정에 채워 둘 값 (AI 대화창의 "내가 등록할게") */
  draft?: EventInput
  /** 캘린더 화면에 끌어다 놓은 파일 (새 일정에 붙여 둔다) */
  initialFiles?: Attachment[]
  onSaveEvent: (input: EventInput) => Promise<void>
  onSaveTodo: (input: TodoInput) => Promise<void>
  onDelete?: () => void
}

/** 캘린더에서 "추가": 일정(기간)과 할 일을 한 곳에서 쓴다 */
export default function CalendarAddForm({ date, today, initial, draft, initialFiles, onSaveEvent, onSaveTodo, onDelete }: Props) {
  const [kind, setKind] = useState<Kind>('event')
  const base = initial ?? draft
  const [title, setTitle] = useState(base?.title ?? '')
  const [start, setStart] = useState(base?.startDate ?? date)
  const [end, setEnd] = useState(base?.endDate ?? date)
  const [color, setColor] = useState<EventColor>(base?.color ?? 'pink')
  const [memo, setMemo] = useState(base?.memo ?? '')
  const [files, setFiles] = useState<Attachment[]>(base?.attachments ?? initialFiles ?? [])
  const [when, setWhen] = useState<When>(date > today ? 'day' : 'today')
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  const isEvent = kind === 'event' || !!initial
  const days = start && end && end >= start ? eventDays({ startDate: start, endDate: end }) : 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    const t = validateTitle(title, isEvent ? '일정 이름을 입력해 주세요' : '할 일을 입력해 주세요')
    if (!t.ok) return setError(t.error)
    setError(undefined)
    setSaving(true)
    try {
      if (isEvent) {
        if (!start || !end) return setError('날짜를 골라 주세요')
        if (end < start) return setError('끝나는 날이 시작하는 날보다 앞이에요')
        const m = validateMemo(memo)
        await onSaveEvent({ title: t.value, startDate: start, endDate: end, color, memo: m.ok ? m.value : '', attachments: files })
      } else {
        const dueDate = when === 'today' ? today : when === 'day' ? date : null
        await onSaveTodo({ title: t.value, dueDate, priority: 'MEDIUM' })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {!initial && !draft && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="무엇을 추가할까요">
          {(
            [
              ['event', '일정', CalendarRange],
              ['todo', '할 일', ListChecks],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                setError(undefined)
              }}
              className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-sm font-bold ${kind === k ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      <Field label={`${isEvent ? '일정' : '할 일'} (${title.length}/${MAX_TITLE_LENGTH})`} error={error}>
        <input
          value={title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder={isEvent ? '예: 청년 적금 가입 기간' : '예: 열차 예매하기'}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass(!!error)}
          aria-invalid={!!error}
          autoFocus={!initial}
        />
      </Field>

      {isEvent ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="시작">
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  setStart(e.target.value)
                  if (e.target.value > end) setEnd(e.target.value)
                }}
                className={inputClass()}
              />
            </Field>
            <Field label="끝">
              <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className={inputClass()} />
            </Field>
          </div>
          <p className="-mt-2 text-xs text-slate-500">
            {days > 1 ? `${days}일 동안 캘린더에 길게 표시돼요` : '하루 일정이에요. 끝 날짜를 바꾸면 여러 날로 길게 표시돼요'}
          </p>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-600">색</span>
            <EventColorPicker value={color} onChange={setColor} label="일정 색" />
          </div>

          <Field label="메모 (선택)">
            <input value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} placeholder="장소나 준비물" className={inputClass()} />
          </Field>
          <AttachmentField value={files} onChange={setFiles} acceptDrop />
        </>
      ) : (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">언제 할까요?</span>
          <div className={`grid gap-1 rounded-2xl bg-slate-100 p-1 ${date > today ? 'grid-cols-3' : 'grid-cols-2'}`} role="radiogroup" aria-label="언제 할까요">
            {(
              [
                ['today', '오늘'],
                ...(date > today ? ([['day', dayTitle(date).replace(/ \(.\)$/, '')]] as const) : []),
                ['later', '나중에'],
              ] as [When, string][]
            ).map(([w, label]) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={when === w}
                onClick={() => setWhen(w)}
                className={`min-h-11 rounded-xl text-sm font-semibold ${when === w ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">
            {when === 'today' ? "할 일 탭의 '오늘'에 보여요" : when === 'day' ? "그날 캘린더에 보이고, 할 일 탭의 '나중'에 보여요" : "날짜 없이 할 일 탭의 '나중'에 보여요"}
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-2">
        {onDelete && (
          <Button variant="secondary" className="text-expense" onClick={onDelete}>
            삭제
          </Button>
        )}
        <Button type="submit" className="flex-1" disabled={saving}>
          {saving ? '저장 중…' : '저장'}
        </Button>
      </div>
    </form>
  )
}

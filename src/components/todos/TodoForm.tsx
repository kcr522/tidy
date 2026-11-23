import { useLiveQuery } from 'dexie-react-hooks'
import { Bell, BellOff, NotebookPen, Repeat } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { Attachment, Priority, Todo, TodoRepeat } from '../../db/types'
import { parseDateKey, todayKey } from '../../lib/date'
import { repeatLabel, WEEK_ORDER, WEEKDAY_SHORT } from '../../lib/todoRepeat'
import { timeLabel } from '../../lib/todoAlarms'
import { MAX_TITLE_LENGTH, MAX_TODO_MEMO_LENGTH, validateTitle } from '../../lib/validate'
import { requestAlarmPermission } from '../../platform/alarms'
import { todoCategoryRepo } from '../../repositories/todoCategoryRepo'
import type { TodoInput } from '../../repositories/todoRepo'
import AttachmentField from '../common/AttachmentField'
import Button from '../common/Button'
import Field from '../common/FormField'
import HandwriteButton, { appendHandwritten } from '../common/HandwriteButton'
import { inputClass } from '../common/formStyles'
import { CATEGORY_HEX } from './categoryColors'
import { PRIORITY_LABEL } from './priority'

interface TodoFormProps {
  initial?: Todo
  /** 새로 추가할 때 마감일 기본값 */
  defaultDueDate?: string | null
  /** 새로 추가할 때 카테고리 기본값 (할 일 캘린더의 카테고리 + 버튼) */
  defaultCategoryId?: number
  onSubmit: (input: TodoInput) => Promise<void>
  onDelete?: () => void
}

/** 자주 쓰는 알림 시간 */
const REMIND_PRESETS = ['09:00', '13:00', '18:00', '21:00']

/** 할 일 입력 폼 (FR-020) */
export default function TodoForm({ initial, defaultDueDate = null, defaultCategoryId, onSubmit, onDelete }: TodoFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [dueDate, setDueDate] = useState(initial ? (initial.dueDate ?? '') : (defaultDueDate ?? ''))
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'MEDIUM')
  const [categoryId, setCategoryId] = useState<number | undefined>(initial ? initial.categoryId : defaultCategoryId)
  const [remindAt, setRemindAt] = useState(initial?.remindAt ?? '')
  const [repeat, setRepeat] = useState<TodoRepeat | undefined>(initial?.repeat)
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [files, setFiles] = useState<Attachment[]>(initial?.attachments ?? [])
  const [permNote, setPermNote] = useState<string>()
  const categories = useLiveQuery(() => todoCategoryRepo.list(), [])
  const [error, setError] = useState<string>()
  const [saving, setSaving] = useState(false)

  /** 알림 시간을 고르면 알림 허용을 묻는다 */
  async function pickRemind(t: string) {
    setRemindAt(t)
    if (!t) return setPermNote(undefined)
    const p = await requestAlarmPermission().catch(() => 'unsupported' as const)
    setPermNote(
      p === 'granted'
        ? undefined
        : p === 'unsupported'
          ? '이 브라우저는 알림을 못 띄워서, 앱이 열려 있을 때 화면 안에서만 알려 줘요'
          : '알림이 꺼져 있어요. 휴대폰 설정에서 Tidy 알림을 켜야 울려요',
    )
  }

  /** 반복 종류 고르기. 마감일이 없으면 오늘로 정한다 (반복은 마감일부터 센다) */
  function pickRepeat(every: TodoRepeat['every'] | null) {
    if (every === null) return setRepeat(undefined)
    const due = dueDate || (defaultDueDate ?? todayKey())
    if (!dueDate) setDueDate(due)
    const d = parseDateKey(due)
    setRepeat(every === 'day' ? { every } : every === 'week' ? { every, days: [d.getDay()] } : { every, day: d.getDate() })
  }

  /** 매주 요일 켜고 끄기 (하나는 남긴다) */
  function toggleDay(day: number) {
    if (repeat?.every !== 'week') return
    const days = repeat.days.includes(day) ? repeat.days.filter((x) => x !== day) : [...repeat.days, day]
    if (days.length > 0) setRepeat({ every: 'week', days })
  }

  /** 마감일을 바꾸면 매달 반복 날짜도 따라간다 */
  function changeDueDate(v: string) {
    setDueDate(v)
    if (!v) setRepeat(undefined)
    else if (repeat?.every === 'month') setRepeat({ every: 'month', day: parseDateKey(v).getDate() })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = validateTitle(title, '할 일을 입력해 주세요')
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(undefined)
    setSaving(true)
    try {
      await onSubmit({ title: result.value, dueDate: dueDate || null, priority, categoryId, remindAt: dueDate && remindAt ? remindAt : undefined, repeat: dueDate ? repeat : undefined, memo: memo.trim() || undefined, attachments: files })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <Field label={`할 일 (${title.length}/${MAX_TITLE_LENGTH})`} error={error}>
        <div className="flex gap-2">
          <input
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            placeholder="예: 주간 업무 보고서 작성"
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass(!!error)}
            aria-invalid={!!error}
            autoFocus={!initial}
          />
          <HandwriteButton compact label="할 일" className="self-center" onText={(t) => setTitle((old) => appendHandwritten(old, t, false, MAX_TITLE_LENGTH))} />
        </div>
      </Field>

      <div>
        <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
          <NotebookPen className="size-4" aria-hidden /> 메모 · 참고 (선택)
        </span>
        <div className="flex gap-2">
          <textarea
            value={memo}
            maxLength={MAX_TODO_MEMO_LENGTH}
            rows={2}
            placeholder="예: 3쪽 표 먼저 정리, 참고 링크나 준비물"
            onChange={(e) => setMemo(e.target.value)}
            className={`${inputClass()} min-h-[4.5rem] resize-y py-2.5 leading-relaxed`}
            aria-label="메모 · 참고 글"
          />
          <HandwriteButton compact label="메모" className="self-start" onText={(t) => setMemo((old) => appendHandwritten(old, t, true, MAX_TODO_MEMO_LENGTH))} />
        </div>
        <div className="mt-2">
          <AttachmentField value={files} onChange={setFiles} acceptDrop addLabel="참고 사진 · 파일 넣기" />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">목록에서 할 일 아래에 작게 보여요</p>
      </div>

      <Field label="마감일 (선택)">
        <div className="flex gap-2">
          <input type="date" value={dueDate} onChange={(e) => changeDueDate(e.target.value)} className={inputClass()} />
          {dueDate && (
            <Button variant="ghost" className="shrink-0 whitespace-nowrap" onClick={() => changeDueDate('')}>
              지우기
            </Button>
          )}
        </div>
      </Field>

      <div>
        <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
          <Repeat className="size-4" aria-hidden /> 반복 (선택)
        </span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="반복">
          {([
            [null, '안 함'],
            ['day', '매일'],
            ['week', '매주'],
            ['month', '매달'],
          ] as const).map(([every, label]) => {
            const on = (repeat?.every ?? null) === every
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => pickRepeat(every)}
                className={`min-h-10 rounded-full px-3.5 text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
              >
                {label}
              </button>
            )
          })}
        </div>
        {repeat?.every === 'week' && (
          <div className="mt-2 flex gap-1" role="group" aria-label="반복할 요일">
            {WEEK_ORDER.map((d) => {
              const on = repeat.days.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={`size-10 rounded-full text-sm font-bold transition ${on ? 'bg-grad on-grad' : `bg-slate-100 ${d === 0 ? 'text-expense' : 'text-slate-500'}`}`}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              )
            })}
          </div>
        )}
        <p className="mt-1.5 text-xs text-slate-500">
          {repeat ? `${repeatLabel(repeat)} 반복해요. 끝내면 다음 할 일이 저절로 생겨요` : '매일, 매주, 매달 하는 일이면 골라 주세요'}
        </p>
      </div>

      <div>
        <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
          <Bell className="size-4" aria-hidden /> 알림 (선택)
        </span>
        {dueDate ? (
          <>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="알림 시간 빨리 고르기">
              {REMIND_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={remindAt === t}
                  onClick={() => void pickRemind(remindAt === t ? '' : t)}
                  className={`min-h-10 rounded-full px-3.5 text-sm font-semibold transition ${remindAt === t ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  {timeLabel(t)}
                </button>
              ))}
              <input
                type="time"
                value={remindAt}
                onChange={(e) => void pickRemind(e.target.value)}
                className="min-h-10 rounded-full border-0 bg-slate-100 px-3 text-sm text-slate-900 outline-none focus:bg-white focus:ring-2 focus:ring-brand-500"
                aria-label="알림 시간 직접 고르기"
              />
              {remindAt && (
                <button type="button" onClick={() => void pickRemind('')} className="flex min-h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-slate-500" aria-label="알림 끄기">
                  <BellOff className="size-4" aria-hidden /> 끄기
                </button>
              )}
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {permNote ?? (remindAt ? `마감일 ${timeLabel(remindAt)}에 알려 줘요. 끝내면 울리지 않아요` : '시간을 고르면 그 시간에 알림이 울려요')}
            </p>
          </>
        ) : (
          <p className="text-xs text-slate-400">마감일을 정하면 알림 시간을 고를 수 있어요</p>
        )}
      </div>

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">중요도</span>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="중요도">
          {(['HIGH', 'MEDIUM', 'LOW'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              onClick={() => setPriority(p)}
              className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${
                priority === p ? `bg-white shadow-card ${PRIORITY_LABEL[p].text}` : 'text-slate-500'
              }`}
            >
              {PRIORITY_LABEL[p].label}
            </button>
          ))}
        </div>
      </div>

      {categories && categories.length > 0 && (
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-600">카테고리</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="카테고리">
            {[{ id: undefined, name: '기본', hex: undefined as string | undefined }, ...categories.map((c) => ({ id: c.id, name: c.name, hex: CATEGORY_HEX[c.color] as string | undefined }))].map((c) => {
              const on = categoryId === c.id
              return (
                <button
                  key={c.id ?? 'base'}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setCategoryId(c.id)}
                  className={`flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}
                >
                  <span className="size-2 rounded-full" style={{ backgroundColor: c.hex ?? 'var(--color-slate-400)' }} aria-hidden />
                  {c.name}
                </button>
              )
            })}
          </div>
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

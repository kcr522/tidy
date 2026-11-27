import { addMonths, format, getDaysInMonth } from 'date-fns'
import { Minus, Plus, Repeat } from 'lucide-react'
import type { TodoRepeat } from '../../db/types'
import { parseDateKey } from '../../lib/date'
import { LAST, MAX_INTERVAL, MAX_LEFT, monthDayLabel, nthOf, repeatEndLabel, repeatLabel, upcomingDates, WEEK_ORDER, WEEKDAY_SHORT } from '../../lib/todoRepeat'
import { inputClass } from '../common/formStyles'

type Every = TodoRepeat['every']
type End = 'never' | 'until' | 'count'

const KINDS: [Every | null, string][] = [
  [null, '안 함'],
  ['day', '매일'],
  ['week', '매주'],
  ['month', '매달'],
  ['year', '매년'],
]
const UNIT: Record<Every, string> = { day: '일', week: '주', month: '달', year: '년' }
/** 미리보기로 보여 줄 날짜 수 */
const PREVIEW = 4
/** 횟수로 끝내기를 처음 고르면 */
const DEFAULT_LEFT = 5
/** 날짜까지를 처음 고르면 마감일에서 몇 달 뒤 */
const UNTIL_MONTHS = 3

interface RepeatPickerProps {
  value: TodoRepeat | undefined
  /** 반복을 세는 마감일. 반복을 고르면 폼이 먼저 채운다 */
  dueDate: string
  onPick: (every: Every | null) => void
  onChange: (r: TodoRepeat) => void
}

const chip = (on: boolean) => `min-h-10 rounded-full px-3.5 text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`
const smallChip = (on: boolean) => `min-h-9 rounded-full px-3 text-[13px] font-semibold transition ${on ? 'bg-grad on-grad' : 'bg-white text-slate-600 ring-1 ring-slate-200'}`

function shortDate(key: string) {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAY_SHORT[d.getDay()]})`
}

/** 마감일에서 고를 수 있는 '매달' 모양: 그 날짜, 말일, 몇째 주 요일 */
function monthOptions(due: Date): Extract<TodoRepeat, { every: 'month' }>[] {
  const day = due.getDate()
  const opts: Extract<TodoRepeat, { every: 'month' }>[] = [{ every: 'month', day }]
  if (day < 31) opts.push({ every: 'month', day: LAST })
  const nth = nthOf(due)
  opts.push({ every: 'month', ...nth })
  // 넷째 주이면서 마지막 주인 날(예: 11월 27일 금요일)은 '마지막 금요일'도 고를 수 있게
  if (nth.nth !== LAST && due.getDate() + 7 > getDaysInMonth(due)) opts.push({ every: 'month', nth: LAST, weekday: nth.weekday })
  return opts
}

/** 몇 번째마다 · 끝은 두고 모양(요일 · 날짜)만 바꾼다 */
function withShape(r: TodoRepeat, shape: TodoRepeat): TodoRepeat {
  const { interval, start, until, left } = r
  return { ...shape, ...(interval && { interval }), ...(start && { start }), ...(until && { until }), ...(left != null && { left }) }
}

const sameMonthShape = (a: TodoRepeat, b: TodoRepeat) => a.every === 'month' && b.every === 'month' && ('nth' in a ? 'nth' in b && a.nth === b.nth : !('nth' in b) && a.day === b.day)

/** 할 일 반복 고르기: 종류, 몇 번째마다, 요일 · 날짜, 끝나는 때, 다음 날짜 미리보기 */
export default function RepeatPicker({ value, dueDate, onPick, onChange }: RepeatPickerProps) {
  const r = value
  const n = r?.interval ?? 1
  const end: End = r?.left != null ? 'count' : r?.until ? 'until' : 'never'

  function setInterval(v: number) {
    if (!r) return
    const next = Math.min(MAX_INTERVAL, Math.max(1, v))
    onChange({ ...r, interval: next > 1 ? next : undefined })
  }

  function toggleDay(day: number) {
    if (r?.every !== 'week') return
    const days = r.days.includes(day) ? r.days.filter((x) => x !== day) : [...r.days, day]
    if (days.length > 0) onChange({ ...r, days })
  }

  function setEnd(e: End) {
    if (!r) return
    const rest = withShape({ ...r, until: undefined, left: undefined }, r)
    delete rest.until
    delete rest.left
    if (e === 'never') return onChange(rest)
    if (e === 'count') return onChange({ ...rest, left: DEFAULT_LEFT })
    // 처음엔 마감일에서 석 달 뒤까지
    onChange({ ...rest, until: format(addMonths(parseDateKey(dueDate), UNTIL_MONTHS), 'yyyy-MM-dd') })
  }

  const dates = r && dueDate ? upcomingDates(r, dueDate, PREVIEW + 1) : []

  return (
    <div>
      <span className="mb-1 flex items-center gap-1 text-sm font-medium text-slate-600">
        <Repeat className="size-4" aria-hidden /> 반복 (선택)
      </span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="반복">
        {KINDS.map(([every, label]) => (
          <button key={label} type="button" role="radio" aria-checked={(r?.every ?? null) === every} onClick={() => onPick(every)} className={chip((r?.every ?? null) === every)}>
            {label}
          </button>
        ))}
      </div>

      {r && (
        <div className="mt-2 space-y-3 rounded-2xl bg-slate-50 p-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="basis-full text-xs font-semibold text-slate-500">간격</span>
            <div className="flex items-center rounded-full bg-white ring-1 ring-slate-200">
              <button type="button" aria-label="간격 줄이기" disabled={n <= 1} onClick={() => setInterval(n - 1)} className="grid size-9 place-items-center text-slate-600 disabled:opacity-30">
                <Minus className="size-4" aria-hidden />
              </button>
              <span className="min-w-[4.5rem] text-center text-sm font-bold text-slate-800" aria-live="polite">
                {n <= 1 ? `매${UNIT[r.every]}` : n === 2 && r.every === 'week' ? '격주' : `${n}${UNIT[r.every]}마다`}
              </span>
              <button type="button" aria-label="간격 늘리기" disabled={n >= MAX_INTERVAL} onClick={() => setInterval(n + 1)} className="grid size-9 place-items-center text-slate-600 disabled:opacity-30">
                <Plus className="size-4" aria-hidden />
              </button>
            </div>
            {r.every === 'week' && n === 1 && (
              <button type="button" onClick={() => setInterval(2)} className={smallChip(false)}>
                격주로
              </button>
            )}
          </div>

          {r.every === 'week' && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="basis-full text-xs font-semibold text-slate-500">요일</span>
              <div className="flex flex-wrap gap-1" role="group" aria-label="반복할 요일">
                {WEEK_ORDER.map((d) => {
                  const on = r.days.includes(d)
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(d)} className={`size-10 rounded-full text-sm font-bold transition ${on ? 'bg-grad on-grad' : `bg-white ring-1 ring-slate-200 ${d === 0 ? 'text-expense' : 'text-slate-500'}`}`}>
                      {WEEKDAY_SHORT[d]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {r.every === 'month' && dueDate && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="basis-full text-xs font-semibold text-slate-500">날짜</span>
              <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="매달 어느 날">
                {monthOptions(parseDateKey(dueDate)).map((o) => {
                  const on = sameMonthShape(r, o)
                  return (
                    <button key={monthDayLabel(o)} type="button" role="radio" aria-checked={on} onClick={() => onChange(withShape(r, o))} className={smallChip(on)}>
                      {monthDayLabel(o)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="basis-full text-xs font-semibold text-slate-500">끝</span>
            <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="반복 끝">
              {([
                ['never', '계속'],
                ['until', '날짜까지'],
                ['count', '횟수만큼'],
              ] as const).map(([e, label]) => (
                <button key={e} type="button" role="radio" aria-checked={end === e} onClick={() => setEnd(e)} className={smallChip(end === e)}>
                  {label}
                </button>
              ))}
            </div>
            {end === 'until' && (
              <input type="date" aria-label="반복 끝나는 날" value={r.until} min={dueDate} onChange={(e) => e.target.value && onChange({ ...r, until: e.target.value })} className={`${inputClass()} max-w-[11rem] py-1.5`} />
            )}
            {end === 'count' && r.left != null && (
              <div className="flex items-center rounded-full bg-white ring-1 ring-slate-200">
                <button type="button" aria-label="횟수 줄이기" disabled={r.left <= 2} onClick={() => onChange({ ...r, left: (r.left ?? 2) - 1 })} className="grid size-9 place-items-center text-slate-600 disabled:opacity-30">
                  <Minus className="size-4" aria-hidden />
                </button>
                <span className="min-w-[4rem] text-center text-sm font-bold text-slate-800">총 {r.left}번</span>
                <button type="button" aria-label="횟수 늘리기" disabled={r.left >= MAX_LEFT} onClick={() => onChange({ ...r, left: (r.left ?? 1) + 1 })} className="grid size-9 place-items-center text-slate-600 disabled:opacity-30">
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>
            )}
          </div>

          {dates.length > 0 && (
            <p className="text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-700">다가오는 날</span> {dates.map(shortDate).join(' · ')}
              {dates.length <= PREVIEW && ' (여기서 끝)'}
            </p>
          )}
        </div>
      )}

      <p className="mt-1.5 text-xs text-slate-500">
        {r ? `${repeatLabel(r)}${repeatEndLabel(r) ? ` · ${repeatEndLabel(r)}` : ''} 반복해요. 끝내면 다음 할 일이 저절로 생겨요` : '매일, 격주, 매달 말일처럼 되풀이하는 일이면 골라 주세요'}
      </p>
    </div>
  )
}

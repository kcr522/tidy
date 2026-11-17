import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Check, Circle, LayoutGrid, Lock } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { db } from '../../db/database'
import { useWidgetExtras } from '../../hooks/useWidgetSync'
import { useToday } from '../../hooks/useToday'
import { loadLock, onLockChange } from '../../lib/appLock'
import { loadWidgetOpacity, onWidgetSettingsChange, saveWidgetOpacity, WIDGET_KINDS, type WidgetKind } from '../../lib/widgetSettings'
import {
  buildWidgetSummary,
  eventWidgetView,
  habitWidgetView,
  moneyWidgetView,
  todoWidgetView,
  widgetRange,
  widgetView,
  type EventWidgetView,
  type HabitWidgetView,
  type MoneyWidgetView,
  type TodoWidgetView,
  type WidgetSummary,
  type WidgetView,
} from '../../lib/widgetSummary'
import { isNativeApp } from '../../platform/native'
import { pinWidget } from '../../platform/widget'
import { todoRepo } from '../../repositories/todoRepo'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

/** 설정 > 홈 화면 위젯: 종류 고르기, 미리보기, 투명도, 홈 화면에 추가 (갤럭시 앱) */
export default function WidgetCard() {
  const toast = useToast()
  const today = useToday()
  const native = isNativeApp()
  const [locked, setLocked] = useState(() => loadLock() !== null)
  useEffect(() => onLockChange(() => setLocked(loadLock() !== null)), [])
  const [opacity, setOpacity] = useState(loadWidgetOpacity)
  useEffect(() => onWidgetSettingsChange(() => setOpacity(loadWidgetOpacity())), [])
  const [kind, setKind] = useState<WidgetKind>('today')

  const [from, to] = widgetRange(today)
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])
  const extras = useWidgetExtras(today)
  const summary = todos && txs && extras ? buildWidgetSummary(todos, txs, today, locked, extras) : null
  const info = WIDGET_KINDS.find((k) => k.kind === kind)!

  async function add() {
    if (await pinWidget(kind)) return
    toast(`홈 화면 빈 곳을 길게 누르고 → 위젯 → Tidy → '${info.name}'을 골라 주세요`)
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <LayoutGrid className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">홈 화면 위젯</h2>
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">
        앱을 열지 않고 홈 화면에서 봐요. 위젯은 {WIDGET_KINDS.length}가지이고, 종류마다 바탕 투명도를 따로 정할 수 있어요.
        {locked && ' 앱 잠금이 켜져 있어서 제목과 금액은 숨겨요.'}
      </p>

      <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label="위젯 종류">
        {WIDGET_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            role="tab"
            aria-selected={kind === k.kind}
            onClick={() => setKind(k.kind)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${kind === k.kind ? 'bg-grad on-grad shadow-float' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {k.name}
          </button>
        ))}
      </div>

      <p className="mb-2 text-sm text-slate-600">
        <span className="font-semibold">{info.name}</span> · {info.desc} <span className="text-slate-400">({info.size} 칸)</span>
      </p>
      <Wallpaper>{summary && <KindPreview kind={kind} summary={summary} today={today} opacity={opacity[kind]} />}</Wallpaper>

      <label className="mt-4 block">
        <span className="mb-1 flex items-center justify-between text-sm">
          <span className="font-semibold">바탕 투명도</span>
          <span className="tabular-nums text-slate-500">{opacity[kind] === 100 ? '불투명' : opacity[kind] === 0 ? '완전 투명' : `${opacity[kind]}%`}</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={opacity[kind]}
          onChange={(e) => saveWidgetOpacity(kind, Number(e.target.value))}
          className="w-full accent-(--color-brand-500)"
          aria-label={`${info.name} 위젯 바탕 투명도`}
        />
        <span className="flex justify-between text-xs text-slate-400">
          <span>투명</span>
          <span>불투명</span>
        </span>
      </label>
      {native && <p className="mt-1 text-xs text-slate-400">바꾸면 홈 화면에 놓인 &apos;{info.name}&apos; 위젯에 바로 적용돼요.</p>}

      {native ? (
        <Button className="mt-4 w-full" onClick={add}>
          &apos;{info.name}&apos; 위젯 홈 화면에 추가
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-400">갤럭시 앱에서 쓸 수 있어요</p>
      )}
    </section>
  )
}

/** 투명도가 보이도록 홈 화면 배경처럼 깔아 두는 그림 */
function Wallpaper({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#7dd3fc_0%,#c4b5fd_45%,#f9a8d4_100%)] p-4 dark:bg-[linear-gradient(135deg,#0c4a6e_0%,#4c1d95_50%,#831843_100%)]">
      <div className="pointer-events-none absolute -top-8 -left-6 size-32 rounded-full bg-[#fde68a]/70 blur-sm" aria-hidden />
      <div className="pointer-events-none absolute -right-10 -bottom-10 size-40 rounded-full bg-[#34d399]/60 blur-sm" aria-hidden />
      <div className="relative flex justify-center">{children}</div>
    </div>
  )
}

function KindPreview({ kind, summary, today, opacity }: { kind: WidgetKind; summary: WidgetSummary; today: string; opacity: number }) {
  if (kind === 'todo') return <TodoWidgetPreview view={todoWidgetView(summary, today)} opacity={opacity} />
  if (kind === 'money') return <MoneyWidgetPreview view={moneyWidgetView(summary, today)} opacity={opacity} />
  if (kind === 'event') return <EventWidgetPreview view={eventWidgetView(summary, today)} opacity={opacity} />
  if (kind === 'habit') return <HabitWidgetPreview view={habitWidgetView(summary, today)} opacity={opacity} />
  return <WidgetPreview view={widgetView(summary, today)} opacity={opacity} />
}

const MUTED = 'text-[#6b7684] dark:text-[#9aa4b1]'
const STALE = '앱을 한 번 열면 새로 고쳐져요'

/** 안드로이드 위젯과 같은 모양의 틀. 바탕만 opacity를 따르고 글자는 그대로 (widget_*.xml 의 widget_bg_img) */
function Frame({ wide, opacity, label, children }: { wide?: boolean; opacity: number; label: string; children: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] text-[#191f28] dark:text-[#eef1f5] ${wide ? 'w-full max-w-sm' : 'aspect-square w-44'}`} aria-label={label}>
      <div className="absolute inset-0 bg-[#ffffff] dark:bg-[#1c1f26]" style={{ opacity: opacity / 100 }} aria-hidden />
      <div className={`relative h-full ${wide ? 'p-4' : 'p-3.5'}`}>{children}</div>
    </div>
  )
}

function Bar({ pct, over }: { pct: number; over?: boolean }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8eef5] dark:bg-[#2c313a]">
      <div className={`h-full rounded-full ${over ? 'bg-[#f04452]' : 'bg-[#1d8fe1]'}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function Header({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <p className="truncate text-[15px] font-bold">{title}</p>
      <p className="shrink-0 text-xs font-bold text-[#1d8fe1]">{right ?? 'Tidy'}</p>
    </div>
  )
}

function LockedLine() {
  return (
    <p className={`mt-2 flex items-center gap-1.5 text-sm ${MUTED}`}>
      <Lock className="size-3.5" aria-hidden /> 잠금 중이라 숨겼어요
    </p>
  )
}

function TodoItem({ t, d }: { t: string; d: 0 | 1 }) {
  return (
    <li className={`flex items-center gap-1.5 ${d ? 'text-[#9aa4b1] line-through' : ''}`}>
      {d ? <Check className="size-3.5 shrink-0 text-[#1d8fe1]" aria-hidden /> : <Circle className="size-3.5 shrink-0 text-[#9aa4b1]" aria-hidden />}
      <span className="truncate">{t}</span>
    </li>
  )
}

/** '오늘' 위젯 (widget_tidy.xml) */
export function WidgetPreview({ view, opacity = 100 }: { view: WidgetView; opacity?: number }) {
  const pct = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100)
  return (
    <Frame wide opacity={opacity} label="오늘 위젯 미리보기">
      <Header title={view.dateLabel} />
      {view.stale ? (
        <p className={`mt-3 text-sm ${MUTED}`}>{STALE}</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <p className={`shrink-0 text-[13px] ${MUTED}`}>
              오늘 할 일 {view.done}/{view.total}
            </p>
            <Bar pct={pct} />
          </div>
          {view.locked ? (
            <LockedLine />
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {view.total === 0 ? <li className={MUTED}>오늘 할 일이 없어요</li> : view.items.map((i, n) => <TodoItem key={n} {...i} />)}
              {view.more > 0 && <li className={`pl-5 text-xs ${MUTED}`}>+{view.more}개 더</li>}
            </ul>
          )}
          {view.money && <p className="mt-3 border-t border-[#e8eef5] pt-2 text-[13px] font-semibold dark:border-[#2c313a]">{view.money}</p>}
        </>
      )}
    </Frame>
  )
}

/** '할 일' 위젯 (widget_todo.xml) */
function TodoWidgetPreview({ view, opacity }: { view: TodoWidgetView; opacity: number }) {
  return (
    <Frame opacity={opacity} label="할 일 위젯 미리보기">
      <Header title="오늘 할 일" right={view.stale ? undefined : `${view.done}/${view.total}`} />
      {view.stale ? (
        <p className={`mt-2 text-sm ${MUTED}`}>{STALE}</p>
      ) : view.locked ? (
        <LockedLine />
      ) : view.total === 0 ? (
        <p className={`mt-2 text-sm ${MUTED}`}>오늘 할 일이 없어요 🎉</p>
      ) : (
        <ul className="mt-2 space-y-0.5 text-[13px]">
          {view.items.slice(0, 5).map((i, n) => (
            <TodoItem key={n} {...i} />
          ))}
          {view.total > 5 && <li className={`pl-5 text-xs ${MUTED}`}>+{view.total - 5}개 더</li>}
        </ul>
      )}
    </Frame>
  )
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** '가계부' 위젯 (widget_money.xml) */
function MoneyWidgetPreview({ view, opacity }: { view: MoneyWidgetView; opacity: number }) {
  return (
    <Frame opacity={opacity} label="가계부 위젯 미리보기">
      <Header title={`${view.monthLabel} 지출`} />
      {view.stale ? (
        <p className={`mt-2 text-sm ${MUTED}`}>{STALE}</p>
      ) : view.locked ? (
        <LockedLine />
      ) : (
        <div className="flex h-[calc(100%-1.5rem)] flex-col">
          <p className="mt-1 truncate text-2xl font-extrabold tracking-tight">{won(view.month)}</p>
          <p className={`text-[13px] ${MUTED}`}>오늘 {won(view.today)}</p>
          <div className="mt-auto">
            {view.budget ? (
              <>
                <div className="mb-1 flex items-center gap-2">
                  <Bar pct={view.pct} over={view.left < 0} />
                  <span className={`text-xs ${MUTED}`}>{view.pct}%</span>
                </div>
                <p className={`truncate text-[13px] font-semibold ${view.left < 0 ? 'text-[#f04452]' : ''}`}>{view.left < 0 ? `예산 ${won(-view.left)} 넘었어요` : `예산 ${won(view.left)} 남음`}</p>
              </>
            ) : (
              <p className={`text-xs ${MUTED}`}>설정에서 한 달 예산을 정하면 남은 돈이 보여요</p>
            )}
          </div>
        </div>
      )}
    </Frame>
  )
}

/** '일정' 위젯 (widget_event.xml) */
function EventWidgetPreview({ view, opacity }: { view: EventWidgetView; opacity: number }) {
  return (
    <Frame wide opacity={opacity} label="일정 위젯 미리보기">
      <Header title="다가오는 일정" right={view.stale ? undefined : `오늘 ${view.todayCount}개`} />
      {view.stale ? (
        <p className={`mt-3 text-sm ${MUTED}`}>{STALE}</p>
      ) : view.locked ? (
        <LockedLine />
      ) : view.rows.length === 0 ? (
        <p className={`mt-3 flex items-center gap-1.5 text-sm ${MUTED}`}>
          <CalendarDays className="size-4" aria-hidden /> 일주일 안에 일정이 없어요
        </p>
      ) : (
        <ul className="mt-2 space-y-1 text-sm">
          {view.rows.map((r, n) => (
            <li key={n} className="flex items-center gap-2">
              <span className={`w-12 shrink-0 text-[13px] font-semibold ${r.today ? 'text-[#1d8fe1]' : MUTED}`}>{r.label}</span>
              <span className="truncate">{r.t}</span>
            </li>
          ))}
        </ul>
      )}
    </Frame>
  )
}

/** '습관' 위젯 (widget_habit.xml) */
function HabitWidgetPreview({ view, opacity }: { view: HabitWidgetView; opacity: number }) {
  const pct = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100)
  return (
    <Frame opacity={opacity} label="습관 위젯 미리보기">
      <Header title="오늘 습관" right={view.stale ? undefined : `${view.done}/${view.total}`} />
      {view.stale ? (
        <p className={`mt-2 text-sm ${MUTED}`}>{STALE}</p>
      ) : view.total === 0 ? (
        <p className={`mt-2 text-sm ${MUTED}`}>오늘 할 습관이 없어요</p>
      ) : (
        <>
          <div className="mt-2 flex">
            <Bar pct={pct} />
          </div>
          <ul className="mt-2 space-y-0.5 text-[13px]">
            {view.items.slice(0, 5).map((h, n) => (
              <li key={n} className={`flex items-center gap-1.5 ${h.d ? 'text-[#9aa4b1]' : ''}`}>
                <span className="w-5 shrink-0 text-center">{h.e}</span>
                <span className={`flex-1 truncate ${h.d ? 'line-through' : ''}`}>{view.locked ? '잠금 중' : h.t}</span>
                {h.d === 1 && <Check className="size-3.5 shrink-0 text-[#1d8fe1]" aria-hidden />}
              </li>
            ))}
          </ul>
        </>
      )}
    </Frame>
  )
}

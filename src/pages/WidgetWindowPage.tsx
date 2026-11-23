import { useLiveQuery } from 'dexie-react-hooks'
import { GripHorizontal, Minus, MoveDiagonal2, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CalendarWidgetPreview } from '../components/settings/WidgetCard'
import { db } from '../db/database'
import { useWidgetExtras } from '../hooks/useWidgetSync'
import { useToday } from '../hooks/useToday'
import { buildWidgetSummary, calendarSizeOf, widgetRange } from '../lib/widgetSummary'
import { todoRepo } from '../repositories/todoRepo'
import { closeDeskWidget, isDeskWidget, loadDeskOpacity, resizeDeskWidget, saveDeskOpacity, startDeskResize } from '../platform/deskWidget'

/** 컴퓨터용 위젯 창은 따로 설치되는 작은 앱 (public/widget.webmanifest) */
function useWidgetManifest() {
  useEffect(() => {
    let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    const added = !link
    if (!link) {
      link = document.createElement('link')
      link.rel = 'manifest'
      document.head.appendChild(link)
    }
    const before = link.getAttribute('href')
    link.setAttribute('href', '/widget.webmanifest')
    const prevTitle = document.title
    document.title = 'Tidy 달력'
    return () => {
      if (added) link.remove()
      else if (before) link.setAttribute('href', before)
      document.title = prevTitle
    }
  }, [])
}

function useWindowHeight(): number {
  const [h, setH] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return h
}

/** 위젯 앱 안에서는 창 바탕을 비워서 바탕화면이 비치게 한다 (src/index.css 의 html.desk-widget) */
function useTransparentPage(on: boolean) {
  useEffect(() => {
    if (!on) return
    document.documentElement.classList.add('desk-widget')
    return () => document.documentElement.classList.remove('desk-widget')
  }, [on])
}

/** 위젯 앱: 마우스를 올리면 아래에 나오는 막대 (옮기기 · 투명도 · 크기 · 닫기) */
function DeskBar({ opacity, onOpacity }: { opacity: number; onOpacity: (n: number) => void }) {
  // 예전에 받은 위젯 앱은 크기 바꾸기 권한이 없다 → 새로 받으라고 알려 준다
  const [old, setOld] = useState(false)
  const resize = (step: 1 | -1) => void resizeDeskWidget(step).then((ok) => setOld(!ok))
  const btn = 'grid size-6 shrink-0 place-items-center rounded-full hover:bg-white/20'
  return (
    <div className="absolute inset-x-2 bottom-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      {old && <p className="mb-1 rounded-full bg-black/55 px-3 py-1 text-center text-[11px] font-semibold text-white backdrop-blur">크기를 바꾸려면 설정 › 홈 화면 위젯에서 위젯 앱을 새로 받아 주세요. 지금은 창 가장자리를 끌어도 돼요</p>}
      <div data-tauri-drag-region className="flex items-center gap-1.5 rounded-full bg-black/55 py-1.5 pr-1.5 pl-3 text-white shadow-lg backdrop-blur">
        <GripHorizontal data-tauri-drag-region className="size-4 shrink-0 cursor-move opacity-80" aria-label="끌어서 옮기기" />
        <label className="flex min-w-0 flex-1 items-center gap-2 text-[11px] font-semibold">
          <span className="shrink-0">투명도</span>
          <input type="range" min={0} max={100} step={5} value={opacity} onChange={(e) => onOpacity(Number(e.target.value))} className="min-w-0 flex-1 accent-[#1d8fe1]" aria-label="바탕 투명도" />
          <span className="w-8 shrink-0 text-right tabular-nums">{opacity}%</span>
        </label>
        <span className="mx-0.5 h-4 w-px shrink-0 bg-white/30" />
        <button type="button" onClick={() => resize(-1)} className={btn} aria-label="위젯 작게" title="작게">
          <Minus className="size-4" />
        </button>
        <button type="button" onClick={() => resize(1)} className={btn} aria-label="위젯 크게" title="크게">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={closeDeskWidget} className={btn} aria-label="위젯 닫기" title="닫기">
          <X className="size-4" />
        </button>
        <button type="button" onMouseDown={(e) => { if (e.button === 0) void startDeskResize().then((ok) => setOld(!ok)) }} className={`${btn} cursor-nwse-resize`} aria-label="끌어서 크기 바꾸기" title="끌어서 크기 바꾸기">
          <MoveDiagonal2 className="size-4" />
        </button>
      </div>
    </div>
  )
}

/**
 * /widget: 맥 · 윈도우 노트북 바탕화면에 띄워 두는 달력 위젯 창.
 * - 크롬 · 엣지에서 '앱으로 설치'하면 주소창 없는 작은 창이 된다 (바탕은 불투명).
 * - 'Tidy 달력' 위젯 앱(desktop-widget/)은 /widget?desk=1 을 투명한 창에 띄운다. 이때는 바탕 투명도를 고르고, 끌어서 옮기고, − / + 나 오른쪽 아래 손잡이로 크기를 바꿀 수 있다.
 * 창 크기에 맞춰 글자와 일정 줄 수가 바뀐다. 로그인했으면 폰과 동기화된다.
 */
export default function WidgetWindowPage() {
  useWidgetManifest()
  const desk = isDeskWidget()
  useTransparentPage(desk)
  const today = useToday()
  const height = useWindowHeight()
  const [opacity, setOpacity] = useState(loadDeskOpacity)
  const [from, to] = widgetRange(today)
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])
  const extras = useWidgetExtras(today)
  // 앱 잠금이 켜져 있으면 창을 열 때 잠금 화면이 먼저 막으므로, 여기서는 내용을 그대로 보여 준다
  const summary = todos && txs && extras ? buildWidgetSummary(todos, txs, today, false, extras) : null

  if (desk) {
    const changeOpacity = (n: number) => {
      setOpacity(n)
      saveDeskOpacity(n)
    }
    return (
      <div className="group relative h-dvh w-full p-1.5">
        <div className="h-full overflow-hidden rounded-[22px]">{summary && <CalendarWidgetPreview summary={summary} today={today} opacity={opacity} size={calendarSizeOf(height * 0.9)} fill modeKey="tidy-widget-window-mode" />}</div>
        <DeskBar opacity={opacity} onOpacity={changeOpacity} />
      </div>
    )
  }

  return (
    <div className="h-dvh w-full bg-white dark:bg-[#1c1f26]">
      {summary && <CalendarWidgetPreview summary={summary} today={today} opacity={100} size={calendarSizeOf(height * 0.9)} fill modeKey="tidy-widget-window-mode" />}
    </div>
  )
}

import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { CalendarWidgetPreview } from '../components/settings/WidgetCard'
import { db } from '../db/database'
import { useWidgetExtras } from '../hooks/useWidgetSync'
import { useToday } from '../hooks/useToday'
import { buildWidgetSummary, calendarSizeOf, widgetRange } from '../lib/widgetSummary'
import { todoRepo } from '../repositories/todoRepo'

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

/**
 * /widget: 맥 · 윈도우 노트북 바탕화면에 띄워 두는 달력 위젯 창.
 * 크롬 · 엣지에서 '앱으로 설치'하면 주소창 없는 작은 창이 되고, 창 크기에 맞춰 글자와 일정 줄 수가 바뀐다.
 * 데이터는 Tidy 웹과 같은 이 기기 저장소를 쓰고, 로그인했으면 폰과도 동기화된다.
 */
export default function WidgetWindowPage() {
  useWidgetManifest()
  const today = useToday()
  const height = useWindowHeight()
  const [from, to] = widgetRange(today)
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])
  const extras = useWidgetExtras(today)
  // 앱 잠금이 켜져 있으면 창을 열 때 잠금 화면이 먼저 막으므로, 여기서는 내용을 그대로 보여 준다
  const summary = todos && txs && extras ? buildWidgetSummary(todos, txs, today, false, extras) : null

  return (
    <div className="h-dvh w-full bg-white dark:bg-[#1c1f26]">
      {summary && <CalendarWidgetPreview summary={summary} today={today} opacity={100} size={calendarSizeOf(height * 0.9)} fill modeKey="tidy-widget-window-mode" />}
    </div>
  )
}

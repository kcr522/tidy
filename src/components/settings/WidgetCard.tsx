import { useLiveQuery } from 'dexie-react-hooks'
import { Check, Circle, LayoutGrid, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import { useToday } from '../../hooks/useToday'
import { loadLock, onLockChange } from '../../lib/appLock'
import { buildWidgetSummary, widgetRange, widgetView, type WidgetView } from '../../lib/widgetSummary'
import { isNativeApp } from '../../platform/native'
import { pinWidget } from '../../platform/widget'
import { todoRepo } from '../../repositories/todoRepo'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

/** 설정 > 홈 화면 위젯: 미리보기와 홈 화면에 추가 버튼 (갤럭시 앱) */
export default function WidgetCard() {
  const toast = useToast()
  const today = useToday()
  const native = isNativeApp()
  const [locked, setLocked] = useState(() => loadLock() !== null)
  useEffect(() => onLockChange(() => setLocked(loadLock() !== null)), [])

  const [from, to] = widgetRange(today)
  const todos = useLiveQuery(() => todoRepo.listAll(), [])
  const txs = useLiveQuery(() => db.transactions.where('date').between(from, to, true, false).toArray(), [from, to])
  const view = todos && txs ? widgetView(buildWidgetSummary(todos, txs, today, locked), today) : null

  async function add() {
    if (await pinWidget()) return
    toast('홈 화면 빈 곳을 길게 누르고 → 위젯 → Tidy를 골라 주세요')
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <LayoutGrid className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">홈 화면 위젯</h2>
      </div>
      <p className="mb-4 text-sm break-keep text-slate-500">
        오늘 할 일과 지출을 앱을 열지 않고 홈 화면에서 봐요.{locked && ' 앱 잠금이 켜져 있어서 할 일 제목과 금액은 숨겨요.'}
      </p>
      {view && <WidgetPreview view={view} />}
      {native ? (
        <Button className="mt-4 w-full" onClick={add}>
          홈 화면에 추가
        </Button>
      ) : (
        <p className="mt-3 text-center text-xs text-slate-400">갤럭시 앱에서 쓸 수 있어요</p>
      )}
    </section>
  )
}

/** 안드로이드 위젯(widget_tidy.xml)과 같은 모양의 미리보기 */
export function WidgetPreview({ view }: { view: WidgetView }) {
  const pct = view.total === 0 ? 0 : Math.round((view.done / view.total) * 100)
  return (
    <div className="mx-auto max-w-sm rounded-[22px] bg-[#ffffff] p-4 text-[#191f28] shadow-md ring-1 ring-black/5 dark:bg-[#1c1f26] dark:text-[#eef1f5]" aria-label="위젯 미리보기">
      <div className="flex items-baseline justify-between">
        <p className="text-[15px] font-bold">{view.dateLabel}</p>
        <p className="text-xs font-bold text-[#1d8fe1]">Tidy</p>
      </div>
      {view.stale ? (
        <p className="mt-3 text-sm text-[#6b7684]">앱을 한 번 열면 새로 고쳐져요</p>
      ) : (
        <>
          <div className="mt-2 flex items-center gap-2">
            <p className="shrink-0 text-[13px] text-[#6b7684]">
              오늘 할 일 {view.done}/{view.total}
            </p>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#e8eef5] dark:bg-[#2c313a]">
              <div className="h-full rounded-full bg-[#1d8fe1]" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <ul className="mt-2 space-y-1">
            {view.locked ? (
              <li className="flex items-center gap-1.5 text-sm text-[#6b7684]">
                <Lock className="size-3.5" aria-hidden /> 잠금 중이라 내용은 숨겼어요
              </li>
            ) : view.total === 0 ? (
              <li className="text-sm text-[#6b7684]">오늘 할 일이 없어요</li>
            ) : (
              view.items.map((i, n) => (
                <li key={n} className={`flex items-center gap-1.5 text-sm ${i.d ? 'text-[#9aa4b1] line-through' : ''}`}>
                  {i.d ? <Check className="size-3.5 shrink-0 text-[#1d8fe1]" aria-hidden /> : <Circle className="size-3.5 shrink-0 text-[#9aa4b1]" aria-hidden />}
                  <span className="truncate">{i.t}</span>
                </li>
              ))
            )}
            {view.more > 0 && <li className="pl-5 text-xs text-[#6b7684]">+{view.more}개 더</li>}
          </ul>
          {view.money && <p className="mt-3 border-t border-[#e8eef5] pt-2 text-[13px] font-semibold dark:border-[#2c313a]">{view.money}</p>}
        </>
      )}
    </div>
  )
}

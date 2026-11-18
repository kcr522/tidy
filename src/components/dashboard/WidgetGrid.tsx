import { Check, Minus, Plus, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  addWidget,
  ALL_KINDS,
  colsForWidth,
  loadLayout,
  moveWidget,
  removeWidget,
  resetLayout,
  resizeWidget,
  saveLayout,
  WIDGET_INFO,
  type DashWidget,
  type DashWidgetKind,
  type GridCols,
} from '../../lib/dashLayout'
import Modal from '../common/Modal'

/** 위젯 한 칸의 실제 크기 (px) */
export interface WidgetBox {
  w: number
  h: number
  px: number
  py: number
  cols: GridCols
}

interface WidgetGridProps {
  editing: boolean
  onEditingChange: (v: boolean) => void
  render: (kind: DashWidgetKind, box: WidgetBox) => ReactNode
}

/** 꾹 누르는 시간 (ms) */
const HOLD_MS = 450
/** 손가락이 이만큼(px) 움직이면 꾹 누르기가 아니라 스크롤로 본다 */
const SLOP = 10

type Drag = {
  kind: DashWidgetKind
  /** 손가락이 위젯 왼쪽 위에서 얼마나 떨어져 잡았는지 */
  dx: number
  dy: number
  x: number
  y: number
  width: number
  height: number
  started: boolean
  sx: number
  sy: number
}

type Resize = { kind: DashWidgetKind; sx: number; sy: number; w: number; h: number }

/**
 * 대시보드 위젯 격자 (사용자 요청 2026-11-18)
 * - 꾹 누르면 편집: 위젯이 살짝 흔들리고, 끌어서 옮기고, 오른쪽 아래 손잡이로 크기를 바꾸고, − 로 뺀다
 * - 순서가 바뀌면 다른 위젯이 미끄러지듯 제자리로 간다 (FLIP 애니메이션)
 * - 격자 칸 수(폰 4 · 중간 8 · 넓게 12)마다 배치를 따로 이 기기에 저장한다
 */
export default function WidgetGrid({ editing, onEditingChange, render }: WidgetGridProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const cols = colsForWidth(width)
  const [layout, setLayout] = useState<{ cols: GridCols; list: DashWidget[] } | null>(null)
  const list = layout?.cols === cols ? layout.list : null
  const [drag, setDrag] = useState<Drag | null>(null)
  const [adding, setAdding] = useState(false)
  const els = useRef(new Map<DashWidgetKind, HTMLDivElement>())

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    setWidth(el.clientWidth)
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (width > 0 && layout?.cols !== cols) setLayout({ cols, list: loadLayout(cols) })
  }, [width, cols, layout?.cols])

  const update = useCallback(
    (fn: (l: DashWidget[]) => DashWidget[]) =>
      setLayout((cur) => {
        if (!cur) return cur
        const next = fn(cur.list)
        if (next === cur.list) return cur
        saveLayout(cur.cols, next)
        return { cols: cur.cols, list: next }
      }),
    [],
  )

  const gap = cols === 4 ? 12 : 16
  const colW = width > 0 ? (width - gap * (cols - 1)) / cols : 80
  const rowH = cols === 4 ? Math.round(colW) : Math.round(Math.min(colW, 64))
  const box = (w: DashWidget): WidgetBox => ({ w: w.w, h: w.h, px: w.w * colW + (w.w - 1) * gap, py: w.h * rowH + (w.h - 1) * gap, cols })

  // ── 미끄러지듯 옮기기 (FLIP): 바뀌기 전 자리를 기억했다가 새 자리에서 거꾸로 당겨 놓고 풀어 준다 ──
  const rects = useRef(new Map<DashWidgetKind, DOMRect>())
  const orderKey = list?.map((w) => `${w.kind}:${w.w}x${w.h}`).join(',') ?? ''
  useLayoutEffect(() => {
    const before = rects.current
    const after = new Map<DashWidgetKind, DOMRect>()
    els.current.forEach((el, kind) => {
      const r = el.getBoundingClientRect()
      after.set(kind, r)
      const old = before.get(kind)
      if (!old || drag?.kind === kind) return
      const dx = old.left - r.left
      const dy = old.top - r.top
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return
      el.style.transition = 'none'
      el.style.translate = `${dx}px ${dy}px`
      requestAnimationFrame(() => {
        el.style.transition = 'translate 320ms cubic-bezier(0.2, 0.9, 0.3, 1)'
        el.style.translate = '0px 0px'
      })
    })
    rects.current = after
    // eslint 없이: 순서나 크기가 바뀔 때만 돈다
  }, [orderKey]) // oxlint-disable-line react-hooks/exhaustive-deps

  // 스크롤해도 다음 비교가 맞게 자리를 새로 잰다
  useEffect(() => {
    const remeasure = () => {
      const m = new Map<DashWidgetKind, DOMRect>()
      els.current.forEach((el, kind) => m.set(kind, el.getBoundingClientRect()))
      rects.current = m
    }
    window.addEventListener('scroll', remeasure, { passive: true })
    window.addEventListener('resize', remeasure)
    return () => {
      window.removeEventListener('scroll', remeasure)
      window.removeEventListener('resize', remeasure)
    }
  }, [])

  // ── 꾹 누르기 → 편집 ──
  const hold = useRef<{ timer: number; x: number; y: number } | null>(null)
  const swallowClick = useRef(false)
  const cancelHold = () => {
    if (hold.current) window.clearTimeout(hold.current.timer)
    hold.current = null
  }

  // ── 끌어 옮기기 ──
  const dragRef = useRef<Drag | null>(null)
  useLayoutEffect(() => {
    dragRef.current = drag
  }, [drag])
  const lastSwap = useRef<DashWidgetKind | null>(null)
  const pointerY = useRef(0)

  useEffect(() => {
    if (!drag) return
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      pointerY.current = e.clientY
      const started = d.started || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 6
      setDrag({ ...d, x: e.clientX, y: e.clientY, started })
      if (!started) return
      e.preventDefault()
      // 손가락 아래에 있는 다른 위젯 자리로 옮긴다
      let over: DashWidgetKind | null = null
      els.current.forEach((el, kind) => {
        const r = el.getBoundingClientRect()
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) over = kind
      })
      if (over === null || over === d.kind) {
        lastSwap.current = null
        return
      }
      if (over === lastSwap.current) return
      lastSwap.current = over
      const target = over
      update((l) => moveWidget(l, l.findIndex((w) => w.kind === d.kind), l.findIndex((w) => w.kind === target)))
    }
    const onUp = () => {
      lastSwap.current = null
      setDrag(null)
    }
    // 화면 위·아래 끝으로 끌면 저절로 스크롤
    let raf = 0
    const tick = () => {
      const y = pointerY.current
      if (dragRef.current?.started) {
        if (y < 90) window.scrollBy(0, -10)
        else if (y > window.innerHeight - 110) window.scrollBy(0, 10)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag !== null, update]) // oxlint-disable-line react-hooks/exhaustive-deps

  // ── 크기 바꾸기 ──
  const [resizing, setResizing] = useState<Resize | null>(null)
  useEffect(() => {
    if (!resizing) return
    const onMove = (e: PointerEvent) => {
      e.preventDefault()
      const dw = Math.round((e.clientX - resizing.sx) / (colW + gap))
      const dh = Math.round((e.clientY - resizing.sy) / (rowH + gap))
      update((l) => {
        const cur = l.find((w) => w.kind === resizing.kind)
        const next = resizeWidget(l, resizing.kind, cols, resizing.w + dw, resizing.h + dh)
        const after = next.find((w) => w.kind === resizing.kind)
        return cur && after && cur.w === after.w && cur.h === after.h ? l : next
      })
    }
    const onUp = () => setResizing(null)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [resizing, colW, gap, rowH, cols, update])

  // Esc 로 편집 끝내기
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onEditingChange(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onEditingChange])

  const hidden = list ? ALL_KINDS.filter((k) => !list.some((w) => w.kind === k)) : []
  const dragging = drag?.started ? list?.find((w) => w.kind === drag.kind) : undefined

  const gridStyle: CSSProperties = {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `${rowH}px`,
    gap: `${gap}px`,
    gridAutoFlow: 'row dense',
  }

  return (
    <>
      {editing && (
        <div className="sticky top-[calc(0.5rem+env(safe-area-inset-top))] z-30 mb-4 flex items-center gap-2 rounded-2xl bg-white/90 p-2 shadow-card backdrop-blur">
          <p className="min-w-0 flex-1 truncate px-2 text-sm font-semibold text-slate-600">
            <span className="sm:hidden">위젯 편집</span>
            <span className="hidden sm:inline">끌어서 옮기고, 모서리 점을 당겨 크기를 바꿔요</span>
          </p>
          <button type="button" onClick={() => setAdding(true)} className="tap flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold">
            <Plus className="size-4" aria-hidden />
            추가
          </button>
          <button
            type="button"
            onClick={() => setLayout({ cols, list: resetLayout(cols) })}
            aria-label="처음 배치로"
            title="처음 배치로"
            className="tap flex size-8 items-center justify-center rounded-full bg-slate-100"
          >
            <RotateCcw className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={() => onEditingChange(false)} className="tap flex items-center gap-1 rounded-full bg-grad px-3.5 py-1.5 text-sm font-bold on-grad">
            <Check className="size-4" aria-hidden />
            완료
          </button>
        </div>
      )}

      <div ref={gridRef} className="grid" style={gridStyle}>
        {list?.map((w, i) => {
          const b = box(w)
          const isDragged = dragging?.kind === w.kind
          return (
            <div
              key={w.kind}
              ref={(el) => {
                if (el) els.current.set(w.kind, el)
                else els.current.delete(w.kind)
              }}
              data-widget={w.kind}
              style={{ gridColumn: `span ${Math.min(w.w, cols)}`, gridRow: `span ${w.h}`, touchAction: editing ? 'none' : undefined, animationDelay: `${(i % 3) * -0.09}s` }}
              className={`relative min-w-0 select-none [-webkit-touch-callout:none] ${editing && !isDragged ? (i % 2 ? 'animate-jiggle-b' : 'animate-jiggle') : ''}`}
              onContextMenu={(e) => editing && e.preventDefault()}
              onPointerDown={(e) => {
                if (e.button !== 0) return
                if (editing) {
                  const r = e.currentTarget.getBoundingClientRect()
                  setDrag({ kind: w.kind, dx: e.clientX - r.left, dy: e.clientY - r.top, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, width: r.width, height: r.height, started: false })
                  return
                }
                cancelHold()
                const x = e.clientX
                const y = e.clientY
                hold.current = {
                  x,
                  y,
                  timer: window.setTimeout(() => {
                    hold.current = null
                    swallowClick.current = true
                    navigator.vibrate?.(12)
                    onEditingChange(true)
                  }, HOLD_MS),
                }
              }}
              onPointerMove={(e) => {
                if (hold.current && Math.hypot(e.clientX - hold.current.x, e.clientY - hold.current.y) > SLOP) cancelHold()
              }}
              onPointerUp={cancelHold}
              onPointerCancel={cancelHold}
              onPointerLeave={cancelHold}
              onClickCapture={(e) => {
                if (editing || swallowClick.current) {
                  e.preventDefault()
                  e.stopPropagation()
                  swallowClick.current = false
                }
              }}
            >
              <div className={`h-full transition-opacity ${isDragged ? 'opacity-25' : ''} ${editing ? 'pointer-events-none' : ''}`}>{render(w.kind, b)}</div>
              {isDragged && <div className="absolute inset-0 rounded-3xl border-2 border-dashed border-brand-500/60" aria-hidden />}
              {editing && !isDragged && (
                <>
                  <button
                    type="button"
                    aria-label={`${WIDGET_INFO[w.kind].name} 빼기`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      update((l) => removeWidget(l, w.kind))
                    }}
                    className="tap absolute -top-2 -left-2 z-10 flex size-7 items-center justify-center rounded-full bg-slate-500 text-white shadow-md"
                  >
                    <Minus className="size-4" strokeWidth={3} aria-hidden />
                  </button>
                  <span
                    role="slider"
                    aria-label={`${WIDGET_INFO[w.kind].name} 크기`}
                    aria-valuetext={`${w.w}×${w.h}`}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      const step = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key]
                      if (!step) return
                      e.preventDefault()
                      update((l) => resizeWidget(l, w.kind, cols, w.w + step[0], w.h + step[1]))
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation()
                      e.preventDefault()
                      setResizing({ kind: w.kind, sx: e.clientX, sy: e.clientY, w: w.w, h: w.h })
                    }}
                    className="absolute -right-1.5 -bottom-1.5 z-10 flex size-8 cursor-nwse-resize items-center justify-center"
                  >
                    <span className="size-5 rounded-full border-[3px] border-white bg-brand-500 shadow-md" />
                  </span>
                </>
              )}
            </div>
          )
        })}
      </div>

      {dragging && drag && (
        <div
          className="pointer-events-none fixed z-50 scale-[1.04] rounded-3xl shadow-2xl"
          style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width, height: drag.height }}
          aria-hidden
        >
          <div className="h-full">{render(dragging.kind, box(dragging))}</div>
        </div>
      )}

      <Modal open={adding} title="위젯 추가" onClose={() => setAdding(false)}>
        {hidden.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">모든 위젯이 대시보드에 있어요</p>
        ) : (
          <ul className="space-y-2">
            {hidden.map((k) => (
              <li key={k}>
                <button
                  type="button"
                  onClick={() => {
                    update((l) => addWidget(l, k, cols))
                    setAdding(false)
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{WIDGET_INFO[k].name}</span>
                    <span className="block text-sm text-slate-500">{WIDGET_INFO[k].desc}</span>
                  </span>
                  <Plus className="size-5 text-brand-600" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  )
}

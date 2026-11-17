import { Eraser, Redo2, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

/** 펜 색 (흰 바탕에서 잘 보이는 색) */
export const INK_COLORS = [
  { name: '검정', hex: '#191f28' },
  { name: '파랑', hex: '#3182f6' },
  { name: '빨강', hex: '#f04452' },
  { name: '초록', hex: '#2ea97c' },
  { name: '보라', hex: '#8c70da' },
]
/** 펜 굵기 (캔버스 픽셀) */
export const INK_SIZES = [
  { name: '가늘게', px: 3 },
  { name: '보통', px: 6 },
  { name: '굵게', px: 12 },
]
const ERASER_PX = 36
/** 저장하는 그림 너비 (높이는 화면 비율대로) */
const OUT_WIDTH = 1000

type Stroke = { color: string; width: number; points: [number, number][] }

interface Props {
  /** 고칠 때: 이전에 쓴 손글씨 (그 위에 이어서 쓴다) */
  initial?: string
  onDone: (png: string) => void
  onCancel: () => void
}

/**
 * 손글씨 쓰기 (사용자 요청 2026-11-17): 손가락·펜·마우스로 쓰고, 색·굵기·지우개·되돌리기.
 * 흰 바탕 PNG 로 돌려준다 (어두운 화면에서도 같은 그림이 되고, AI 가 글자를 읽기 쉽다).
 */
export default function HandwritingPad({ initial, onDone, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLImageElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [color, setColor] = useState(INK_COLORS[0].hex)
  const [width, setWidth] = useState(INK_SIZES[1].px)
  const [erasing, setErasing] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [undone, setUndone] = useState<Stroke[]>([])
  const [cleared, setCleared] = useState(false)
  const drawing = useRef<Stroke | null>(null)

  // 캔버스 크기: 너비 OUT_WIDTH, 높이는 화면 칸 비율. 고칠 때는 원래 그림 비율
  useLayoutEffect(() => {
    const box = wrapRef.current?.getBoundingClientRect()
    const ratio = box && box.width > 0 ? box.height / box.width : 1.3
    if (!initial) {
      setSize({ w: OUT_WIDTH, h: Math.round(OUT_WIDTH * Math.min(Math.max(ratio, 0.5), 2)) })
      return
    }
    const img = new Image()
    img.onload = () => {
      baseRef.current = img
      setSize({ w: OUT_WIDTH, h: Math.round((OUT_WIDTH * img.naturalHeight) / Math.max(img.naturalWidth, 1)) })
    }
    img.onerror = () => setSize({ w: OUT_WIDTH, h: Math.round(OUT_WIDTH * ratio) })
    img.src = initial
  }, [initial])

  // 전체 다시 그리기 (되돌리기·지우기 뒤)
  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx || !size) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    if (baseRef.current && !cleared) ctx.drawImage(baseRef.current, 0, 0, c.width, c.height)
    for (const s of strokes) paint(ctx, s)
  }, [strokes, size, cleared])

  // 쓰는 동안 화면이 밀리지 않게
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onCancel])

  function point(e: ReactPointerEvent<HTMLCanvasElement>): [number, number] {
    const c = e.currentTarget
    const r = c.getBoundingClientRect()
    return [((e.clientX - r.left) / r.width) * c.width, ((e.clientY - r.top) / r.height) * c.height]
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const s: Stroke = { color: erasing ? '#ffffff' : color, width: erasing ? ERASER_PX : width, points: [point(e)] }
    drawing.current = s
    const ctx = e.currentTarget.getContext('2d')
    if (ctx) paint(ctx, s)
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const s = drawing.current
    if (!s) return
    const ctx = e.currentTarget.getContext('2d')
    // 빠르게 그을 때 놓친 점까지
    const events = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : []
    const list = events.length ? events.map((ev) => point({ ...e, clientX: ev.clientX, clientY: ev.clientY } as ReactPointerEvent<HTMLCanvasElement>)) : [point(e)]
    for (const p of list) {
      const last = s.points[s.points.length - 1]
      s.points.push(p)
      if (ctx) {
        ctx.strokeStyle = s.color
        ctx.lineWidth = s.width
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(last[0], last[1])
        ctx.lineTo(p[0], p[1])
        ctx.stroke()
      }
    }
  }

  function up() {
    const s = drawing.current
    drawing.current = null
    if (!s) return
    setStrokes((old) => [...old, s])
    setUndone([])
  }

  const undo = () => {
    if (!strokes.length) return
    setUndone((u) => [...u, strokes[strokes.length - 1]])
    setStrokes((old) => old.slice(0, -1))
  }
  const redo = () => {
    if (!undone.length) return
    setStrokes((old) => [...old, undone[undone.length - 1]])
    setUndone((u) => u.slice(0, -1))
  }
  const clearAll = () => {
    setStrokes([])
    setUndone([])
    setCleared(true)
  }

  const empty = strokes.length === 0 && (!initial || cleared)
  const changed = strokes.length > 0 || cleared

  function done() {
    const c = canvasRef.current
    if (!c || empty) return
    if (!changed && initial) return onCancel()
    onDone(trimmed(c, initial && !cleared ? null : strokes))
  }

  const tool = (on: boolean) => `flex size-10 shrink-0 items-center justify-center rounded-full transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`

  // 카드 안(흐림 효과 등)에 갇히지 않게 화면 맨 위에 띄운다
  return createPortal(
    <div className="fixed inset-0 z-[57] flex flex-col bg-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label="손글씨 쓰기">
      <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
        <button type="button" onClick={onCancel} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기">
          <X className="size-5" aria-hidden />
        </button>
        <h2 className="flex-1 text-[17px] font-bold">손글씨</h2>
        <button type="button" onClick={undo} disabled={!strokes.length} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="되돌리기">
          <Undo2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={redo} disabled={!undone.length} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="다시 하기">
          <Redo2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={clearAll} disabled={empty} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="모두 지우기">
          <Trash2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={done} disabled={empty} className="bg-grad on-grad ml-1 min-h-10 rounded-full px-4 text-sm font-bold disabled:opacity-40">
          완료
        </button>
      </div>

      <div ref={wrapRef} className="flex min-h-0 flex-1 items-center justify-center p-3">
        {size && (
          <canvas
            ref={canvasRef}
            width={size.w}
            height={size.h}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            className="max-h-full max-w-full touch-none rounded-2xl bg-white shadow-sm"
            style={{ aspectRatio: `${size.w} / ${size.h}`, cursor: erasing ? 'cell' : 'crosshair' }}
            aria-label="손글씨 쓰는 곳"
          />
        )}
      </div>

      <div className="flex items-center gap-2 overflow-x-auto bg-white px-3 py-2.5">
        {INK_COLORS.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => {
              setColor(c.hex)
              setErasing(false)
            }}
            className={`size-9 shrink-0 rounded-full transition ${!erasing && color === c.hex ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : ''}`}
            style={{ background: c.hex }}
            aria-label={`${c.name} 펜`}
            aria-pressed={!erasing && color === c.hex}
          />
        ))}
        <span className="mx-1 h-7 w-px shrink-0 bg-slate-200" aria-hidden />
        {INK_SIZES.map((s) => (
          <button
            key={s.px}
            type="button"
            onClick={() => {
              setWidth(s.px)
              setErasing(false)
            }}
            className={tool(!erasing && width === s.px)}
            aria-label={`${s.name} 쓰기`}
            aria-pressed={!erasing && width === s.px}
          >
            <span className="rounded-full bg-current" style={{ width: s.px + 2, height: s.px + 2 }} aria-hidden />
          </button>
        ))}
        <button type="button" onClick={() => setErasing((v) => !v)} className={tool(erasing)} aria-label="지우개" aria-pressed={erasing}>
          <Eraser className="size-5" aria-hidden />
        </button>
      </div>
    </div>,
    document.body,
  )
}

function paint(ctx: CanvasRenderingContext2D, s: Stroke) {
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineWidth = s.width
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (s.points.length === 1) {
    const [x, y] = s.points[0]
    ctx.beginPath()
    ctx.arc(x, y, s.width / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(s.points[0][0], s.points[0][1])
  for (const [x, y] of s.points.slice(1)) ctx.lineTo(x, y)
  ctx.stroke()
}

/**
 * 새로 쓴 손글씨는 쓴 곳 둘레만 잘라 낸다 (빈 곳이 많으면 목록·AI 읽기가 나빠진다).
 * 이전 그림 위에 이어 쓴 것(strokes = null)은 크기를 그대로 둔다
 */
function trimmed(c: HTMLCanvasElement, strokes: Stroke[] | null): string {
  if (!strokes?.length) return c.toDataURL('image/png')
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const s of strokes) {
    if (s.color === '#ffffff') continue
    for (const [x, y] of s.points) {
      x0 = Math.min(x0, x - s.width)
      y0 = Math.min(y0, y - s.width)
      x1 = Math.max(x1, x + s.width)
      y1 = Math.max(y1, y + s.width)
    }
  }
  if (!Number.isFinite(x0)) return c.toDataURL('image/png')
  const pad = 40
  x0 = Math.max(0, Math.floor(x0 - pad))
  y0 = Math.max(0, Math.floor(y0 - pad))
  x1 = Math.min(c.width, Math.ceil(x1 + pad))
  y1 = Math.min(c.height, Math.ceil(y1 + pad))
  // 너무 납작하거나 좁지 않게 (한 글자만 써도 보기 좋게)
  const w = Math.max(x1 - x0, 240)
  const h = Math.max(y1 - y0, 160)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  const ctx = out.getContext('2d')
  if (!ctx) return c.toDataURL('image/png')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(c, x0, y0, x1 - x0, y1 - y0, (w - (x1 - x0)) / 2, (h - (y1 - y0)) / 2, x1 - x0, y1 - y0)
  return out.toDataURL('image/png')
}

import { Eraser, Highlighter, PenLine, Redo2, Trash2, Undo2, X } from 'lucide-react'
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
/** 형광펜 색 (반투명으로 칠해서 밑의 글씨 · 사진이 비쳐 보인다) */
export const HL_COLORS = [
  { name: '노랑', hex: '#ffe600' },
  { name: '연두', hex: '#7ee000' },
  { name: '분홍', hex: '#ff4f9a' },
  { name: '하늘', hex: '#2fb8ff' },
  { name: '주황', hex: '#ff9500' },
]
export const HL_SIZES = [
  { name: '가늘게', px: 14 },
  { name: '보통', px: 26 },
  { name: '굵게', px: 44 },
]
/** 형광펜 진하기 */
export const HL_ALPHA = 0.38
const ERASER_PX = 36
/** 저장하는 그림 너비 (높이는 화면 비율대로) */
const OUT_WIDTH = 1000
/** 사진 위에 그릴 때 사진 긴 쪽 최대 크기 */
const PHOTO_MAX = 1600

/** 점마다 굵기를 따로 둔다 (펜 누르는 힘) */
type Pt = [x: number, y: number, w: number]
type Tool = 'pen' | 'hl' | 'erase'
type Stroke = { tool: Tool; color: string; width: number; points: Pt[] }

/** 펜 누르는 힘(0~1) → 굵기 배율. 살살 쓰면 가늘게, 세게 누르면 굵게 */
export function pressureScale(pressure: number): number {
  if (!(pressure > 0)) return 1
  return Math.min(1.8, Math.max(0.35, 0.35 + pressure * 1.45))
}

/**
 * S펜 옆 버튼(배럴 버튼)이나 지우개 끝으로 그으면 지우개.
 * 포인터 이벤트에서 배럴 버튼은 buttons 의 2, 지우개 끝은 32 로 온다
 */
export const isPenEraser = (pointerType: string, buttons: number) => pointerType === 'pen' && (buttons & (2 | 32)) !== 0

interface Props {
  /** 고칠 때: 이전에 쓴 손글씨 (그 위에 이어서 쓴다. 지우개로 지울 수 있다) */
  initial?: string
  /** 사진 위에 그리기: 이 사진 위에 그린다 (지우개는 그린 것만 지우고 사진은 그대로) */
  photo?: string
  title?: string
  onDone: (src: string) => void
  onCancel: () => void
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('그림을 열지 못했어요'))
    img.src = src
  })
}

/**
 * 손글씨 쓰기 (사용자 요청 2026-11-17): 손가락·펜·마우스로 쓰고, 색·굵기·형광펜·지우개·되돌리기.
 * 손글씨는 흰 바탕 PNG 로 돌려준다 (어두운 화면에서도 같은 그림이 되고, AI 가 글자를 읽기 쉽다).
 * photo 를 주면 사진 위에 그리기: 펜 · 형광펜으로 표시한 사진을 JPEG 로 돌려준다.
 *
 * 그리는 것은 따로 한 장(ink)에 모으고, 화면에는 바탕(흰색 또는 사진) 위에 겹쳐 보인다.
 * 그래서 지우개는 그린 것만 지우고, 형광펜은 한 번 그은 줄이 겹쳐도 얼룩지지 않는다.
 */
export default function HandwritingPad({ initial, photo, title, onDone, onCancel }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseRef = useRef<HTMLImageElement | null>(null)
  const photoRef = useRef<HTMLImageElement | null>(null)
  const inkRef = useRef<HTMLCanvasElement | null>(null)
  /** 형광펜을 긋기 전 모습 (그을 때마다 다시 그려서 겹침 얼룩이 없게) */
  const beforeRef = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(INK_COLORS[0].hex)
  const [hlColor, setHlColor] = useState(HL_COLORS[0].hex)
  const [width, setWidth] = useState(INK_SIZES[1].px)
  const [hlWidth, setHlWidth] = useState(HL_SIZES[1].px)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [undone, setUndone] = useState<Stroke[]>([])
  const [cleared, setCleared] = useState(false)
  const drawing = useRef<Stroke | null>(null)
  /** 지금 긋고 있는 손가락·펜 (다른 손가락·손바닥은 무시) */
  const active = useRef<number | null>(null)
  /** 펜만 쓰기: 펜으로 쓴 적이 있으면 손가락·손바닥 터치는 무시한다 (손을 화면에 대고 써도 되게). 다음에 열 때도 기억 */
  const [penMode, setPenModeState] = useState(loadPenOnly)
  const setPenMode = (on: boolean) => {
    setPenModeState(on)
    savePenOnly(on)
  }
  /** 지금 긋는 줄이 손가락(터치)으로 시작했는지: 펜이 닿으면 그 줄은 손바닥이었던 것으로 보고 버린다 */
  const touchStroke = useRef(false)
  /** 굵기 배율: 사진이 크면 같은 굵기로 보이게 */
  const scale = size ? size.w / OUT_WIDTH : 1

  // 캔버스 크기: 너비 OUT_WIDTH, 높이는 화면 칸 비율. 고칠 때는 원래 그림 비율, 사진은 사진 비율
  useLayoutEffect(() => {
    const box = wrapRef.current?.getBoundingClientRect()
    const ratio = box && box.width > 0 ? box.height / box.width : 1.3
    let alive = true
    if (photo) {
      loadImage(photo)
        .then((img) => {
          if (!alive) return
          photoRef.current = img
          const k = Math.min(1, PHOTO_MAX / Math.max(img.naturalWidth, img.naturalHeight))
          setSize({ w: Math.round(img.naturalWidth * k), h: Math.round(img.naturalHeight * k) })
        })
        .catch(() => alive && onCancel())
    } else if (!initial) {
      setSize({ w: OUT_WIDTH, h: Math.round(OUT_WIDTH * Math.min(Math.max(ratio, 0.5), 2)) })
    } else {
      loadImage(initial)
        .then((img) => {
          if (!alive) return
          baseRef.current = img
          setSize({ w: OUT_WIDTH, h: Math.round((OUT_WIDTH * img.naturalHeight) / Math.max(img.naturalWidth, 1)) })
        })
        .catch(() => alive && setSize({ w: OUT_WIDTH, h: Math.round(OUT_WIDTH * ratio) }))
    }
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, photo])

  /** 화면 = 바탕(흰색 또는 사진) + 그린 것 */
  function compose() {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    const ink = inkRef.current
    if (!c || !ctx || !ink) return
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    if (photoRef.current) ctx.drawImage(photoRef.current, 0, 0, c.width, c.height)
    ctx.drawImage(ink, 0, 0)
  }

  // 전체 다시 그리기 (되돌리기·지우기 뒤)
  useEffect(() => rebuild(), [strokes, size, cleared]) // eslint-disable-line react-hooks/exhaustive-deps

  function rebuild() {
    if (!size) return
    let ink = inkRef.current
    if (!ink || ink.width !== size.w || ink.height !== size.h) {
      ink = document.createElement('canvas')
      ink.width = size.w
      ink.height = size.h
      inkRef.current = ink
    }
    const ctx = ink.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, ink.width, ink.height)
    // 이어 쓰는 손글씨: 이전 그림도 지우개로 지울 수 있게 그린 것 쪽에 넣는다
    if (baseRef.current && !cleared) ctx.drawImage(baseRef.current, 0, 0, ink.width, ink.height)
    for (const s of strokes) paint(ctx, s)
    compose()
  }

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

  /** 화면 좌표 → 캔버스 점. 펜이면 누르는 힘으로 굵기를 바꾼다 (형광펜 · 지우개는 그대로) */
  function point(c: HTMLCanvasElement, ev: { clientX: number; clientY: number; pressure: number; pointerType: string }, s: Pick<Stroke, 'width' | 'tool'>): Pt {
    const r = c.getBoundingClientRect()
    const w = ev.pointerType === 'pen' && s.tool === 'pen' ? s.width * pressureScale(ev.pressure) : s.width
    return [((ev.clientX - r.left) / r.width) * c.width, ((ev.clientY - r.top) / r.height) * c.height, w]
  }

  function down(e: ReactPointerEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const pen = e.pointerType === 'pen'
    if (pen && !penMode) setPenMode(true)
    // 펜만 쓰기: 손바닥·손가락은 무시
    if ((penMode || pen) && e.pointerType === 'touch') return
    // 손바닥이 먼저 닿아 줄이 그어지던 중에 펜이 닿으면: 그 줄은 버리고 펜으로
    if (pen && active.current !== null && touchStroke.current) {
      active.current = null
      drawing.current = null
      rebuild()
    }
    // 이미 긋는 중이면 두 번째 손가락도 무시
    if (active.current !== null) return
    touchStroke.current = e.pointerType === 'touch'
    const ink = inkRef.current
    const ctx = ink?.getContext('2d')
    if (!ink || !ctx) return
    active.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
    const t: Tool = isPenEraser(e.pointerType, e.buttons) ? 'erase' : tool
    const s: Stroke =
      t === 'erase' ? { tool: t, color: '#000', width: ERASER_PX * scale, points: [] } : t === 'hl' ? { tool: t, color: hlColor, width: hlWidth * scale, points: [] } : { tool: t, color, width: width * scale, points: [] }
    s.points.push(point(e.currentTarget, e, s))
    drawing.current = s
    if (t === 'hl') {
      const before = beforeRef.current ?? document.createElement('canvas')
      before.width = ink.width
      before.height = ink.height
      before.getContext('2d')?.drawImage(ink, 0, 0)
      beforeRef.current = before
    }
    paint(ctx, s)
    compose()
  }

  function move(e: ReactPointerEvent<HTMLCanvasElement>) {
    const s = drawing.current
    if (!s || e.pointerId !== active.current) return
    const c = e.currentTarget
    const ctx = inkRef.current?.getContext('2d')
    if (!ctx) return
    // 빠르게 그을 때 놓친 점까지
    const events = 'getCoalescedEvents' in e.nativeEvent ? e.nativeEvent.getCoalescedEvents() : []
    const list = (events.length ? events : [e.nativeEvent]).map((ev) => point(c, ev, s))
    if (s.tool === 'hl') {
      s.points.push(...list)
      // 그은 줄 전체를 한 번에 다시 칠한다 (반투명이 겹쳐 얼룩지지 않게)
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
      if (beforeRef.current) ctx.drawImage(beforeRef.current, 0, 0)
      paint(ctx, s)
    } else {
      for (const p of list) {
        const last = s.points[s.points.length - 1]
        s.points.push(p)
        segment(ctx, s, last, p)
      }
    }
    compose()
  }

  function up(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (e.pointerId !== active.current) return
    active.current = null
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

  const empty = photo ? false : strokes.length === 0 && (!initial || cleared)
  const changed = strokes.length > 0 || cleared

  function done() {
    const c = canvasRef.current
    if (!c || empty) return
    if (!changed && (initial || photo)) return onCancel()
    if (photo) return onDone(c.toDataURL('image/jpeg', 0.9))
    onDone(trimmed(c, initial && !cleared ? null : strokes))
  }

  const toolCls = (on: boolean) => `flex size-10 shrink-0 items-center justify-center rounded-full transition ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`
  const colors = tool === 'hl' ? HL_COLORS : INK_COLORS
  const sizes = tool === 'hl' ? HL_SIZES : INK_SIZES
  const curColor = tool === 'hl' ? hlColor : color
  const curWidth = tool === 'hl' ? hlWidth : width

  // 카드 안(흐림 효과 등)에 갇히지 않게 화면 맨 위에 띄운다 (사진 자르기 창 위에도)
  return createPortal(
    <div className="fixed inset-0 z-[71] flex flex-col bg-slate-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label={title ?? '손글씨 쓰기'}>
      <div className="flex items-center gap-2 bg-white px-3 py-2 shadow-sm">
        <button type="button" onClick={onCancel} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="닫기">
          <X className="size-5" aria-hidden />
        </button>
        <h2 className="flex-1 truncate text-[17px] font-bold">{title ?? '손글씨'}</h2>
        <button type="button" onClick={undo} disabled={!strokes.length} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="되돌리기">
          <Undo2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={redo} disabled={!undone.length} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label="다시 하기">
          <Redo2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={clearAll} disabled={photo ? !strokes.length : empty} className="tap rounded-full p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30" aria-label={photo ? '그린 것 모두 지우기' : '모두 지우기'}>
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
            onContextMenu={(e) => e.preventDefault()}
            className="max-h-full max-w-full touch-none rounded-2xl bg-white shadow-sm"
            style={{ aspectRatio: `${size.w} / ${size.h}`, cursor: tool === 'erase' ? 'cell' : 'crosshair' }}
            aria-label={photo ? '사진 위에 그리는 곳' : '손글씨 쓰는 곳'}
          />
        )}
      </div>

      <div className="bg-white px-3 py-2.5">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button type="button" onClick={() => setTool('pen')} className={toolCls(tool === 'pen')} aria-label="펜" aria-pressed={tool === 'pen'}>
            <PenLine className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => setTool('hl')} className={toolCls(tool === 'hl')} aria-label="형광펜" aria-pressed={tool === 'hl'}>
            <Highlighter className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => setTool('erase')} className={toolCls(tool === 'erase')} aria-label="지우개" aria-pressed={tool === 'erase'}>
            <Eraser className="size-5" aria-hidden />
          </button>
          <span className="mx-1 h-7 w-px shrink-0 bg-slate-200" aria-hidden />
          {sizes.map((s) => (
            <button
              key={s.px}
              type="button"
              onClick={() => {
                if (tool === 'hl') setHlWidth(s.px)
                else {
                  setWidth(s.px)
                  setTool('pen')
                }
              }}
              className={toolCls(tool !== 'erase' && curWidth === s.px)}
              aria-label={`${tool === 'hl' ? '형광펜' : '펜'} ${s.name}`}
              aria-pressed={tool !== 'erase' && curWidth === s.px}
            >
              <span className="rounded-full bg-current" style={{ width: Math.min(22, (tool === 'hl' ? s.px / 2 : s.px) + 2), height: Math.min(22, (tool === 'hl' ? s.px / 2 : s.px) + 2) }} aria-hidden />
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2 overflow-x-auto">
          {colors.map((c) => (
            <button
              key={c.hex}
              type="button"
              onClick={() => {
                if (tool === 'hl') setHlColor(c.hex)
                else {
                  setColor(c.hex)
                  setTool('pen')
                }
              }}
              className={`size-9 shrink-0 rounded-full transition ${tool !== 'erase' && curColor === c.hex ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white' : ''}`}
              style={{ background: c.hex, opacity: tool === 'hl' ? 0.7 : 1 }}
              aria-label={`${c.name} ${tool === 'hl' ? '형광펜' : '펜'}`}
              aria-pressed={tool !== 'erase' && curColor === c.hex}
            />
          ))}
          {penMode && (
            <button type="button" onClick={() => setPenMode(false)} className="flex min-h-9 shrink-0 items-center gap-1 rounded-full bg-slate-900 px-3 text-xs font-bold whitespace-nowrap text-white" aria-pressed="true" title="누르면 손가락으로도 쓸 수 있어요">
              펜만 인식 중 · 끄기
            </button>
          )}

        </div>
        {penMode && <p className="mt-1.5 text-xs text-slate-500">펜만 인식해요. 손가락·손바닥이 닿아도 괜찮아요 · S펜 버튼을 누르고 그으면 지우개</p>}
      </div>
    </div>,
    document.body,
  )
}

const PEN_ONLY_KEY = 'tidy.penOnly'
function loadPenOnly(): boolean {
  try {
    return localStorage.getItem(PEN_ONLY_KEY) === '1'
  } catch {
    return false
  }
}
function savePenOnly(on: boolean) {
  try {
    if (on) localStorage.setItem(PEN_ONLY_KEY, '1')
    else localStorage.removeItem(PEN_ONLY_KEY)
  } catch {
    // 저장 못 해도 이번에는 그대로
  }
}

/** 한 줄 그리기: 펜은 토막마다 굵기가 다르고, 형광펜은 한 번에 반투명으로, 지우개는 그린 것을 지운다 */
function paint(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (!s.points.length) return
  ctx.save()
  ctx.globalCompositeOperation = s.tool === 'erase' ? 'destination-out' : 'source-over'
  ctx.globalAlpha = s.tool === 'hl' ? HL_ALPHA : 1
  ctx.strokeStyle = s.color
  ctx.fillStyle = s.color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  if (s.points.length === 1) {
    const [x, y, w] = s.points[0]
    ctx.beginPath()
    ctx.arc(x, y, w / 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (s.tool === 'hl') {
    ctx.lineWidth = s.width
    ctx.beginPath()
    ctx.moveTo(s.points[0][0], s.points[0][1])
    for (const [x, y] of s.points.slice(1)) ctx.lineTo(x, y)
    ctx.stroke()
  } else {
    for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1]
      const b = s.points[i]
      ctx.lineWidth = (a[2] + b[2]) / 2
      ctx.beginPath()
      ctx.moveTo(a[0], a[1])
      ctx.lineTo(b[0], b[1])
      ctx.stroke()
    }
  }
  ctx.restore()
}

/** 두 점 사이 한 토막 (쓰는 중에 이어 그리기, 굵기는 두 점의 가운데) */
function segment(ctx: CanvasRenderingContext2D, s: Stroke, a: Pt, b: Pt) {
  paint(ctx, { ...s, points: [a, b] })
}

/**
 * 새로 쓴 손글씨는 쓴 곳 둘레만 잘라 낸다 (빈 곳이 많으면 목록·AI 읽기가 나빠진다).
 * 이전 그림 위에 이어 쓴 것(strokes = null)은 크기를 그대로 둔다
 */
function trimmed(c: HTMLCanvasElement, strokes: Stroke[] | null): string {
  if (!strokes?.length) return c.toDataURL('image/png')
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const s of strokes) {
    if (s.tool === 'erase') continue
    for (const [x, y, w] of s.points) {
      x0 = Math.min(x0, x - w)
      y0 = Math.min(y0, y - w)
      x1 = Math.max(x1, x + w)
      y1 = Math.max(y1, y + w)
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

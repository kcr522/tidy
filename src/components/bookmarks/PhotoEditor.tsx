import { Brush, Check, Crop, RotateCw, Type, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'

type Tool = 'crop' | 'draw' | 'text' | null
interface Rect {
  x: number
  y: number
  w: number
  h: number
}

const COLORS = ['#ffffff', '#191f28', '#f04452', '#ffb020', '#22c55e', '#3182f6', '#a855f7']
const MAX_SIDE = 2048
const MAX_HISTORY = 20

interface Props {
  blob: Blob
  onCancel: () => void
  onSave: (blob: Blob) => Promise<void> | void
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  c.getContext('2d')!.drawImage(src, 0, 0)
  return c
}

/**
 * 간단한 사진 편집기: 자르기, 돌리기, 그리기, 글자 넣기, 되돌리기
 * 기기 안에서 canvas로 처리한다 (서버로 보내지 않는다)
 */
export default function PhotoEditor({ blob, onCancel, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const history = useRef<HTMLCanvasElement[]>([])
  const [ready, setReady] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [tool, setTool] = useState<Tool>(null)
  const [color, setColor] = useState(COLORS[2])
  const [brush, setBrush] = useState(8)
  const [saving, setSaving] = useState(false)
  // 그리기
  const drawing = useRef<{ x: number; y: number } | null>(null)
  // 자르기 상자 (화면 좌표, 캔버스 표시 크기 기준 0~1 비율)
  const [crop, setCrop] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const dragRef = useRef<{ mode: 'move' | 'nw' | 'ne' | 'sw' | 'se'; startX: number; startY: number; start: Rect } | null>(null)
  // 글자
  const [textPos, setTextPos] = useState<{ x: number; y: number } | null>(null)
  const [text, setText] = useState('')
  const [textSize, setTextSize] = useState(6)
  const [, force] = useState(0)

  // 사진 불러오기
  useEffect(() => {
    let alive = true
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      if (!alive) return
      const c = canvasRef.current!
      const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
      c.width = Math.round(img.naturalWidth * scale)
      c.height = Math.round(img.naturalHeight * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      setReady(true)
    }
    img.src = url
    return () => {
      alive = false
      URL.revokeObjectURL(url)
    }
  }, [blob])

  const pushHistory = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    history.current.push(cloneCanvas(c))
    if (history.current.length > MAX_HISTORY) history.current.shift()
    setCanUndo(true)
  }, [])

  /** 캔버스를 통째로 바꾼다 (자르기, 돌리기) */
  function replaceWith(next: HTMLCanvasElement) {
    const c = canvasRef.current!
    c.width = next.width
    c.height = next.height
    c.getContext('2d')!.drawImage(next, 0, 0)
    force((n) => n + 1)
  }

  function undo() {
    const prev = history.current.pop()
    if (prev) replaceWith(prev)
    setCanUndo(history.current.length > 0)
  }

  function rotate() {
    const c = canvasRef.current!
    pushHistory()
    const r = document.createElement('canvas')
    r.width = c.height
    r.height = c.width
    const ctx = r.getContext('2d')!
    ctx.translate(r.width, 0)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(c, 0, 0)
    replaceWith(r)
  }

  function applyCrop() {
    const c = canvasRef.current!
    const sx = Math.round(crop.x * c.width)
    const sy = Math.round(crop.y * c.height)
    const sw = Math.max(1, Math.round(crop.w * c.width))
    const sh = Math.max(1, Math.round(crop.h * c.height))
    pushHistory()
    const r = document.createElement('canvas')
    r.width = sw
    r.height = sh
    r.getContext('2d')!.drawImage(c, sx, sy, sw, sh, 0, 0, sw, sh)
    replaceWith(r)
    setTool(null)
  }

  /** 화면 터치 위치 → 캔버스 픽셀 위치 */
  function toCanvas(e: { clientX: number; clientY: number }) {
    const c = canvasRef.current!
    const box = c.getBoundingClientRect()
    return { x: ((e.clientX - box.left) / box.width) * c.width, y: ((e.clientY - box.top) / box.height) * c.height, rx: (e.clientX - box.left) / box.width, ry: (e.clientY - box.top) / box.height }
  }

  /** 붓 굵기·글자 크기는 사진 크기에 비례 (작은 사진에서 너무 굵지 않게) */
  const unit = () => Math.max(canvasRef.current!.width, canvasRef.current!.height) / 400

  function onPointerDown(e: RPointerEvent<HTMLCanvasElement>) {
    if (tool === 'draw') {
      e.currentTarget.setPointerCapture(e.pointerId)
      pushHistory()
      const p = toCanvas(e)
      drawing.current = p
      const ctx = canvasRef.current!.getContext('2d')!
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(p.x, p.y, (brush * unit()) / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (tool === 'text') {
      const p = toCanvas(e)
      setTextPos({ x: p.rx, y: p.ry })
    }
  }

  function onPointerMove(e: RPointerEvent<HTMLCanvasElement>) {
    if (tool !== 'draw' || !drawing.current) return
    const p = toCanvas(e)
    const ctx = canvasRef.current!.getContext('2d')!
    ctx.strokeStyle = color
    ctx.lineWidth = brush * unit()
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(drawing.current.x, drawing.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    drawing.current = p
  }

  function onPointerUp() {
    drawing.current = null
  }

  function placeText() {
    if (!textPos || !text.trim()) {
      setTextPos(null)
      return
    }
    const c = canvasRef.current!
    pushHistory()
    const ctx = c.getContext('2d')!
    const px = textSize * unit() * 3
    ctx.font = `800 ${px}px Pretendard, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    // 어느 바탕에서도 읽히게 반대색 테두리
    ctx.lineWidth = px / 6
    ctx.strokeStyle = color === '#191f28' ? '#ffffff' : 'rgba(0,0,0,0.55)'
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      const y = textPos.y * c.height + (i - (lines.length - 1) / 2) * px * 1.2
      ctx.strokeText(line, textPos.x * c.width, y)
      ctx.fillStyle = color
      ctx.fillText(line, textPos.x * c.width, y)
    })
    setText('')
    setTextPos(null)
  }

  // 자르기 상자 끌기
  function startDrag(mode: 'move' | 'nw' | 'ne' | 'sw' | 'se', e: RPointerEvent) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: crop }
  }

  function onDrag(e: RPointerEvent) {
    const d = dragRef.current
    if (!d) return
    const box = canvasRef.current!.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / box.width
    const dy = (e.clientY - d.startY) / box.height
    const s = d.start
    const min = 0.08
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
    let { x, y, w, h } = s
    if (d.mode === 'move') {
      x = clamp(s.x + dx, 0, 1 - s.w)
      y = clamp(s.y + dy, 0, 1 - s.h)
    } else {
      if (d.mode.includes('w')) {
        x = clamp(s.x + dx, 0, s.x + s.w - min)
        w = s.x + s.w - x
      }
      if (d.mode.includes('e')) w = clamp(s.w + dx, min, 1 - s.x)
      if (d.mode.includes('n')) {
        y = clamp(s.y + dy, 0, s.y + s.h - min)
        h = s.y + s.h - y
      }
      if (d.mode.includes('s')) h = clamp(s.h + dy, min, 1 - s.y)
    }
    setCrop({ x, y, w, h })
  }

  /** 글자 미리보기 크기: 실제로 그릴 크기를 화면 크기로 */
  function previewFontPx() {
    const c = canvasRef.current
    if (!c || !c.width) return 24
    return textSize * unit() * 3 * (c.getBoundingClientRect().width / c.width)
  }

  async function save() {
    if (textPos) placeText()
    setSaving(true)
    const out = await new Promise<Blob | null>((r) => canvasRef.current!.toBlob(r, 'image/jpeg', 0.9))
    if (out) await onSave(out)
    setSaving(false)
  }

  const pct = (v: number) => `${v * 100}%`
  const toolBtn = (t: Tool, label: string, Icon: typeof Crop) => (
    <button
      type="button"
      aria-pressed={tool === t}
      onClick={() => {
        setTool(tool === t ? null : t)
        setTextPos(null)
        if (t === 'crop') setCrop({ x: 0.08, y: 0.08, w: 0.84, h: 0.84 })
      }}
      className={`tap flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold ${tool === t ? 'bg-white text-slate-900' : 'text-white/80'}`}
    >
      <Icon className="size-5" aria-hidden />
      {label}
    </button>
  )

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="사진 편집">
      <header className="flex items-center gap-2 px-3 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-2">
        <button type="button" onClick={onCancel} className="tap rounded-full p-2 text-white/80" aria-label="편집 취소">
          <X className="size-6" aria-hidden />
        </button>
        <h2 className="flex-1 text-center text-base font-bold">사진 편집</h2>
        <button type="button" onClick={undo} disabled={!canUndo} className="tap rounded-full p-2 text-white/80 disabled:opacity-30" aria-label="되돌리기">
          <Undo2 className="size-5" aria-hidden />
        </button>
        <button type="button" onClick={save} disabled={!ready || saving} className="tap rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900 disabled:opacity-50">
          {saving ? '저장 중…' : '저장'}
        </button>
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="relative inline-block max-h-full" onPointerMove={onDrag} onPointerUp={() => (dragRef.current = null)}>
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className={`block max-h-[calc(100dvh-260px)] max-w-full touch-none select-none ${tool === 'draw' ? 'cursor-crosshair' : tool === 'text' ? 'cursor-text' : ''}`}
          />
          {tool === 'crop' && (
            <div className="absolute inset-0">
              {/* 바깥은 어둡게 */}
              <div
                className="absolute touch-none border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
                style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
                onPointerDown={(e) => startDrag('move', e)}
              >
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span key={i} className="border border-white/25" />
                  ))}
                </div>
                {(['nw', 'ne', 'sw', 'se'] as const).map((c) => (
                  <span
                    key={c}
                    onPointerDown={(e) => startDrag(c, e)}
                    aria-hidden
                    className={`absolute size-7 touch-none rounded-full border-[3px] border-white bg-white/30 ${c.includes('n') ? '-top-3.5' : '-bottom-3.5'} ${c.includes('w') ? '-left-3.5' : '-right-3.5'}`}
                  />
                ))}
              </div>
            </div>
          )}
          {tool === 'text' && textPos && (
            <span
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-center font-extrabold whitespace-pre [text-shadow:0_0_4px_rgba(0,0,0,.6)]"
              style={{ left: pct(textPos.x), top: pct(textPos.y), color, fontSize: `${previewFontPx()}px` }}
            >
              {text || '여기에 글자'}
            </span>
          )}
        </div>
      </div>

      {/* 도구별 옵션 */}
      <div className="min-h-[76px] px-4">
        {tool === 'crop' && (
          <div className="flex items-center justify-center gap-2">
            <p className="text-sm text-white/70">모서리를 끌어서 남길 부분을 고르세요</p>
            <button type="button" onClick={applyCrop} className="tap inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-slate-900">
              <Check className="size-4" strokeWidth={3} aria-hidden />
              자르기
            </button>
          </div>
        )}
        {(tool === 'draw' || tool === 'text') && (
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2" role="radiogroup" aria-label="색">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`색 ${c}`}
                  onClick={() => setColor(c)}
                  className={`size-7 rounded-full border-2 ${color === c ? 'scale-110 border-white' : 'border-white/30'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
            <label className="mx-auto flex max-w-xs items-center gap-2 text-xs text-white/70">
              {tool === 'draw' ? '굵기' : '크기'}
              <input
                type="range"
                min={tool === 'draw' ? 2 : 3}
                max={tool === 'draw' ? 30 : 16}
                value={tool === 'draw' ? brush : textSize}
                onChange={(e) => (tool === 'draw' ? setBrush : setTextSize)(Number(e.target.value))}
                className="flex-1 accent-white"
              />
            </label>
          </div>
        )}
        {tool === 'text' && (
          <div className="mt-2 flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && placeText()}
              placeholder={textPos ? '넣을 글자를 쓰세요' : '먼저 사진에서 글자 넣을 곳을 누르세요'}
              disabled={!textPos}
              className="min-h-11 min-w-0 flex-1 rounded-2xl bg-white/10 px-4 text-[15px] text-white outline-none placeholder:text-white/40 focus:ring-2 focus:ring-white/60"
            />
            <button type="button" onClick={placeText} disabled={!textPos || !text.trim()} className="tap rounded-2xl bg-white px-4 text-sm font-extrabold text-slate-900 disabled:opacity-40">
              넣기
            </button>
          </div>
        )}
      </div>

      <nav className="flex items-center justify-center gap-2 px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))]" aria-label="편집 도구">
        {toolBtn('crop', '자르기', Crop)}
        <button type="button" onClick={rotate} disabled={!ready} className="tap flex min-w-14 flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-bold text-white/80">
          <RotateCw className="size-5" aria-hidden />
          돌리기
        </button>
        {toolBtn('draw', '그리기', Brush)}
        {toolBtn('text', '글자', Type)}
      </nav>
    </div>
  )
}

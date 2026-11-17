import { Check, RotateCw, X } from 'lucide-react'
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

/** 자를 칸 (사진 크기에 대한 비율 0~1) */
export type CropBox = { x: number; y: number; w: number; h: number }
type Grip = 'move' | 'nw' | 'ne' | 'sw' | 'se'

/** 칸이 이보다 작아지지 않게 (사진의 비율) */
const MIN = 0.08

/** 손잡이를 끈 만큼 칸을 바꾼다 (사진 밖으로 나가지 않게) */
export function dragBox(start: CropBox, grip: Grip, dx: number, dy: number): CropBox {
  let { x, y, w, h } = start
  if (grip === 'move') {
    x = Math.min(1 - w, Math.max(0, x + dx))
    y = Math.min(1 - h, Math.max(0, y + dy))
    return { x, y, w, h }
  }
  let x2 = x + w
  let y2 = y + h
  if (grip === 'nw' || grip === 'sw') x = Math.min(x2 - MIN, Math.max(0, x + dx))
  else x2 = Math.max(x + MIN, Math.min(1, x2 + dx))
  if (grip === 'nw' || grip === 'ne') y = Math.min(y2 - MIN, Math.max(0, y + dy))
  else y2 = Math.max(y + MIN, Math.min(1, y2 + dy))
  return { x, y, w: x2 - x, h: y2 - y }
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('사진을 열지 못했어요'))
    i.src = src
  })
}

const outType = (src: string) => (src.startsWith('data:image/png') ? 'image/png' : 'image/jpeg')

/** 90도 돌린 사진 */
async function rotate(src: string): Promise<string> {
  const img = await load(src)
  const c = document.createElement('canvas')
  c.width = img.naturalHeight
  c.height = img.naturalWidth
  const ctx = c.getContext('2d')!
  ctx.translate(c.width, 0)
  ctx.rotate(Math.PI / 2)
  ctx.drawImage(img, 0, 0)
  return c.toDataURL(outType(src), 0.9)
}

async function crop(src: string, box: CropBox): Promise<string> {
  const img = await load(src)
  const sx = Math.round(box.x * img.naturalWidth)
  const sy = Math.round(box.y * img.naturalHeight)
  const sw = Math.max(1, Math.round(box.w * img.naturalWidth))
  const sh = Math.max(1, Math.round(box.h * img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  return c.toDataURL(outType(src), 0.9)
}

/** 사진을 자리 안에 비율 그대로 가장 크게 */
function fit(size: { w: number; h: number }, room: { w: number; h: number }) {
  const scale = Math.min(room.w / size.w, room.h / size.h)
  return { width: Math.max(1, Math.floor(size.w * scale)), height: Math.max(1, Math.floor(size.h * scale)) }
}

const FULL: CropBox = { x: 0, y: 0, w: 1, h: 1 }
const RATIOS = [
  { name: '자유', r: 0 },
  { name: '1:1', r: 1 },
  { name: '4:3', r: 4 / 3 },
  { name: '16:9', r: 16 / 9 },
]

interface Props {
  src: string
  onDone: (src: string) => void
  onCancel: () => void
}

/** 메모 글 사이 사진 자르기 · 돌리기 (화면 가득) */
export default function ImageCropper({ src, onDone, onCancel }: Props) {
  const [image, setImage] = useState(src)
  const [box, setBox] = useState<CropBox>(FULL)
  const [ratio, setRatio] = useState(0)
  const [busy, setBusy] = useState(false)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null)
  const drag = useRef<{ grip: Grip; x: number; y: number; start: CropBox; id: number } | null>(null)

  useEffect(() => {
    let alive = true
    void load(image).then((i) => alive && setSize({ w: i.naturalWidth, h: i.naturalHeight }))
    return () => {
      alive = false
    }
  }, [image])

  // 사진이 들어갈 자리 크기 (사진을 그 안에 가장 크게)
  useEffect(() => {
    const el = area.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth - 48, h: el.clientHeight - 48 })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 뒤에 있는 화면이 움직이지 않게
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  /** 비율을 고르면 사진 가운데에 가장 크게 */
  function pickRatio(r: number) {
    setRatio(r)
    if (!r || !size) return setBox(FULL)
    const img = size.w / size.h
    const w = r > img ? 1 : r / img
    const h = r > img ? img / r : 1
    setBox({ x: (1 - w) / 2, y: (1 - h) / 2, w, h })
  }

  function start(grip: Grip) {
    return (e: ReactPointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (drag.current) return
      ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
      drag.current = { grip, x: e.clientX, y: e.clientY, start: box, id: e.pointerId }
    }
  }
  function move(e: ReactPointerEvent) {
    const d = drag.current
    const r = frame.current?.getBoundingClientRect()
    if (!d || !r || e.pointerId !== d.id) return
    let next = dragBox(d.start, d.grip, (e.clientX - d.x) / r.width, (e.clientY - d.y) / r.height)
    // 비율을 골랐으면 너비에 맞춰 높이를 맞춘다
    if (ratio && d.grip !== 'move' && size) {
      const h = Math.min((next.w * size.w) / ratio / size.h, d.grip.startsWith('n') ? next.y + next.h : 1 - next.y)
      const w = (h * size.h * ratio) / size.w
      const x = d.grip.endsWith('w') ? next.x + next.w - w : next.x
      const y = d.grip.startsWith('n') ? next.y + next.h - h : next.y
      next = { x, y, w, h }
    }
    setBox(next)
  }
  function end(e: ReactPointerEvent) {
    if (drag.current?.id === e.pointerId) drag.current = null
  }

  async function turn() {
    setBusy(true)
    try {
      setImage(await rotate(image))
      setBox(FULL)
      setRatio(0)
    } finally {
      setBusy(false)
    }
  }

  async function done() {
    setBusy(true)
    try {
      const whole = box.x < 0.001 && box.y < 0.001 && box.w > 0.999 && box.h > 0.999
      onDone(whole ? image : await crop(image, box))
    } finally {
      setBusy(false)
    }
  }

  const pct = (n: number) => `${n * 100}%`
  const grips: { g: Grip; cls: string }[] = [
    { g: 'nw', cls: '-top-2 -left-2 cursor-nwse-resize' },
    { g: 'ne', cls: '-top-2 -right-2 cursor-nesw-resize' },
    { g: 'sw', cls: '-bottom-2 -left-2 cursor-nesw-resize' },
    { g: 'se', cls: '-right-2 -bottom-2 cursor-nwse-resize' },
  ]

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-slate-950 text-white" role="dialog" aria-modal="true" aria-label="사진 자르기">
      <div className="flex items-center gap-2 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2">
        <button type="button" onClick={onCancel} className="tap rounded-full p-2 hover:bg-white/10" aria-label="자르지 않고 닫기">
          <X className="size-6" aria-hidden />
        </button>
        <p className="flex-1 text-center text-base font-bold">사진 자르기</p>
        <button type="button" onClick={() => void done()} disabled={busy} className="flex min-h-10 items-center gap-1 rounded-full bg-white px-4 text-sm font-bold text-slate-900 disabled:opacity-50">
          <Check className="size-4" strokeWidth={3} aria-hidden />
          완료
        </button>
      </div>

      <div ref={area} className="flex min-h-0 flex-1 items-center justify-center" onPointerMove={move} onPointerUp={end} onPointerCancel={end}>
        {size && room && (
          <div ref={frame} className="relative touch-none select-none" style={fit(size, room)}>
            <img src={image} alt="자를 사진" className="block size-full" draggable={false} />
            {/* 잘려 나갈 곳은 어둡게 */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute" style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h), boxShadow: '0 0 0 9999px rgb(2 6 23 / 0.6)' }} />
            </div>
            <div
              className="absolute border-2 border-white"
              style={{ left: pct(box.x), top: pct(box.y), width: pct(box.w), height: pct(box.h) }}
              onPointerDown={start('move')}
              aria-label="자를 칸 (끌어서 옮기기)"
            >
              <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className="border border-white/25" />
                ))}
              </div>
              {grips.map(({ g, cls }) => (
                <span key={g} onPointerDown={start(g)} className={`absolute size-7 rounded-full border-[3px] border-white bg-slate-900/40 ${cls}`} aria-hidden />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-3 pt-2 pb-[max(env(safe-area-inset-bottom),1rem)]">
        {RATIOS.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => pickRatio(r.r)}
            aria-pressed={ratio === r.r}
            className={`min-h-10 rounded-full px-3.5 text-sm font-bold ${ratio === r.r ? 'bg-white text-slate-900' : 'bg-white/10 text-white'}`}
          >
            {r.name}
          </button>
        ))}
        <button type="button" onClick={() => void turn()} disabled={busy} className="ml-2 flex min-h-10 items-center gap-1 rounded-full bg-white/10 px-3.5 text-sm font-bold disabled:opacity-50" aria-label="오른쪽으로 돌리기">
          <RotateCw className="size-4" aria-hidden />
          돌리기
        </button>
      </div>
    </div>,
    document.body,
  )
}

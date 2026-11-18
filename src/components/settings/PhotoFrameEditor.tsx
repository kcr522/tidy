import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { frameRect, MAX_ZOOM, type PhotoFrame } from '../../lib/customize'

type Spot = Pick<PhotoFrame, 'x' | 'y' | 'zoom'>

interface Props {
  /** 원래 사진 주소 */
  src: string
  /** 이미 맞춘 위치 (없으면 가운데, 꽉 채운 크기) */
  frame?: PhotoFrame
  /** 칸 모양 (가로/세로) */
  aspect: number
  /** 칸 위에 겹쳐 보여 줄 것: 구역이면 그 구역 이름(그라데이션 + 제목), 앱 배경이면 카드 */
  kind: { type: 'section'; theme: string; label: string; clear: number } | { type: 'background'; clear: number }
  saving: boolean
  onSave: (spot: Spot) => void
  onReset: () => void
  onClose: () => void
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(1, z))

/**
 * 사진 위치 맞추기 (사용자 요청 2026-11-18)
 * 칸 모양 틀 안에서 사진을 손가락(마우스)으로 끌어 옮기고, 두 손가락 벌리기 · 휠 · 막대로 키운다.
 * 틀 밖으로 나간 부분은 어둡게 보여서 어디가 잘리는지 알 수 있다.
 */
export default function PhotoFrameEditor({ src, frame, aspect, kind, saving, onSave, onReset, onClose }: Props) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  const [spot, setSpot] = useState<Spot>(() => (frame ? { x: frame.x, y: frame.y, zoom: frame.zoom } : { x: 0.5, y: 0.5, zoom: 1 }))
  const [frameW, setFrameW] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const spotRef = useRef(spot)

  useEffect(() => {
    const img = new Image()
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = src
  }, [src])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setFrameW(el.clientWidth))
    ro.observe(el)
    setFrameW(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  /** 사진 밖으로 나가지 않게 가운데를 고친 값 */
  const fix = (s: Spot): Spot => {
    if (!size) return s
    const zoom = clampZoom(s.zoom)
    const r = frameRect(size.w, size.h, { ...s, zoom, aspect })
    return { x: r.cx / size.w, y: r.cy / size.h, zoom }
  }

  /** 바로 다음 손가락 움직임에도 새 값을 쓰도록 ref 도 같이 바꾼다 */
  const put = (next: Spot) => {
    const v = fix(next)
    spotRef.current = v
    setSpot(v)
  }

  // 끌기 · 두 손가락 키우기
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ dist: number; zoom: number } | null>(null)
  const scale = () => {
    if (!size || !frameW) return 1
    return frameW / frameRect(size.w, size.h, { ...spotRef.current, aspect }).sw
  }
  const moveBy = (dx: number, dy: number) => {
    if (!size) return
    const s = scale()
    const r = frameRect(size.w, size.h, { ...spotRef.current, aspect })
    put({ ...spotRef.current, x: (r.cx - dx / s) / size.w, y: (r.cy - dy / s) / size.h })
  }
  const dist = () => {
    const [a, b] = [...pointers.current.values()]
    return Math.hypot(a.x - b.x, a.y - b.y)
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) gesture.current = { dist: dist(), zoom: spotRef.current.zoom }
  }
  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId)
    if (!prev) return
    const next = { x: e.clientX, y: e.clientY }
    pointers.current.set(e.pointerId, next)
    if (pointers.current.size === 1) moveBy(next.x - prev.x, next.y - prev.y)
    else if (pointers.current.size === 2 && gesture.current) {
      // 두 손가락: 벌린 만큼 키우고, 가운데가 움직인 만큼(반) 옮긴다
      put({ ...spotRef.current, zoom: gesture.current.zoom * (dist() / gesture.current.dist) })
      moveBy((next.x - prev.x) / 2, (next.y - prev.y) / 2)
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) gesture.current = null
  }

  // 마우스 휠로 키우기 (컴퓨터)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      put({ ...spotRef.current, zoom: spotRef.current.zoom * Math.exp(-e.deltaY / 500) })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const r = size ? frameRect(size.w, size.h, { ...spot, aspect }) : null
  const s = r && frameW ? frameW / r.sw : 0
  const zoomTo = (z: number) => put({ ...spotRef.current, zoom: z })

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#0b1020] text-[#fff]" role="dialog" aria-modal="true" aria-label="사진 위치 맞추기">
      <div className="flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <button type="button" onClick={onClose} className="tap flex size-10 items-center justify-center rounded-full bg-[#ffffff1a]" aria-label="닫기">
          <X className="size-5" aria-hidden />
        </button>
        <p className="font-bold">사진 위치 맞추기</p>
        <span className="size-10" />
      </div>
      <p className="px-6 text-center text-sm break-keep text-[#ffffffb3]">
        <Move className="mr-1 inline size-4 align-[-3px]" aria-hidden />
        사진을 끌어서 옮기고, 두 손가락으로 벌리거나 아래 막대로 키워요. 밝은 틀 안이 실제로 보이는 곳이에요
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-6">
        <div
          ref={box}
          className="relative touch-none select-none"
          style={{ width: `min(100%, ${(aspect * 58).toFixed(2)}dvh, 520px)`, aspectRatio: String(aspect), cursor: 'grab' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {r && size && s > 0 && (
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{ width: size.w * s, height: size.h * s, left: -r.sx * s, top: -r.sy * s }}
            />
          )}
          {/* 틀 밖은 어둡게, 틀 안에는 실제처럼 색과 글자를 겹쳐 보여 준다 */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl shadow-[0_0_0_9999px_rgb(2_6_23/0.62)] ring-2 ring-[#fff]" />
          {kind.type === 'section' ? (
            <div className={`${kind.theme} pointer-events-none absolute inset-0 overflow-hidden rounded-3xl`}>
              <div className="absolute inset-0 bg-(image:--grad)" style={{ opacity: kind.clear / 100 }} />
              <p className="on-grad absolute top-4 left-5 text-lg font-bold">{kind.label}</p>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
              <div className="absolute inset-0 bg-slate-100" style={{ opacity: kind.clear / 100 }} />
              <div className="absolute inset-x-[8%] top-[12%] h-[14%] rounded-2xl bg-white/70" />
              <div className="absolute inset-x-[8%] top-[30%] h-[22%] rounded-2xl bg-white/70" />
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-6 pb-[max(env(safe-area-inset-bottom),16px)]">
        <div className="mb-4 flex items-center gap-3">
          <button type="button" onClick={() => zoomTo(spot.zoom / 1.15)} className="tap flex size-9 items-center justify-center rounded-full bg-[#ffffff1a]" aria-label="작게">
            <Minus className="size-4" aria-hidden />
          </button>
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.01}
            value={spot.zoom}
            onChange={(e) => zoomTo(Number(e.target.value))}
            className="flex-1 accent-[#fff]"
            aria-label="크기"
          />
          <button type="button" onClick={() => zoomTo(spot.zoom * 1.15)} className="tap flex size-9 items-center justify-center rounded-full bg-[#ffffff1a]" aria-label="크게">
            <Plus className="size-4" aria-hidden />
          </button>
          <span className="w-12 text-right text-sm text-[#ffffffb3]">{Math.round(spot.zoom * 100)}%</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => (frame ? onReset() : put({ x: 0.5, y: 0.5, zoom: 1 }))}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-2xl bg-[#ffffff1a] font-semibold"
          >
            <RotateCcw className="size-4" aria-hidden /> 처음대로
          </button>
          <button type="button" disabled={!size || saving} onClick={() => onSave(fix(spot))} className="min-h-12 flex-[2] rounded-2xl bg-[#fff] font-bold text-[#191f28] disabled:opacity-60">
            {saving ? '맞추는 중…' : '이 위치로 하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

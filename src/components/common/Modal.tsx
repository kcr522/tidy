import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/** 이만큼(px) 넘게 끌어내리거나, 빠르게 휙 내리면 닫는다 */
const CLOSE_DISTANCE = 110
const CLOSE_SPEED = 0.6
const CLOSE_MS = 200

/**
 * 공통 모달
 * - 폰: 아래에서 올라오는 시트. 손가락으로 아래로 끌어내리면 닫힌다 (X 를 누르지 않아도 된다)
 * - 컴퓨터: 가운데 창
 * Esc 키나 바깥을 누르면 닫힌다.
 */
export default function Modal({ open, title, onClose, children }: ModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const [dy, setDy] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [closing, setClosing] = useState(false)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    setDy(0)
    setDragging(false)
    setClosing(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // 아래로 끌어내려 닫기 (폰). 안쪽 내용이 맨 위까지 올라가 있을 때만 시트가 끌려 내려간다
  useEffect(() => {
    const sheet = sheetRef.current
    if (!open || !sheet) return
    let start: { x: number; y: number; t: number } | null = null
    let state: 'idle' | 'drag' | 'skip' = 'idle'
    let last = 0

    const scrolledInside = (target: EventTarget | null) => {
      for (let el = target as HTMLElement | null; el && el !== sheet.parentElement; el = el.parentElement) {
        if (el.scrollTop > 0) return true
      }
      return false
    }
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.matchMedia('(min-width: 768px)').matches) return
      const t = e.touches[0]
      start = { x: t.clientX, y: t.clientY, t: Date.now() }
      state = scrolledInside(e.target) ? 'skip' : 'idle'
      last = 0
    }
    const onMove = (e: TouchEvent) => {
      if (!start || state === 'skip') return
      const t = e.touches[0]
      const ddx = t.clientX - start.x
      const ddy = t.clientY - start.y
      if (state === 'idle') {
        if (Math.abs(ddy) < 8 && Math.abs(ddx) < 8) return
        // 위로 밀거나 옆으로 밀면 평소처럼 스크롤
        if (ddy <= 0 || Math.abs(ddx) > Math.abs(ddy)) {
          state = 'skip'
          return
        }
        state = 'drag'
        setDragging(true)
      }
      e.preventDefault()
      last = Math.max(0, ddy)
      setDy(last)
    }
    const onEnd = () => {
      if (state === 'drag' && start) {
        const speed = last / Math.max(1, Date.now() - start.t)
        setDragging(false)
        if (last > CLOSE_DISTANCE || (last > 40 && speed > CLOSE_SPEED)) {
          setClosing(true)
          window.setTimeout(() => closeRef.current(), CLOSE_MS)
        } else {
          setDy(0)
        }
      }
      start = null
      state = 'idle'
    }
    sheet.addEventListener('touchstart', onStart, { passive: true })
    sheet.addEventListener('touchmove', onMove, { passive: false })
    sheet.addEventListener('touchend', onEnd)
    sheet.addEventListener('touchcancel', onEnd)
    return () => {
      sheet.removeEventListener('touchstart', onStart)
      sheet.removeEventListener('touchmove', onMove)
      sheet.removeEventListener('touchend', onEnd)
      sheet.removeEventListener('touchcancel', onEnd)
    }
  }, [open])

  if (!open) return null

  const moved = closing || dy > 0
  const fade = closing ? 0 : Math.max(0.3, 1 - dy / 400)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        style={moved ? { opacity: fade, transition: dragging ? 'none' : `opacity ${CLOSE_MS}ms ease-out` } : undefined}
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        className="relative max-h-[90dvh] w-full overflow-y-auto overscroll-y-contain rounded-t-[28px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl md:max-w-md md:rounded-3xl md:p-6"
        style={{ transform: closing ? 'translateY(100%)' : dy > 0 ? `translateY(${dy}px)` : undefined, transition: dragging ? 'none' : `transform ${CLOSE_MS}ms ease-out` }}
      >
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-extrabold tracking-tight">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200" aria-label="닫기">
            <X className="size-4" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'

interface ModalProps {
  open: boolean
  title: string
  onClose: () => void
  children: ReactNode
}

/**
 * 공통 모달
 * - 폰: 아래에서 올라오는 시트
 * - 컴퓨터: 가운데 창
 * Esc 키나 바깥을 누르면 닫힌다.
 */
export default function Modal({ open, title, onClose, children }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] bg-white px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-xl md:max-w-md md:rounded-3xl md:p-6">
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

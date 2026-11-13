import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { dayTitle } from '../../lib/calendar'
import { STICKER_EMOJIS } from '../../repositories/stickerRepo'

interface Props {
  date: string
  current?: string
  /** 고른 이모티콘 (null = 떼기) */
  onPick: (emoji: string | null) => void
  onClose: () => void
}

/** 달력 아래에 펼쳐지는 이모티콘 스티커 고르기 */
export default function StickerPanel({ date, current, onPick, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  // 펼치면 아래 추가 버튼에 가리지 않게 보이는 곳으로 내린다
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }, [date])
  return (
    <div ref={ref} className="mt-2 scroll-mb-28 rounded-2xl bg-slate-50 p-3" role="region" aria-label="스티커 고르기">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-bold">{dayTitle(date)}에 붙일 스티커</p>
        {current && (
          <button type="button" onClick={() => onPick(null)} className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500 shadow-card">
            떼기
          </button>
        )}
        <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 text-slate-500 shadow-card" aria-label="닫기">
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {STICKER_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            aria-label={`${e} 붙이기`}
            aria-pressed={current === e}
            className={`flex aspect-square items-center justify-center rounded-xl text-[24px] transition active:scale-90 ${current === e ? 'bg-brand-100 ring-2 ring-brand-500/60' : 'hover:bg-white'}`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  )
}

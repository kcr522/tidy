import { Repeat2, X } from 'lucide-react'
import type { Bookmark } from '../../db/types'
import { savedAgoLabel } from '../../lib/scrap/resurface'
import { domainOf } from '../../lib/validate'
import SourceBadge from './SourceBadge'

interface ResurfaceCardProps {
  item: Bookmark
  today: string
  /** 링크 열기 (본 것으로 표시) */
  onOpen: (b: Bookmark) => void
  /** 일주일 뒤에 다시 */
  onLater: (b: Bookmark) => void
  /** 안 봐도 돼요: 본 것으로 표시 */
  onDone: (b: Bookmark) => void
  /** 대시보드 카드 안에 넣을 때 (그림자 없이) */
  inset?: boolean
}

/** "다시 볼 스크랩" 한 줄: 저장만 하고 안 본 스크랩을 하나 꺼내 보여 준다 (사용자 요청 2026-11-27) */
export default function ResurfaceCard({ item, today, onOpen, onLater, onDone, inset = false }: ResurfaceCardProps) {
  return (
    <div className={`relative rounded-2xl px-3.5 py-3 ${inset ? 'bg-brand-50 ring-1 ring-brand-500/40' : 'bg-grad-soft shadow-card'}`} role="note" aria-label="다시 볼 스크랩">
      <button type="button" onClick={() => onDone(item)} className="tap absolute top-1.5 right-1.5 flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-white/70" aria-label="이 스크랩은 안 봐도 돼요" title="안 봐도 돼요 (본 것으로 표시)">
        <X className="size-4" aria-hidden />
      </button>
      <p className="flex items-center gap-1.5 pr-8 text-xs font-bold text-brand-700">
        <Repeat2 className="size-4 shrink-0" aria-hidden />
        <span className="truncate">다시 볼 스크랩 · {savedAgoLabel(item, today)}</span>
      </p>
      <button type="button" onClick={() => onOpen(item)} className="mt-1 block w-full min-w-0 text-left">
        <span className="line-clamp-2 text-sm font-semibold break-keep text-slate-800 hover:text-brand-700">{item.title || item.url}</span>
        <span className="mt-0.5 flex items-center gap-1.5">
          <SourceBadge source={item.source} />
          <span className="truncate text-xs text-slate-400">{item.siteName || domainOf(item.url)}</span>
        </span>
      </button>
      <div className="mt-2 flex gap-1.5">
        <button type="button" onClick={() => onOpen(item)} className="tap rounded-full bg-grad on-grad px-3 py-1.5 text-xs font-bold shadow-sm">
          지금 볼래요
        </button>
        <button type="button" onClick={() => onLater(item)} className="tap rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-600 shadow-sm">
          일주일 뒤에
        </button>
      </div>
    </div>
  )
}

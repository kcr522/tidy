import { Check, Ellipsis, ExternalLink, Plus } from 'lucide-react'
import type { Bookmark } from '../../db/types'
import { toDateKey } from '../../lib/date'
import { formatDateLabel } from '../../lib/format'
import { domainOf } from '../../lib/validate'

interface BookmarkCardProps {
  bookmark: Bookmark
  onOpen: () => void
  onToggleRead: () => void
  onEdit: () => void
  /** 이 스크랩으로 만든 할 일이 있는가 (FR-041) */
  converted: boolean
  onConvert: () => void
  onViewTodo: () => void
}

/** 스크랩 카드 (FR-034~036) */
export default function BookmarkCard({ bookmark, onOpen, onToggleRead, onEdit, converted, onConvert, onViewTodo }: BookmarkCardProps) {
  const read = bookmark.isRead === 1
  return (
    <article className={`relative flex flex-col overflow-hidden card p-5 ${read ? 'opacity-70' : ''}`}>
      {!read && <span className="absolute inset-y-0 left-0 w-1.5 bg-grad" aria-hidden />}
      <div className="mb-2 flex items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${read ? 'bg-slate-300' : 'bg-grad'}`} aria-hidden />
        <button type="button" onClick={onOpen} className="tap min-w-0 flex-1 text-left">
          <h3 className="line-clamp-2 text-[16px] font-bold text-slate-900 hover:text-brand-600">{bookmark.title}</h3>
          <p className="truncate text-xs text-slate-400">{domainOf(bookmark.url)}</p>
        </button>
        <button type="button" onClick={onEdit} className="tap -mt-1 -mr-1 rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label={`${bookmark.title} 수정`}>
          <Ellipsis className="size-5" aria-hidden />
        </button>
      </div>
      {bookmark.memo && <p className="mb-3 line-clamp-2 pl-4 text-sm text-slate-600">{bookmark.memo}</p>}
      <div className="mb-3 pl-4 text-xs">
        {converted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 font-bold text-brand-600">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            할 일 등록됨 ·
            <button type="button" onClick={onViewTodo} className="tap underline underline-offset-2">
              할 일 보기
            </button>
          </span>
        ) : (
          <button type="button" onClick={onConvert} className="tap inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-200">
            <Plus className="size-3.5" strokeWidth={3} aria-hidden />
            할 일로 전환
          </button>
        )}
      </div>
      <div className="mt-auto flex items-center gap-2 pl-4 text-xs">
        <span className="text-slate-400">{formatDateLabel(toDateKey(new Date(bookmark.createdAt)))}</span>
        <button
          type="button"
          role="switch"
          aria-checked={read}
          onClick={onToggleRead}
          className={`tap ml-auto rounded-full px-3 py-1.5 font-bold ${read ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-600'}`}
        >
          {read ? '읽음' : '안 읽음'}
        </button>
        <button type="button" onClick={onOpen} className="tap inline-flex items-center gap-1 rounded-full bg-grad on-grad px-3.5 py-1.5 font-bold">
          열기
          <ExternalLink className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
    </article>
  )
}

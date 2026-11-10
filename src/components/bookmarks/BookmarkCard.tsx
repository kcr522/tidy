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
    <article className={`flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 ${read ? 'opacity-70' : ''}`}>
      <div className="mb-2 flex items-start gap-2">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${read ? 'bg-slate-300' : 'bg-brand-500'}`} aria-hidden />
        <button type="button" onClick={onOpen} className="tap min-w-0 flex-1 text-left">
          <h3 className="line-clamp-2 font-semibold text-slate-900 hover:text-brand-700">{bookmark.title}</h3>
          <p className="truncate text-xs text-slate-400">{domainOf(bookmark.url)}</p>
        </button>
        <button type="button" onClick={onEdit} className="tap -mt-1 -mr-1 rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100" aria-label={`${bookmark.title} 수정`}>
          ⋯
        </button>
      </div>
      {bookmark.memo && <p className="mb-3 line-clamp-2 pl-4 text-sm text-slate-600">{bookmark.memo}</p>}
      <div className="mb-3 pl-4 text-xs">
        {converted ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 font-semibold text-brand-700">
            ✓ 할 일 등록됨 ·
            <button type="button" onClick={onViewTodo} className="tap underline underline-offset-2">
              할 일 보기
            </button>
          </span>
        ) : (
          <button type="button" onClick={onConvert} className="tap rounded-full px-2.5 py-1 font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-50">
            + 할 일로 전환
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
          className={`tap ml-auto rounded-full px-2.5 py-1 font-semibold ${read ? 'bg-slate-100 text-slate-500' : 'bg-brand-50 text-brand-700'}`}
        >
          {read ? '읽음' : '안 읽음'}
        </button>
        <button type="button" onClick={onOpen} className="tap rounded-full bg-slate-800 px-3 py-1 font-semibold text-white">
          열기 ↗
        </button>
      </div>
    </article>
  )
}

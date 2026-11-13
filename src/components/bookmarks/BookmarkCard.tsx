import { Camera, Check, ChevronDown, Ellipsis, ExternalLink, Images, Play, Plus } from 'lucide-react'
import { useState } from 'react'
import type { Bookmark } from '../../db/types'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { toDateKey } from '../../lib/date'
import { formatDateLabel } from '../../lib/format'
import { detectSource } from '../../lib/scrap/link'
import { domainOf } from '../../lib/validate'
import AiSummaryButton from './AiSummaryButton'
import SourceBadge from './SourceBadge'

interface BookmarkCardProps {
  bookmark: Bookmark
  /** 대표 사진 (썸네일, 없으면 첫 캡처) */
  cover?: Blob
  /** 같이 저장한 캡처(사진·영상) 개수 */
  captures: number
  categoryName?: string
  onOpen: () => void
  onDetail: () => void
  onEdit: () => void
  /** 이 스크랩으로 만든 할 일이 있는가 (FR-041) */
  converted: boolean
  onConvert: () => void
  onViewTodo: () => void
}

/** 스크랩 카드 (FR-034~036): 썸네일, 출처, 카테고리, AI 요약 */
export default function BookmarkCard({ bookmark, cover, captures, categoryName, onOpen, onDetail, onEdit, converted, onConvert, onViewTodo }: BookmarkCardProps) {
  const read = bookmark.isRead === 1
  const coverUrl = useBlobUrl(cover)
  const [expanded, setExpanded] = useState(false)
  const source = bookmark.source ?? detectSource(bookmark.url)

  return (
    <article className={`relative flex flex-col overflow-hidden card ${read ? 'opacity-75' : ''}`}>
      {coverUrl ? (
        <button type="button" onClick={onDetail} className="tap relative block aspect-[16/9] w-full overflow-hidden bg-slate-100" aria-label={`${bookmark.title} 자세히 보기`}>
          <img src={coverUrl} alt="" className="size-full object-cover object-top" loading="lazy" />
          <span className="absolute top-2.5 left-2.5">
            <SourceBadge source={source} />
          </span>
          {bookmark.isVideo === 1 && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-black/45 backdrop-blur-sm">
                <Play className="ml-0.5 size-5 fill-white text-white" aria-label="동영상" />
              </span>
            </span>
          )}
          {captures > 0 && (
            <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold text-white">
              <Camera className="size-3" aria-hidden />
              캡처 {captures}
            </span>
          )}
        </button>
      ) : null}
      {!read && <span className="absolute inset-y-0 left-0 w-1.5 bg-grad" aria-hidden />}

      <div className="flex flex-1 flex-col p-5 pt-4">
        <div className="mb-1.5 flex items-center gap-1.5 pl-1 text-xs">
          {!coverUrl && <SourceBadge source={source} />}
          <span className={`rounded-full px-2 py-0.5 font-bold ${categoryName ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>{categoryName ?? '미분류'}</span>
          <span className="min-w-0 truncate text-slate-400">{bookmark.siteName ?? domainOf(bookmark.url)}</span>
          <button type="button" onClick={onEdit} className="tap -my-1 -mr-2 ml-auto rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label={`${bookmark.title} 수정`}>
            <Ellipsis className="size-5" aria-hidden />
          </button>
        </div>

        <button type="button" onClick={onOpen} className="tap mb-1 pl-1 text-left">
          <h3 className="line-clamp-2 text-[16px] font-bold text-slate-900 hover:text-brand-600">{bookmark.title}</h3>
        </button>
        {bookmark.memo && <p className="mb-2 line-clamp-2 pl-1 text-sm text-slate-600">{bookmark.memo}</p>}
        {/* AI 정리 전에는 서버가 읽어 온 게시글 본문(캡션)을 두 줄만 */}
        {!bookmark.summary && bookmark.description && <p className="mb-2 line-clamp-5 pl-1 text-[13px] break-keep whitespace-pre-line text-slate-500">{bookmark.description}</p>}

        {bookmark.summary && (
          <div className="mb-3 rounded-2xl bg-grad-soft px-3.5 py-3 text-[13px] leading-relaxed text-slate-700">
            <p className={`whitespace-pre-line break-keep ${expanded ? '' : 'line-clamp-3'}`}>{bookmark.summary}</p>
            <button type="button" onClick={() => setExpanded((v) => !v)} className="tap mt-1 inline-flex items-center gap-0.5 text-xs font-bold text-brand-700">
              {expanded ? '접기' : '더 보기'}
              <ChevronDown className={`size-3.5 transition ${expanded ? 'rotate-180' : ''}`} aria-hidden />
            </button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-1.5 pl-1 text-xs">
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
          <button type="button" onClick={onDetail} className="tap inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-600 hover:bg-slate-200">
            <Images className="size-3.5" aria-hidden />
            {captures > 0 ? `캡처 ${captures}` : '캡처 · 자세히'}
          </button>
        </div>

        <div className="mt-auto flex items-center gap-2 pl-1 text-xs">
          <AiSummaryButton bookmark={bookmark} categoryName={categoryName} onDone={() => setExpanded(true)} />
          <span className="min-w-0 truncate whitespace-nowrap text-slate-400">{formatDateLabel(toDateKey(new Date(bookmark.createdAt)))}</span>
          {/* 읽음 표시는 '열기'를 누르면 저절로 바뀐다 (따로 누르는 버튼은 없앴다) */}
          <button type="button" onClick={onOpen} className="tap ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-grad on-grad px-3.5 py-1.5 font-bold whitespace-nowrap">
            열기
            <ExternalLink className="size-3.5" strokeWidth={2.5} aria-hidden />
          </button>
        </div>
      </div>
    </article>
  )
}

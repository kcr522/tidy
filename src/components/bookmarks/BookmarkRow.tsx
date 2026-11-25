import { ExternalLink, Link2, Play } from 'lucide-react'
import type { Bookmark } from '../../db/types'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { toDateKey } from '../../lib/date'
import { detectSource, SOURCE_LABEL, type LinkSource } from '../../lib/scrap/link'
import { domainOf } from '../../lib/validate'
import Marked from '../common/Marked'

interface Props {
  bookmark: Bookmark
  cover?: Blob
  categoryName?: string
  onOpen: () => void
  onDetail: () => void
  /** 검색 중이면: 찾은 글자에 형광펜 + 어디서 찾았는지 한 줄 */
  search?: { terms: string[]; field: string; snippet: string }
}

const DOT: Record<LinkSource, string> = {
  instagram: 'bg-[linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)]',
  naver: 'bg-[#03c75a]',
  x: 'bg-slate-900',
  youtube: 'bg-[#ff0033]',
  web: 'bg-slate-300',
}

/** "11.16" 처럼 짧은 날짜 (올해가 아니면 "25.11.16") */
function shortDate(iso: string): string {
  const [y, m, d] = toDateKey(new Date(iso)).split('-')
  return `${y === String(new Date().getFullYear()) ? '' : `${y.slice(2)}.`}${Number(m)}.${Number(d)}`
}

/** 스크랩 목록 보기의 한 줄: 작은 썸네일 + 제목 + 출처 · 카테고리 + 날짜 (파일 목록처럼 한눈에) */
export default function BookmarkRow({ bookmark, cover, categoryName, onOpen, onDetail, search }: Props) {
  const url = useBlobUrl(cover)
  const source = (bookmark.source ?? detectSource(bookmark.url)) as LinkSource
  const read = bookmark.isRead === 1
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <button type="button" onClick={onDetail} className="tap flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`${bookmark.title} 자세히 보기`}>
        <span className="relative size-11 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {url ? (
            <img src={url} alt="" className="size-full object-cover object-top" loading="lazy" />
          ) : bookmark.isVideo === 1 ? (
            <Play className="m-auto mt-3 size-5 fill-slate-400 text-slate-400" aria-label="동영상" />
          ) : (
            <Link2 className="m-auto mt-3 size-5 text-slate-400" aria-hidden />
          )}
          {url && bookmark.isVideo === 1 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/20">
              <Play className="size-3.5 fill-white text-white" aria-label="동영상" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`flex items-center gap-1.5 text-[15px] leading-snug ${read ? 'font-medium text-slate-500' : 'font-bold text-slate-900'}`}>
            {!read && <span className="size-1.5 shrink-0 rounded-full bg-grad" aria-label="안 읽음" />}
            <span className="truncate">{search ? <Marked text={bookmark.title} terms={search.terms} /> : bookmark.title}</span>
          </span>
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className={`size-2 shrink-0 rounded-full ${DOT[source] ?? DOT.web}`} aria-hidden />
            <span className="truncate">
              {source !== 'web' ? SOURCE_LABEL[source] : domainOf(bookmark.url)}
              {categoryName ? ` · ${categoryName}` : ''}
            </span>
          </span>
          {search && search.field !== '제목' && search.snippet && (
            <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-600">
              <span className="mr-1 rounded bg-slate-100 px-1 py-px text-[11px] font-bold text-slate-500">{search.field}</span>
              <Marked text={search.snippet} terms={search.terms} />
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-slate-400 tabular-nums">{shortDate(bookmark.createdAt)}</span>
      </button>
      <button type="button" onClick={onOpen} className="tap shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100" aria-label={`${bookmark.title} 열기`}>
        <ExternalLink className="size-4" aria-hidden />
      </button>
    </li>
  )
}

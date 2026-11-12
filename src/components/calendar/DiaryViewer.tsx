import { Clock, FileText, PenLine, Star } from 'lucide-react'
import type { Diary } from '../../db/types'
import { extLabel, formatBytes } from '../../lib/attachments'
import { diaryPhotos, sortByTime } from '../../lib/diaryPhotos'
import { openAttachment } from '../../platform/openAttachment'

/** 캘린더에서 누른 날의 일기를 읽기 전용으로 보여 준다. 고치려면 일기 화면으로 */
export default function DiaryViewer({ diary, onEdit, onCover }: { diary: Diary; onEdit: () => void; onCover?: (src: string) => void }) {
  const photos = sortByTime(diaryPhotos(diary))
  return (
    <div className="space-y-4">
      {diary.text && <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-slate-800">{diary.text}</p>}
      {photos.length > 0 && (
        <ul className="space-y-3">
          {photos.map((p, i) => (
            <li key={i}>
              {p.time && (
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">
                  <Clock className="size-3" aria-hidden />
                  {p.time}
                </span>
              )}
              <div className="relative">
                <img src={p.src} alt={p.note || `${i + 1}번째 사진`} className="max-h-80 w-full rounded-2xl bg-slate-100 object-contain" />
                {/* 대표 사진: 일기 달력 칸에 크게 보일 사진 (사진이 두 장 이상일 때만 고른다) */}
                {photos.length > 1 &&
                  (p.src === diary.photo ? (
                    <span className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-pink-500 px-2.5 py-1 text-xs font-bold text-white shadow">
                      <Star className="size-3.5 fill-current" aria-hidden />
                      대표 사진
                    </span>
                  ) : (
                    onCover && (
                      <button
                        type="button"
                        onClick={() => onCover(p.src)}
                        className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-slate-900/60 px-2.5 py-1 text-xs font-bold text-white"
                      >
                        <Star className="size-3.5" aria-hidden />
                        대표로
                      </button>
                    )
                  ))}
              </div>
              {p.note && <p className="mt-1 text-sm text-slate-500">{p.note}</p>}
            </li>
          ))}
        </ul>
      )}
      {!!diary.attachments?.length && (
        <ul className="space-y-1.5" aria-label="첨부한 파일">
          {diary.attachments.map((a, i) => (
            <li key={i}>
              <button type="button" onClick={() => void openAttachment(a).catch(() => undefined)} className="flex w-full items-center gap-2.5 rounded-xl bg-slate-100 px-2 py-1.5 text-left">
                <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-brand-600">
                  <FileText className="size-4" aria-hidden />
                  <span className="text-[8px] leading-none font-bold">{extLabel(a.name)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{a.name}</span>
                  <span className="block text-xs text-slate-500">{formatBytes(a.size)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onEdit} className="flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-100 text-sm font-bold text-slate-600">
        <PenLine className="size-4" aria-hidden />
        일기 고치기
      </button>
    </div>
  )
}

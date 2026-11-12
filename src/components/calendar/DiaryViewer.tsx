import { Clock, PenLine } from 'lucide-react'
import type { Diary } from '../../db/types'
import { diaryPhotos, sortByTime } from '../../lib/diaryPhotos'

/** 캘린더에서 누른 날의 일기를 읽기 전용으로 보여 준다. 고치려면 일기 화면으로 */
export default function DiaryViewer({ diary, onEdit }: { diary: Diary; onEdit: () => void }) {
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
              <img src={p.src} alt={p.note || `${i + 1}번째 사진`} className="max-h-80 w-full rounded-2xl bg-slate-100 object-contain" />
              {p.note && <p className="mt-1 text-sm text-slate-500">{p.note}</p>}
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

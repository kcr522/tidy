import { BookHeart } from 'lucide-react'
import type { Diary } from '../../db/types'
import { dayTitle } from '../../lib/calendar'

interface Props {
  grid: string[]
  month: string
  today: string
  selected: string
  diaries: Map<string, Diary>
  onPick: (date: string) => void
  onOpen: (diary: Diary) => void
}

/**
 * 일기 달력: 일기 쓴 날만 사진이나 색으로 꽉 채워 보여 준다 (사용자 요청 2026-11-12)
 * 일기 쓴 날을 누르면 그 일기가 열린다.
 */
export default function DiaryMonth({ grid, month, today, selected, diaries, onPick, onOpen }: Props) {
  const count = grid.filter((d) => d.slice(0, 7) === month && diaries.has(d)).length
  return (
    <>
      <div role="grid" className="grid grid-cols-7 gap-1">
        {grid.map((d, i) => {
          const inMonth = d.slice(0, 7) === month
          const diary = diaries.get(d)
          const isSel = d === selected
          const isToday = d === today
          const c = i % 7
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={isSel}
              aria-label={`${dayTitle(d)}${isToday ? ', 오늘' : ''}${diary ? ', 일기 보기' : ''}`}
              onClick={() => {
                onPick(d)
                if (diary) onOpen(diary)
              }}
              style={diary && !diary.photo ? { background: diary.color } : undefined}
              className={`relative flex aspect-[4/5] flex-col overflow-hidden rounded-xl p-1 text-left transition-colors ${
                isSel ? 'ring-2 ring-brand-500/70 ring-inset' : ''
              } ${diary ? (inMonth ? '' : 'opacity-40') : inMonth ? 'bg-slate-50' : ''}`}
            >
              {diary?.photo && <img src={diary.photo} alt="" className="absolute inset-0 size-full object-cover" aria-hidden />}
              {diary?.photo && <span className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-black/45 to-transparent" aria-hidden />}
              <span
                className={`relative flex size-6 items-center justify-center rounded-full text-[13px] font-bold ${
                  isToday
                    ? 'bg-grad on-grad'
                    : diary?.photo
                      ? 'text-white'
                      : diary
                        ? 'text-slate-800'
                        : !inMonth
                          ? 'text-slate-300'
                          : c === 0
                            ? 'text-red-400'
                            : c === 6
                              ? 'text-sky-500'
                              : 'text-slate-700'
                }`}
              >
                {Number(d.slice(8))}
              </span>
              {diary && !diary.photo && diary.text && (
                <span className="relative mt-0.5 line-clamp-2 text-[10px] leading-tight font-medium break-all text-slate-700 sm:text-[11px]">{diary.text}</span>
              )}
              {(diary?.photos?.length ?? 0) > 1 && (
                <span className="absolute right-1 bottom-1 rounded-full bg-black/55 px-1.5 py-px text-[10px] font-bold text-white">{diary!.photos!.length}</span>
              )}
            </button>
          )
        })}
      </div>
      <p className="mt-3 flex items-center gap-1.5 px-2 text-xs font-semibold text-slate-500">
        <BookHeart className="size-3.5 text-pink-500" aria-hidden />
        {count ? `이번 달 일기 ${count}일 · 날짜를 누르면 그날 일기가 열려요` : '이번 달은 아직 일기가 없어요'}
      </p>
    </>
  )
}

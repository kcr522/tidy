import { Bell, Check, FileText, Link2, Play, Repeat } from 'lucide-react'
import { useState } from 'react'
import type { Attachment, Todo } from '../../db/types'
import { extLabel, isImage, isVideo } from '../../lib/attachments'
import { formatDateLabel } from '../../lib/format'
import { isOverdue } from '../../lib/summary'
import { timeLabel } from '../../lib/todoAlarms'
import { repeatEndLabel, repeatLabel } from '../../lib/todoRepeat'
import { openAttachment } from '../../platform/openAttachment'
import { ImageViewer } from '../common/AttachmentField'
import { useToast } from '../common/Toast'
import { PRIORITY_LABEL } from './priority'

/** 목록에서 작은 그림으로 보여 줄 사진 수 (넘으면 +N) */
const MAX_THUMBS = 4

interface TodoItemProps {
  todo: Todo
  today: string
  onToggle: () => void
  onSelect: () => void
  /** 스크랩에서 만든 할 일이면 원래 링크 열기 (FR-043) */
  onOpenLink?: () => void
}

/** 할 일 한 줄: 체크박스, 취소선, 중요도 색, 기한 지남 (FR-021, FR-025) */
export default function TodoItem({ todo, today, onToggle, onSelect, onOpenLink }: TodoItemProps) {
  const done = todo.isCompleted === 1
  const overdue = isOverdue(todo, today)
  const p = PRIORITY_LABEL[todo.priority]
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const toast = useToast()
  const memo = todo.memo?.trim()
  const files = todo.attachments ?? []
  const pics = files.filter((a) => isImage(a) || isVideo(a))
  const docs = files.filter((a) => !isImage(a) && !isVideo(a))
  const hasExtras = !!memo || files.length > 0

  return (
    <li className="flex items-start gap-1 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${todo.title} ${done ? '완료 취소' : '완료'}`}
        onClick={onToggle}
        className="flex min-h-12 shrink-0 items-center px-3"
      >
        <span
          className={`flex size-6 items-center justify-center rounded-full transition-all ${
            done ? 'bg-check scale-100' : 'border-2 border-slate-300 bg-white'
          }`}
        >
          {done && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
        </span>
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          {/* 제목은 자르지 않고 다 보여 준다: 한 줄에 다 안 들어가면 제목이 줄을 바꾸고, 반복 · 기한 표시는 아래 줄 오른쪽으로 내려간다 */}
          <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 py-3 text-left">
            <span className="flex min-w-0 flex-auto items-start gap-2">
              <span className={`mt-[0.45rem] size-2 shrink-0 rounded-full ${p.dot}`} title={`중요도 ${p.label}`} aria-label={`중요도 ${p.label}`} />
              <span className={`min-w-0 flex-1 text-[15px] leading-snug break-words break-keep ${done ? 'text-slate-400 line-through' : 'font-medium text-slate-800'}`}>{todo.title}</span>
            </span>
            <span className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1 empty:hidden">
              {todo.repeat && !done && (
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-slate-500" title={repeatEndLabel(todo.repeat) ? `반복 · ${repeatEndLabel(todo.repeat)}` : '반복'}>
                  <Repeat className="size-3.5" aria-hidden />
                  <span className="sr-only">반복</span>
                  {repeatLabel(todo.repeat)}
                </span>
              )}
              {todo.remindAt && todo.dueDate && !done && (
                <span className="flex shrink-0 items-center gap-0.5 text-xs font-semibold text-brand-600" title="알림">
                  <Bell className="size-3.5" aria-hidden />
                  <span className="sr-only">알림</span>
                  {timeLabel(todo.remindAt)}
                </span>
              )}
              {overdue && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-expense">기한 지남</span>}
              {todo.dueDate && !overdue && (
                <span className={`shrink-0 text-xs ${todo.dueDate === today ? 'font-bold text-brand-600' : 'text-slate-400'}`}>
                  {todo.dueDate === today ? '오늘' : formatDateLabel(todo.dueDate)}
                </span>
              )}
              {overdue && todo.dueDate && <span className="shrink-0 text-xs text-red-400">{formatDateLabel(todo.dueDate)}</span>}
            </span>
          </button>
          {onOpenLink && (
            <button
              type="button"
              onClick={onOpenLink}
              className="tap shrink-0 rounded-full p-2 text-slate-400 hover:bg-brand-50 hover:text-brand-600"
              aria-label={`${todo.title} 링크 열기`}
              title="링크 열기"
            >
              <Link2 className="size-[18px]" aria-hidden />
            </button>
          )}
        </div>
        {hasExtras && (
          <div className={`-mt-2 space-y-1.5 pb-3 pl-4 ${done ? 'opacity-60' : ''}`}>
            {memo && (
              <button type="button" onClick={onSelect} className="block w-full text-left" aria-label={`${todo.title} 메모: ${memo}`}>
                <span className="line-clamp-2 text-xs leading-relaxed whitespace-pre-line text-slate-500">{memo}</span>
              </button>
            )}
            {files.length > 0 && (
              <ul className="flex flex-wrap items-center gap-1.5" aria-label="참고 사진 · 파일">
                {pics.slice(0, MAX_THUMBS).map((a, i) => (
                  <li key={`p${i}`}>
                    <button type="button" onClick={() => setViewing(a)} className="relative block size-11 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200/70" aria-label={`${a.name} 크게 보기`}>
                      {isVideo(a) ? (
                        <>
                          <video src={a.src} muted playsInline preload="metadata" className="size-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <Play className="size-3.5 fill-white text-white drop-shadow" aria-hidden />
                          </span>
                        </>
                      ) : (
                        <img src={a.src} alt="" loading="lazy" className="size-full object-cover" />
                      )}
                    </button>
                  </li>
                ))}
                {pics.length > MAX_THUMBS && (
                  <li>
                    <button type="button" onClick={onSelect} className="flex size-11 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500" aria-label={`사진 ${pics.length - MAX_THUMBS}개 더 보기`}>
                      +{pics.length - MAX_THUMBS}
                    </button>
                  </li>
                )}
                {docs.map((a, i) => (
                  <li key={`d${i}`} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => void openAttachment(a).catch(() => toast('파일을 열지 못했어요', 'error'))}
                      className="flex h-7 max-w-[10rem] items-center gap-1 rounded-full bg-slate-100 pr-2.5 pl-2 text-xs font-medium text-slate-600"
                      title={a.name}
                    >
                      <FileText className="size-3.5 shrink-0 text-brand-600" aria-hidden />
                      <span className="truncate">{a.name}</span>
                      <span className="sr-only">{extLabel(a.name)} 파일 열기</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {viewing && <ImageViewer src={viewing.src} alt={viewing.name} video={isVideo(viewing)} onClose={() => setViewing(null)} />}
    </li>
  )
}

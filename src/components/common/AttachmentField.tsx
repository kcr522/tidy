import { CloudOff, FileText, Paperclip, Play, Upload, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Attachment } from '../../db/types'
import { useFileDrop } from '../../hooks/useFileDrop'
import { MAX_ATTACHMENTS, MAX_ATTACHMENT_BYTES, extLabel, fileToAttachment, formatBytes, isImage, isVideo, syncsToCloud } from '../../lib/attachments'
import { shrinkImage } from '../../lib/image'
import { openAttachment } from '../../platform/openAttachment'
import { useToast } from './Toast'

/** 고른(또는 끌어다 놓은) 파일들을 첨부로 바꾼다. 넣지 못한 것은 이유를 모아 돌려준다 */
export async function filesToAttachments(files: File[], room: number, maxBytes = MAX_ATTACHMENT_BYTES): Promise<{ added: Attachment[]; error?: string }> {
  const added: Attachment[] = []
  let error: string | undefined
  for (const file of files.slice(0, Math.max(0, room))) {
    try {
      added.push(await fileToAttachment(file, (f) => shrinkImage(f, 1600, 0.85), maxBytes))
    } catch (e) {
      error = e instanceof Error && e.name === 'AttachmentTooBigError' ? e.message : `${file.name}: 넣지 못했어요`
    }
  }
  if (files.length > room) error = `첨부는 ${MAX_ATTACHMENTS}개까지라서 ${files.length - room}개는 빼고 넣었어요`
  return { added, error }
}

/** 화면에 파일을 끌고 왔을 때 덮는 안내 */
export function DropOverlay({ show, label = '여기에 놓으면 첨부돼요' }: { show: boolean; label?: string }) {
  if (!show) return null
  return (
    <div className="pointer-events-none fixed inset-0 z-[58] flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-[2px]" aria-hidden>
      <div className="flex flex-col items-center gap-2 rounded-3xl border-2 border-dashed border-white/80 bg-white/90 px-10 py-8 text-center shadow-float">
        <Upload className="size-8 text-brand-600" aria-hidden />
        <span className="text-[16px] font-bold text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">사진, GIF, PDF, 문서 모두 돼요</span>
      </div>
    </div>
  )
}

/** 사진 한 장(또는 영상 하나) 크게 보기 */
export function ImageViewer({ src, alt, video = false, onClose }: { src: string; alt: string; video?: boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[57] flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      {video ? (
        <video src={src} controls autoPlay playsInline className="max-h-full max-w-full rounded-xl" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl object-contain" />
      )}
      <button type="button" onClick={onClose} className="absolute top-[calc(1rem+env(safe-area-inset-top))] right-4 rounded-full bg-white/15 p-2 text-white" aria-label="닫기">
        <X className="size-5" aria-hidden />
      </button>
    </div>
  )
}

interface Props {
  value: Attachment[]
  onChange: (next: Attachment[]) => void
  /** 컴퓨터에서 끌어다 놓기도 받을지 (입력 창이 열려 있을 때) */
  acceptDrop?: boolean
  /** 고르기 창에서 보여 줄 종류 (기본: 모든 파일) */
  accept?: string
  addLabel?: string
  /** 파일 하나 최대 크기 (기본 10MB) */
  maxBytes?: number
  /** 있으면 사진(GIF 포함)은 첨부 대신 여기로 넘긴다. 일기에서 사진을 찍은 시간 칸에 넣을 때 쓴다 */
  onImages?: (files: File[]) => void | Promise<void>
}

/** 사진 파일인가 (HEIC 는 type 이 비어 있을 때가 있어 이름으로도 본다) */
export const isPictureFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name)

/** 사진·파일 첨부 칸: 사진은 작은 그림으로, 나머지는 파일 줄로 보여 준다 */
export default function AttachmentField({ value, onChange, acceptDrop = false, accept, addLabel = '사진·파일 첨부', maxBytes, onImages }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [adding, setAdding] = useState(false)
  const [viewing, setViewing] = useState<Attachment | null>(null)
  const toast = useToast()
  const room = MAX_ATTACHMENTS - value.length

  async function add(picked: File[]) {
    // 사진을 따로 받는 곳이면 사진은 그쪽으로 넘기고 나머지만 첨부한다
    const pics = onImages ? picked.filter(isPictureFile) : []
    const files = onImages ? picked.filter((f) => !isPictureFile(f)) : picked
    if (pics.length) await onImages?.(pics)
    if (files.length === 0) return
    if (room <= 0) return void toast(`첨부는 ${MAX_ATTACHMENTS}개까지 넣을 수 있어요`, 'error')
    setAdding(true)
    const { added, error } = await filesToAttachments(files, room, maxBytes)
    setAdding(false)
    onChange([...value, ...added].slice(0, MAX_ATTACHMENTS))
    if (error) toast(error, 'error')
  }
  const dragging = useFileDrop((f) => void add(f), acceptDrop)

  const remove = (i: number) => onChange(value.filter((_, j) => j !== i))
  const images = value.map((a, i) => ({ a, i })).filter((x) => isImage(x.a) || isVideo(x.a))
  const files = value.map((a, i) => ({ a, i })).filter((x) => !isImage(x.a) && !isVideo(x.a))

  return (
    <div>
      {images.length > 0 && (
        <ul className="mb-2 grid grid-cols-4 gap-2" aria-label="첨부한 사진·영상">
          {images.map(({ a, i }) => (
            <li key={i} className="relative aspect-square overflow-hidden rounded-xl bg-slate-100">
              <button type="button" onClick={() => setViewing(a)} className="size-full" aria-label={`${a.name} 크게 보기`}>
                {isVideo(a) ? (
                  <>
                    <video src={a.src} muted playsInline preload="metadata" className="size-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="rounded-full bg-slate-900/60 p-1.5 text-white">
                        <Play className="size-4 fill-current" aria-hidden />
                      </span>
                    </span>
                  </>
                ) : (
                  <img src={a.src} alt={a.name} className="size-full object-cover" />
                )}
              </button>
              {a.type === 'image/gif' && <span className="absolute bottom-1 left-1 rounded bg-slate-900/70 px-1 text-[10px] font-bold text-white">GIF</span>}
              {!syncsToCloud(a) && <CloudOff className="absolute bottom-1 right-1 size-3.5 text-white drop-shadow" aria-label="이 기기에만 저장" />}
              <button type="button" onClick={() => remove(i)} className="absolute top-1 right-1 rounded-full bg-slate-900/60 p-1 text-white" aria-label={`${a.name} 빼기`}>
                <X className="size-3" strokeWidth={3} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {files.length > 0 && (
        <ul className="mb-2 space-y-1.5" aria-label="첨부한 파일">
          {files.map(({ a, i }) => (
            <li key={i} className="flex items-center gap-2 rounded-xl bg-slate-100 py-1.5 pr-1.5 pl-2">
              <button type="button" onClick={() => void openAttachment(a).catch(() => toast('파일을 열지 못했어요', 'error'))} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
                <span className="flex size-9 shrink-0 flex-col items-center justify-center rounded-lg bg-white text-brand-600">
                  <FileText className="size-4" aria-hidden />
                  <span className="text-[8px] leading-none font-bold">{extLabel(a.name)}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{a.name}</span>
                  <span className="block text-xs text-slate-500">
                    {formatBytes(a.size)}
                    {!syncsToCloud(a) && ' · 이 기기에만 저장돼요'}
                  </span>
                </span>
              </button>
              <button type="button" onClick={() => remove(i)} className="tap rounded-full p-2 text-slate-400 hover:bg-white" aria-label={`${a.name} 빼기`}>
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {room > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={adding}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-60"
        >
          <Paperclip className="size-4" aria-hidden />
          {adding ? '넣는 중…' : value.length ? `더 첨부하기 (${value.length}/${MAX_ATTACHMENTS})` : addLabel}
        </button>
      )}
      {acceptDrop && <p className="mt-1 hidden text-center text-xs text-slate-400 md:block">컴퓨터에서 파일을 끌어다 놓아도 돼요</p>}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void add(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <DropOverlay show={dragging} />
      {viewing && <ImageViewer src={viewing.src} alt={viewing.name} video={isVideo(viewing)} onClose={() => setViewing(null)} />}
    </div>
  )
}

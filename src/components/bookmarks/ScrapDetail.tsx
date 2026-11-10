import { useLiveQuery } from 'dexie-react-hooks'
import { Camera, ExternalLink, ImagePlus, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Bookmark, ScrapMedia } from '../../db/types'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { CAPTURE_ACCEPT, saveCaptureFiles } from '../../lib/scrap/captures'
import { detectSource, instagramEmbedUrl, youtubeEmbedUrl } from '../../lib/scrap/link'
import { domainOf } from '../../lib/validate'
import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import AiSummaryButton from './AiSummaryButton'
import PhotoEditor from './PhotoEditor'
import { useSiteCapture } from './useSiteCapture'
import SourceBadge from './SourceBadge'

interface Props {
  bookmark: Bookmark | null
  categoryName?: string
  onClose: () => void
  onOpen: (b: Bookmark) => void
  onEdit: (b: Bookmark) => void
}

/** 스크랩 자세히: 앱 안에서 게시물 보기(인스타·유튜브), AI 요약, 캡처 사진·영상과 편집 */
export default function ScrapDetail({ bookmark, categoryName, onClose, onOpen, onEdit }: Props) {
  return (
    <Modal open={bookmark !== null} title="스크랩 자세히" onClose={onClose}>
      {bookmark && <DetailBody key={bookmark.id} bookmark={bookmark} categoryName={categoryName} onOpen={onOpen} onEdit={onEdit} />}
    </Modal>
  )
}

function DetailBody({ bookmark, categoryName, onOpen, onEdit }: Omit<Props, 'bookmark' | 'onClose'> & { bookmark: Bookmark }) {
  const id = bookmark.id!
  const media = useLiveQuery(() => scrapMediaRepo.captures(id), [id])
  const thumb = useLiveQuery(async () => (await scrapMediaRepo.covers()).get(id)?.cover, [id])
  const thumbUrl = useBlobUrl(thumb)
  const fileRef = useRef<HTMLInputElement>(null)
  const [viewing, setViewing] = useState<ScrapMedia | null>(null)
  const [editing, setEditing] = useState<ScrapMedia | null>(null)
  const [deleting, setDeleting] = useState<ScrapMedia | null>(null)
  const toast = useToast()
  const site = useSiteCapture(id)

  const source = bookmark.source ?? detectSource(bookmark.url)
  const isYoutube = source === 'youtube'
  // 안드로이드 앱: 인스타 퍼가기 화면은 동영상·릴스를 막을 때가 많아서, 앱 안 화면으로 게시물을 직접 연다
  // (한 번 로그인하면 앱 안에 남는다)
  const nativeView = site.available && source === 'instagram'
  const embed = nativeView ? null : (instagramEmbedUrl(bookmark.url) ?? youtubeEmbedUrl(bookmark.url))
  const [showEmbed, setShowEmbed] = useState(bookmark.isVideo === 1)

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    const r = await saveCaptureFiles(id, files)
    if (r.saved) toast(`캡처 ${r.saved}개를 저장했어요`)
    if (r.skipped) toast(`${r.skipped}개는 저장하지 못했어요 (영상은 80MB까지)`, 'error')
  }

  return (
    <div className="space-y-4">
      {/* 게시물 보기: 인스타그램 공식 퍼가기(embed)로 앱 안에서 재생 */}
      {embed && showEmbed ? (
        <div className="overflow-hidden rounded-2xl bg-slate-100">
          <iframe
            src={embed}
            title={`${bookmark.title} 게시물`}
            className={`w-full border-0 ${isYoutube ? 'aspect-video' : 'h-[min(620px,70vh)]'}`}
            allow="autoplay; encrypted-media; picture-in-picture; clipboard-write"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : thumbUrl ? (
        <img src={thumbUrl} alt="" className="max-h-72 w-full rounded-2xl bg-slate-100 object-cover" />
      ) : null}
      {embed && (
        <button type="button" onClick={() => setShowEmbed((v) => !v)} className="tap -mt-2 text-sm font-bold text-brand-700">
          {showEmbed ? '썸네일로 보기' : bookmark.isVideo === 1 ? '▶ 앱 안에서 동영상 보기' : '▶ 앱 안에서 게시물 보기'}
        </button>
      )}
      {nativeView && (
        <button type="button" onClick={() => site.start(bookmark.url, 'view')} disabled={site.busy} className="tap -mt-2 text-sm font-bold text-brand-700">
          {bookmark.isVideo === 1 ? '▶ 앱 안에서 동영상·릴스 보기' : '▶ 앱 안에서 게시물 보기'}
        </button>
      )}

      <div>
        <div className="mb-1 flex items-center gap-1.5 text-xs">
          <SourceBadge source={source} />
          <span className={`rounded-full px-2 py-0.5 font-bold ${categoryName ? 'bg-brand-50 text-brand-700' : 'bg-slate-100 text-slate-400'}`}>{categoryName ?? '미분류'}</span>
          <span className="truncate text-slate-400">{bookmark.siteName ?? domainOf(bookmark.url)}</span>
        </div>
        <h3 className="text-lg leading-snug font-extrabold text-slate-900">{bookmark.title}</h3>
        {bookmark.description && <p className="mt-1 line-clamp-4 text-sm whitespace-pre-line text-slate-500">{bookmark.description}</p>}
        {bookmark.memo && <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">📝 {bookmark.memo}</p>}
      </div>

      <section className="rounded-2xl bg-grad-soft p-4" aria-label="AI 요약">
        <div className="mb-2 flex items-center gap-2">
          <AiSummaryButton bookmark={bookmark} categoryName={categoryName} />
          <p className="text-sm font-extrabold text-slate-800">AI 정리</p>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-line break-keep text-slate-700">
          {bookmark.summary ?? '동그란 AI 버튼을 누르면 이 링크가 무슨 내용인지 정리해 줘요. 캡처가 있으면 캡처 속 글자도 읽어요.'}
        </p>
      </section>

      <section aria-label="캡처">
        <div className="mb-2 flex items-center">
          <h4 className="flex-1 text-sm font-extrabold text-slate-800">캡처 · 화면 녹화 {media?.length ? media.length : ''}</h4>
          {site.available && (
            <button
              type="button"
              onClick={() => site.start(bookmark.url)}
              disabled={site.busy}
              className="tap mr-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700"
            >
              <Camera className="size-3.5" aria-hidden />
              사이트에서 캡처
            </button>
          )}
          <button type="button" onClick={() => fileRef.current?.click()} className="tap inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
            <ImagePlus className="size-3.5" aria-hidden />
            추가
          </button>
          <input ref={fileRef} type="file" accept={CAPTURE_ACCEPT} multiple hidden onChange={(e) => addFiles(e.target.files)} />
        </div>
        {media && media.length > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            {media.map((m) => (
              <MediaThumb key={m.id} media={m} onClick={() => setViewing(m)} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-slate-200 px-3 py-4 text-center text-sm text-slate-400">게시글이 지워져도 볼 수 있게 캡처를 같이 저장해 두세요</p>
        )}
      </section>

      <div className="flex gap-2 pt-1">
        <Button variant="secondary" onClick={() => onEdit(bookmark)}>
          수정
        </Button>
        <Button className="flex-1" onClick={() => onOpen(bookmark)}>
          원래 게시물 열기
          <ExternalLink className="size-4" aria-hidden />
        </Button>
      </div>

      {viewing && (
        <MediaViewer
          media={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing)
            setViewing(null)
          }}
          onRestore={async () => {
            await scrapMediaRepo.restoreOriginal(viewing.id!)
            setViewing((await scrapMediaRepo.get(viewing.id!)) ?? null)
            toast('원본으로 되돌렸어요')
          }}
          onDelete={() => setDeleting(viewing)}
        />
      )}

      {site.editor}

      {editing && (
        <PhotoEditor
          blob={editing.blob}
          onCancel={() => setEditing(null)}
          onSave={async (out) => {
            await scrapMediaRepo.saveEdited(editing.id!, out)
            setEditing(null)
            toast('편집한 사진을 저장했어요 (원본도 남아 있어요)')
          }}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="캡처 지우기"
        message="이 캡처를 지울까요? 지우면 되돌릴 수 없어요."
        confirmLabel="지우기"
        danger
        onConfirm={async () => {
          if (deleting?.id != null) await scrapMediaRepo.remove(deleting.id)
          setDeleting(null)
          setViewing(null)
        }}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}

function MediaThumb({ media, onClick }: { media: ScrapMedia; onClick: () => void }) {
  const url = useBlobUrl(media.blob)
  const isVideo = media.blob.type.startsWith('video/')
  return (
    <button type="button" onClick={onClick} className="tap relative aspect-square overflow-hidden rounded-xl bg-slate-100" aria-label={isVideo ? '화면 녹화 보기' : '캡처 보기'}>
      {url && (isVideo ? <video src={url} muted playsInline preload="metadata" className="size-full object-cover" /> : <img src={url} alt="" className="size-full object-cover" />)}
      {isVideo && <span className="absolute right-1 bottom-1 rounded-full bg-black/60 px-1.5 text-[10px] font-bold text-white">영상</span>}
      {media.original && <span className="absolute top-1 left-1 rounded-full bg-white/85 px-1.5 text-[10px] font-bold text-slate-700">편집됨</span>}
    </button>
  )
}

function MediaViewer({ media, onClose, onEdit, onRestore, onDelete }: { media: ScrapMedia; onClose: () => void; onEdit: () => void; onRestore: () => void; onDelete: () => void }) {
  const url = useBlobUrl(media.blob)
  const isVideo = media.blob.type.startsWith('video/')
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white" role="dialog" aria-modal="true" aria-label="캡처 보기">
      <div className="flex justify-end p-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} className="tap rounded-full bg-white/10 p-2" aria-label="닫기">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-3">
        {url && (isVideo ? <video src={url} controls autoPlay playsInline className="max-h-full max-w-full" /> : <img src={url} alt="캡처" className="max-h-full max-w-full object-contain" />)}
      </div>
      <div className="flex justify-center gap-2 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        {!isVideo && (
          <button type="button" onClick={onEdit} className="tap inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-slate-900">
            <Pencil className="size-4" aria-hidden />
            편집
          </button>
        )}
        {media.original && (
          <button type="button" onClick={onRestore} className="tap inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold">
            <RotateCcw className="size-4" aria-hidden />
            원본으로
          </button>
        )}
        <button type="button" onClick={onDelete} className="tap inline-flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2.5 text-sm font-bold text-red-300">
          <Trash2 className="size-4" aria-hidden />
          지우기
        </button>
      </div>
    </div>
  )
}

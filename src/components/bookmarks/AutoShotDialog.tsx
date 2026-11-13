import { ImagePlus, Loader2, Pencil, RotateCcw, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useBlobUrl } from '../../hooks/useBlobUrl'
import { autoCaptureShot } from '../../lib/scrap/autoCapture'
import { CAPTURE_ACCEPT, saveCaptureFiles } from '../../lib/scrap/captures'
import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import PhotoEditor from './PhotoEditor'

interface Props {
  /** 캡처를 붙일 스크랩. null이면 닫힘 */
  bookmarkId: number | null
  url?: string
  onClose: () => void
}

/**
 * 사이트 화면 자동 캡처: 저장하면 서버가 사이트 화면을 찍고 → 찍힌 화면을 보여 준다
 * → "그냥 올리기"(그대로 저장) 또는 "편집"(자르기·그리기 후 저장)
 */
export default function AutoShotDialog({ bookmarkId, url, onClose }: Props) {
  return bookmarkId !== null && url ? <ShotFlow key={`${bookmarkId}-${url}`} bookmarkId={bookmarkId} url={url} onClose={onClose} /> : null
}

function ShotFlow({ bookmarkId, url, onClose }: { bookmarkId: number; url: string; onClose: () => void }) {
  const [shot, setShot] = useState<Blob | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [round, setRound] = useState(0)
  const shotUrl = useBlobUrl(shot ?? undefined)
  const fileRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  useEffect(() => {
    let alive = true
    autoCaptureShot(url).then(
      (b) => alive && setShot(b),
      (err: unknown) => alive && setFailed(err instanceof Error && err.message ? err.message : '사이트 화면을 캡처하지 못했어요'),
    )
    return () => {
      alive = false
    }
  }, [url, round])

  function retry() {
    setFailed(null)
    setShot(null)
    setRound((r) => r + 1)
  }

  async function upload(blob: Blob) {
    setSaving(true)
    try {
      await scrapMediaRepo.addCapture(bookmarkId, blob)
      toast('사이트 캡처를 스크랩에 올렸어요')
      onClose()
    } catch {
      toast('캡처를 저장하지 못했어요', 'error')
      setSaving(false)
    }
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    const r = await saveCaptureFiles(bookmarkId, files)
    if (r.saved) toast(`캡처 ${r.saved}개를 같이 저장했어요`)
    if (r.skipped) toast(`${r.skipped}개는 저장하지 못했어요 (영상은 80MB까지)`, 'error')
    onClose()
  }

  if (editing && shot) {
    return <PhotoEditor blob={shot} title="필요한 부분만 잘라 주세요" initialTool="crop" onCancel={() => setEditing(false)} onSave={(out) => upload(out)} />
  }

  return (
    <Modal open title="사이트 화면 캡처" onClose={onClose}>
      <div className="mb-4 flex max-h-[55vh] min-h-48 items-center justify-center overflow-auto rounded-2xl bg-slate-100">
        {shotUrl ? (
          <img src={shotUrl} alt="자동으로 캡처한 사이트 화면" className="w-full object-contain" />
        ) : failed ? (
          <p className="px-6 py-10 text-center text-sm leading-relaxed break-keep text-slate-500">
            {failed}.<br />
            다시 해 보거나, 갖고 있는 캡처를 올려 주세요.
          </p>
        ) : (
          <p className="flex flex-col items-center gap-2 px-6 py-10 text-sm text-slate-500">
            <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden />
            사이트 화면을 캡처하는 중… (10초쯤 걸려요)
          </p>
        )}
      </div>
      <input ref={fileRef} type="file" accept={CAPTURE_ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      {shot ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={saving} className="flex-1">
            <Pencil className="mr-1 inline size-4" aria-hidden />
            편집
          </Button>
          <Button onClick={() => upload(shot)} disabled={saving} className="flex-[2]">
            <Upload className="mr-1 inline size-4" aria-hidden />
            {saving ? '올리는 중…' : '그냥 올리기'}
          </Button>
        </div>
      ) : failed ? (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="flex-1">
            <ImagePlus className="mr-1 inline size-4" aria-hidden />
            캡처 고르기
          </Button>
          <Button onClick={retry} className="flex-1">
            <RotateCcw className="mr-1 inline size-4" aria-hidden />
            다시 캡처
          </Button>
        </div>
      ) : null}
      <button type="button" onClick={onClose} className="tap mt-3 w-full py-2 text-sm font-bold text-slate-400">
        {shot ? '안 올리기' : '나중에 할게요'}
      </button>
    </Modal>
  )
}

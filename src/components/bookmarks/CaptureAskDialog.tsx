import { Camera } from 'lucide-react'
import { useRef, useState } from 'react'
import { CAPTURE_ACCEPT, saveCaptureFiles } from '../../lib/scrap/captures'
import { setAskCapture } from '../../lib/scrap/settings'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

interface Props {
  /** 방금 저장한 스크랩. null이면 닫힘 */
  bookmarkId: number | null
  isVideo?: boolean
  onClose: () => void
}

/** "게시글이 지워질 수도 있으니 캡처본도 같이 저장할까요?" */
export default function CaptureAskDialog({ bookmarkId, isVideo, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dontAsk, setDontAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  function close() {
    if (dontAsk) setAskCapture(false)
    onClose()
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length || bookmarkId == null) return
    setBusy(true)
    const r = await saveCaptureFiles(bookmarkId, files)
    setBusy(false)
    if (r.saved) toast(`캡처 ${r.saved}개를 같이 저장했어요`)
    if (r.skipped) toast(`${r.skipped}개는 저장하지 못했어요 (영상은 80MB까지)`, 'error')
    close()
  }

  return (
    <Modal open={bookmarkId !== null} title="캡처본도 같이 저장할까요?" onClose={close}>
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-grad-soft p-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-grad on-grad">
          <Camera className="size-5" aria-hidden />
        </span>
        <p className="text-[15px] leading-relaxed break-keep text-slate-700">
          작성자가 게시글을 지우면 링크가 더는 열리지 않아요. 캡처한 사진{isVideo ? '이나 화면 녹화 영상' : ''}을 같이 저장해 두면 나중에도 볼 수 있어요.
        </p>
      </div>
      <input ref={fileRef} type="file" accept={CAPTURE_ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
      <label className="mb-4 flex items-center gap-2 text-sm text-slate-500">
        <input type="checkbox" checked={dontAsk} onChange={(e) => setDontAsk(e.target.checked)} className="size-4 accent-current" />
        다음부터 묻지 않기 (설정에서 다시 켤 수 있어요)
      </label>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={close} className="flex-1">
          아니요
        </Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy} className="flex-[2]">
          {busy ? '저장 중…' : '네, 캡처 고르기'}
        </Button>
      </div>
    </Modal>
  )
}

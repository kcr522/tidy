import { Camera, ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import { CAPTURE_ACCEPT, saveCaptureFiles } from '../../lib/scrap/captures'
import { setAskCapture } from '../../lib/scrap/settings'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'
import { useSiteCapture } from './useSiteCapture'

interface Props {
  /** 방금 저장한 스크랩. null이면 닫힘 */
  bookmarkId: number | null
  /** 방금 저장한 링크. 안드로이드 앱에서는 이 사이트를 앱 안에서 열어 바로 캡처한다 */
  url?: string
  isVideo?: boolean
  onClose: () => void
}

/**
 * "게시글이 지워질 수도 있으니 캡처본도 같이 저장할까요?"
 * - 안드로이드 앱: 네 → 사이트가 앱 안에서 열리고 → 원하는 화면에서 캡처 → 자르기 → 저장
 * - 웹·PWA: 다른 사이트 화면은 찍을 수 없어서 갖고 있는 캡처를 고른다
 */
export default function CaptureAskDialog({ bookmarkId, url, isVideo, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dontAsk, setDontAsk] = useState(false)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const [cropping, setCropping] = useState(false)

  function close() {
    if (dontAsk) setAskCapture(false)
    setCropping(false)
    onClose()
  }

  const site = useSiteCapture(bookmarkId, (saved) => {
    if (saved) close()
    else setCropping(false)
  })
  const inApp = site.available && !!url

  async function captureSite() {
    if (!url) return
    if (await site.start(url)) setCropping(true)
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
    <>
      <Modal open={bookmarkId !== null && !cropping} title="캡처본도 같이 저장할까요?" onClose={close}>
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-grad-soft p-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-grad on-grad">
            <Camera className="size-5" aria-hidden />
          </span>
          <p className="text-[15px] leading-relaxed break-keep text-slate-700">
            작성자가 게시글을 지우면 링크가 더는 열리지 않아요.{' '}
            {inApp
              ? '"네"를 누르면 사이트가 앱 안에서 열려요. 남기고 싶은 화면에서 캡처 버튼을 누르고, 필요한 부분만 잘라 저장하면 돼요.'
              : `캡처한 사진${isVideo ? '이나 화면 녹화 영상' : ''}을 같이 저장해 두면 나중에도 볼 수 있어요.`}
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
          {inApp ? (
            <Button onClick={captureSite} disabled={site.busy} className="flex-[2]">
              {site.busy ? '사이트 여는 중…' : '네, 캡처할래요'}
            </Button>
          ) : (
            <Button onClick={() => fileRef.current?.click()} disabled={busy} className="flex-[2]">
              {busy ? '저장 중…' : '네, 캡처 고르기'}
            </Button>
          )}
        </div>
        {inApp && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="tap mx-auto mt-3 flex items-center gap-1 text-sm font-bold text-slate-500"
          >
            <ImagePlus className="size-4" aria-hidden />
            {busy ? '저장 중…' : `이미 찍어 둔 캡처${isVideo ? '·화면 녹화' : ''} 올리기`}
          </button>
        )}
      </Modal>
      {site.editor}
    </>
  )
}

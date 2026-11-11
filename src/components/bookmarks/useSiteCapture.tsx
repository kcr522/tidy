import { useState, type ReactNode } from 'react'
import { canCaptureInApp, openSiteInApp } from '../../platform/scrapCapture'
import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import { useToast } from '../common/Toast'
import PhotoEditor from './PhotoEditor'

/**
 * 안드로이드 앱: 스크랩 사이트를 앱 안에서 열고 → 화면 캡처 → 자르기 → 스크랩 캡처로 저장
 * editor 를 화면 어딘가에 같이 그려 줘야 한다
 */
export function useSiteCapture(bookmarkId: number | null, onDone?: (saved: boolean) => void): {
  available: boolean
  busy: boolean
  start: (url: string, mode?: 'capture' | 'view') => Promise<boolean>
  editor: ReactNode
} {
  const [shot, setShot] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const available = canCaptureInApp()

  /** 캡처를 찍었으면 true (자르기 화면이 열린다), 그냥 닫았으면 false */
  async function start(url: string, mode: 'capture' | 'view' = 'capture'): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      const blob = await openSiteInApp(url, mode)
      if (blob) setShot(blob)
      return !!blob
    } catch {
      toast('사이트를 열지 못했어요', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const editor =
    shot && bookmarkId != null ? (
      <PhotoEditor
        blob={shot}
        title="필요한 부분만 잘라 주세요"
        initialTool="crop"
        onCancel={() => {
          setShot(null)
          onDone?.(false)
        }}
        onSave={async (out) => {
          try {
            await scrapMediaRepo.addCapture(bookmarkId, out)
            toast('캡처를 스크랩에 같이 저장했어요')
            onDone?.(true)
          } catch {
            toast('캡처를 저장하지 못했어요', 'error')
            onDone?.(false)
          }
          setShot(null)
        }}
      />
    ) : null

  return { available, busy, start, editor }
}

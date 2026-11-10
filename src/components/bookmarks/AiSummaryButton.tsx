import { Loader2, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { Bookmark } from '../../db/types'
import { summarizeScrap } from '../../lib/ai/scrapEngines'
import { localSummary, SummaryError, type ScrapSummaryInput } from '../../lib/ai/scrapSummary'
import { loadAiSettings } from '../../lib/ai/settings'
import { blobToBase64, shrinkImage } from '../../lib/scrap/image'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import { useToast } from '../common/Toast'

/** 스크랩 하나를 요약할 정보 모으기. AI에 연결돼 있으면 첫 캡처 사진도 작게 줄여 같이 보낸다 */
async function buildInput(b: Bookmark, categoryName: string | undefined, withImage: boolean): Promise<ScrapSummaryInput> {
  const input: ScrapSummaryInput = { url: b.url, title: b.title, description: b.description, siteName: b.siteName, memo: b.memo || undefined, category: categoryName }
  if (withImage && b.id != null) {
    const photo = (await scrapMediaRepo.captures(b.id)).find((m) => m.blob.type.startsWith('image/'))
    if (photo) {
      try {
        input.image = { mediaType: 'image/jpeg', data: await blobToBase64(await shrinkImage(photo.blob, 1280, 0.8)) }
      } catch {
        // 사진 없이
      }
    }
  }
  return input
}

interface Props {
  bookmark: Bookmark
  categoryName?: string
  /** 요약이 끝나면 (카드에서 요약을 펼친다) */
  onDone?: () => void
  size?: 'sm' | 'md'
}

/** AI 아이콘이 있는 동그란 버튼: 누르면 이 스크랩이 무슨 내용인지 정리해 준다 */
export default function AiSummaryButton({ bookmark, categoryName, onDone, size = 'sm' }: Props) {
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function run() {
    if (bookmark.id == null || busy) return
    setBusy(true)
    const settings = loadAiSettings()
    const input = await buildInput(bookmark, categoryName, settings.engine !== 'local')
    let text: string
    try {
      const r = await summarizeScrap(settings, input)
      text = r.text
      if (r.engine === 'local') toast('AI 없이 미리보기 내용으로 정리했어요. 설정 > AI 연결에서 Claude를 연결할 수 있어요')
    } catch (err) {
      // AI 연결이 안 되면 기본 요약이라도
      text = localSummary(input)
      toast(`${err instanceof SummaryError ? err.message : '지금은 AI에 연결하지 못했어요'}. 기본 요약을 대신 넣었어요`, 'error')
    }
    await bookmarkRepo.setSummary(bookmark.id, text)
    setBusy(false)
    onDone?.()
  }

  const dim = size === 'md' ? 'size-11' : 'size-9'
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy}
      aria-label={bookmark.summary ? 'AI로 다시 정리하기' : 'AI로 정리하기'}
      title="AI로 정리하기"
      className={`tap relative flex ${dim} shrink-0 items-center justify-center rounded-full bg-grad on-grad shadow-float disabled:opacity-70`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-[18px]" strokeWidth={2.3} aria-hidden />}
      <span className="absolute -right-1 -bottom-1 rounded-full bg-white px-1 text-[9px] leading-[14px] font-black text-brand-600 shadow-sm">AI</span>
    </button>
  )
}

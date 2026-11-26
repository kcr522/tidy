import { useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'
import { cleanSharedUrl, extractSharedUrl, sharedTextWithoutUrl } from '../lib/scrap/link'
import type { ShareState } from './BookmarksPage'

/**
 * 다른 앱에서 "공유 → Tidy"를 누르면 열리는 곳 (/share?title=…&text=…&url=…)
 * 주소를 찾아서 스크랩 저장 창으로 넘긴다.
 */
export default function SharePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const shared = { url: params.get('url'), text: params.get('text'), title: params.get('title') }
  const found = extractSharedUrl(shared)
  const url = found ? cleanSharedUrl(found) : null

  useEffect(() => {
    if (!url) return
    // 인스타그램은 제목 칸이 비어 있고, 네이버·X는 글 제목을 text나 title에 같이 보낸다
    const title = (shared.title && !/^https?:/.test(shared.title) ? shared.title : sharedTextWithoutUrl(shared.text)).slice(0, 100) || undefined
    const state: ShareState = { share: { url, title } }
    navigate('/scraps', { replace: true, state })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  if (url) return null
  return (
    <EmptyState
      icon="🔗"
      title="공유받은 내용에서 링크를 찾지 못했어요"
      action={
        <Link to="/scraps" className="tap rounded-2xl bg-grad on-grad px-5 py-3 font-bold">
          스크랩으로 가기
        </Link>
      }
    />
  )
}

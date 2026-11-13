// 스크랩을 저장한 뒤 서버가 읽은 본문(동영상 캡션·글)을 같이 남기고, AI 없이 짧은 제목을 만든다
import type { Bookmark } from '../../db/types'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import { detectSource, isNameOnlySocialTitle, simpleTitle, socialCaptionFromTitle, tidyTitle, type LinkSource } from './link'
import { fetchPageText } from './pageApi'

/** 저장할 설명 길이 */
const MAX_DESC = 1500

/** 자동으로 붙은 제목인가 (사용자가 직접 쓴 제목은 건드리지 않는다) */
export function isAutoSocialTitle(title: string, source: LinkSource): boolean {
  if (source !== 'instagram' && source !== 'x') return false
  return socialCaptionFromTitle(title) !== null || isNameOnlySocialTitle(title) || title === 'Instagram 게시물' || title === 'X 게시물'
}

/**
 * 새 스크랩: 서버가 게시글 본문을 읽어 설명을 채우고, 제목이 "OO님의 Instagram" 같은 자동 제목이면 본문으로 짧게 바꾼다.
 * 실패해도 스크랩은 그대로 둔다
 */
export async function enrichScrap(b: Bookmark): Promise<void> {
  if (b.id == null) return
  const source = (b.source as LinkSource | undefined) ?? detectSource(b.url)
  const page = await fetchPageText(b.url, AbortSignal.timeout(20000))
  const body = page.caption || page.text
  const fields: { title?: string; description?: string } = {}
  if (body && body.length > (b.description?.length ?? 0)) fields.description = body.slice(0, MAX_DESC)
  if (isAutoSocialTitle(b.title, source)) {
    const t = simpleTitle(page.caption) || simpleTitle(b.description)
    if (t && t !== b.title) fields.title = t
  }
  await bookmarkRepo.patch(b.id, fields)
}

/** 예전에 저장한 스크랩의 "Instagram의 OO님 : "…"" 제목을 짧은 제목으로 (한 번만, 인터넷 없이) */
export async function tidyOldScrapTitles(list: Bookmark[]): Promise<number> {
  let n = 0
  for (const b of list) {
    const source = (b.source as LinkSource | undefined) ?? detectSource(b.url)
    if (b.id == null || !isAutoSocialTitle(b.title, source)) continue
    const t = tidyTitle(b.title, b.description, source)
    if (t && t !== b.title) {
      await bookmarkRepo.patch(b.id, { title: t })
      n++
    }
  }
  return n
}

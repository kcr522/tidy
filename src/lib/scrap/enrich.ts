// 스크랩을 저장한 뒤 서버가 읽은 본문(동영상 캡션·글)을 같이 남기고, AI 없이 짧은 제목을 만든다
import type { Bookmark } from '../../db/types'
import { db } from '../../db/database'
import { bookmarkRepo } from '../../repositories/bookmarkRepo'
import { scrapMediaRepo } from '../../repositories/scrapMediaRepo'
import { cleanCaption, detectSource, isNameOnlySocialTitle, simpleTitle, socialCaptionFromTitle, tidyTitle, type LinkSource } from './link'
import { domainOf } from '../validate'
import { fetchLinkPreview, type LinkPreview } from './fetchPreview'
import { fetchPageText } from './pageApi'

/** 저장할 설명 길이 */
const MAX_DESC = 10000

/** 자동으로 붙은 제목인가 (사용자가 직접 쓴 제목은 건드리지 않는다) */
export function isAutoSocialTitle(title: string, source: LinkSource): boolean {
  if (source !== 'instagram' && source !== 'x') return false
  return socialCaptionFromTitle(title) !== null || isNameOnlySocialTitle(title) || title === 'Instagram 게시물' || title === 'X 게시물' || /^@[\w.]+의 게시물$/.test(title)
}

/** 사이트 이름만 있는 제목 ("네이버 블로그", 주소, 사이트 이름) → 미리보기 제목으로 다시 채운다 */
export function isGenericTitle(b: Pick<Bookmark, 'title' | 'url' | 'siteName'>): boolean {
  const t = b.title.trim()
  if (!t) return true
  if (t === domainOf(b.url) || (b.siteName && t === b.siteName.trim())) return true
  return /^(네이버\s?블로그|naver\s?blog|naver|블로그|youtube|유튜브|instagram|x|twitter|tistory|티스토리|velog|brunch|브런치)$/i.test(t)
}

/** 사이트 본문에서 메뉴 · 로그인 · 저작권 같은 짧은 줄을 빼고 본문만 */
export function cleanBodyText(text: string): string {
  const junk = /^(로그인|회원가입|메뉴|검색|홈|공유하기|구독|이웃추가|본문\s?바로가기|카테고리|이전|다음|목록|댓글|공감|신고|top|menu|login|sign\s?(in|up)|share|subscribe|search|home)$/i
  const footer = /copyright|©|all rights reserved|이용약관|개인정보\s?처리방침|사업자\s?등록/i
  const lines = text
    .split('\n')
    .map((l) => l.replace(/[\s\u00a0]+/g, ' ').trim())
    .filter((l) => l && !junk.test(l) && !footer.test(l))
  // 아주 짧은 줄(메뉴 이름)이 줄줄이 이어지는 곳은 뺀다
  const out = lines.filter((l, i) => l.length >= 12 || (lines[i - 1]?.length ?? 99) >= 12 || (lines[i + 1]?.length ?? 99) >= 12)
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** 제목 · 내용을 다시 채워야 하는 스크랩 (내용이 없거나, 이름만 있는 자동 제목) */
export function needsFill(b: Bookmark): boolean {
  const source = (b.source as LinkSource | undefined) ?? detectSource(b.url)
  return !b.description?.trim() || isAutoSocialTitle(b.title, source) || isGenericTitle(b)
}

/**
 * 새 스크랩: 서버가 게시글 본문을 읽어 설명을 채우고, 제목이 "OO님의 Instagram" 같은 자동 제목이면 본문으로 짧게 바꾼다.
 * 실패해도 스크랩은 그대로 둔다
 */
export async function enrichScrap(b: Bookmark): Promise<void> {
  if (b.id == null) return
  const source = (b.source as LinkSource | undefined) ?? detectSource(b.url)
  const page = await fetchPageText(b.url, AbortSignal.timeout(20000)).catch(() => ({ text: '', caption: '' }))
  const fields: { title?: string; description?: string } = {}
  let meta: LinkPreview | null = null
  // 저장할 때 미리보기를 못 받아 제목이 주소 · 사이트 이름뿐이면 한 번 더 받아 본다 (AI 없이 페이지 정보로)
  if (source !== 'instagram' && source !== 'x' && (isGenericTitle(b) || !b.description?.trim())) {
    try {
      meta = await fetchLinkPreview(b.url, AbortSignal.timeout(15000))
      if (isGenericTitle(b) && meta.title && !isGenericTitle({ ...b, title: meta.title })) fields.title = meta.title.slice(0, 100)
      if (!b.description?.trim() && meta.description) fields.description = meta.description
    } catch {
      // 못 받으면 본문으로
    }
  }
  if (source === 'instagram' || source === 'x') {
    // 인스타 · X는 게시물 캡션(글)만 그대로 적는다. 좋아요 수 · 아이디 · 날짜 같은 덧붙은 글은 넣지 않는다
    const caption = cleanCaption(page.caption)
    if (caption && caption !== b.description) fields.description = caption.slice(0, MAX_DESC)
  } else {
    const body = page.caption || cleanBodyText(page.text)
    const now = fields.description ?? b.description ?? ''
    if (body && body.length > now.length) fields.description = body.slice(0, MAX_DESC)
  }
  if (isAutoSocialTitle(b.title, source)) {
    const t = simpleTitle(cleanCaption(page.caption)) || simpleTitle(b.description)
    if (t && t !== b.title) fields.title = t
  }
  await bookmarkRepo.patch(b.id, fields)
  // 카드 사진(썸네일)이 없으면 미리보기 사진을 받아 둔다 (가져온 인스타 스크랩, 다른 기기에서 저장한 스크랩)
  await fillThumb(b.id, b.url, meta).catch(() => undefined)
}

/** 사진(썸네일 · 캡처)이 하나도 없는 스크랩인가 */
export async function hasNoMedia(id: number): Promise<boolean> {
  return (await db.scrapMedia.where('bookmarkId').equals(id).count()) === 0
}

/** 썸네일이 없으면 미리보기에서 사진을 받아 저장한다. 받았으면 true */
export async function fillThumb(id: number, url: string, got?: LinkPreview | null): Promise<boolean> {
  if (!(await hasNoMedia(id))) return false
  const meta = got ?? (await fetchLinkPreview(url, AbortSignal.timeout(15000)))
  if (!meta.thumb) return false
  await scrapMediaRepo.setThumb(id, meta.thumb)
  return true
}

/** 사진 없는 스크랩들에 썸네일 채우기 (둘씩, 뒤에서). 채운 수 */
export async function fillThumbs(list: Bookmark[], signal?: AbortSignal): Promise<number> {
  const todo = list.filter((b) => b.id != null)
  let next = 0
  let n = 0
  const worker = async () => {
    while (next < todo.length && !signal?.aborted) {
      const b = todo[next++]
      try {
        if (await fillThumb(b.id!, b.url)) n++
      } catch {
        // 비공개 · 지워진 게시물은 건너뛴다
      }
    }
  }
  await Promise.all([worker(), worker()])
  return n
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

/**
 * 여러 스크랩을 차례로 채우기 (인스타 저장 목록 가져오기 뒤). 서버에 한꺼번에 몰리지 않게 둘씩.
 * onProgress(끝난 수, 전체)
 */
export async function enrichMany(ids: number[], onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<void> {
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < ids.length && !signal?.aborted) {
      const id = ids[next++]
      try {
        const b = await bookmarkRepo.get(id)
        if (b) await enrichScrap(b)
      } catch {
        // 못 읽은 게시물은 건너뛴다 (지워졌거나 비공개)
      }
      onProgress?.(++done, ids.length)
    }
  }
  await Promise.all([worker(), worker()])
}

import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const page = { text: '', caption: '' }
vi.mock('../../src/lib/scrap/pageApi', () => ({ fetchPageText: async () => ({ ...page }) }))

const { db } = await import('../../src/db/database')
const { bookmarkRepo } = await import('../../src/repositories/bookmarkRepo')
const { enrichScrap } = await import('../../src/lib/scrap/enrich')

beforeEach(async () => {
  await db.bookmarks.clear()
})

/** 스크랩 하나를 저장하고 자동 채우기를 돌린 뒤 다시 읽는다 */
async function saveAndEnrich(scrap: Parameters<typeof bookmarkRepo.add>[0]) {
  const id = await bookmarkRepo.add(scrap)
  await enrichScrap((await bookmarkRepo.get(id))!)
  return bookmarkRepo.get(id)
}

describe('저장할 때 자동으로 채우는 글 (enrichScrap)', () => {
  it('인스타는 캡션만 넣고, 좋아요 · 아이디 머리말과 사이트 다른 글은 넣지 않는다', async () => {
    page.caption = '좋아요 12개, 댓글 3개 - cafe_seoul님, 2026년 11월 1일: "성수 카페 3곳 정리 ☕️"'
    page.text = '성수 카페 3곳 정리 ☕️\nInstagram\n로그인\n가입하기'
    const longPreview = '좋아요 12개 · 아주 긴 미리보기 설명이 이미 들어 있음 아주 긴 미리보기 설명'

    const scrap = await saveAndEnrich({ url: 'https://www.instagram.com/p/ABC123xyz/', title: 'Instagram 게시물', memo: '', source: 'instagram', description: longPreview })

    expect(scrap?.description).toBe('성수 카페 3곳 정리 ☕️')
    expect(scrap?.title).toBe('성수 카페 3곳 정리 ☕️')
  })

  it('인스타 캡션을 못 읽으면 있던 설명을 그대로 둔다', async () => {
    page.caption = ''
    page.text = '로그인 화면 글'

    const scrap = await saveAndEnrich({ url: 'https://www.instagram.com/p/XYZ98765/', title: '@a의 게시물', memo: '', source: 'instagram', description: '원래 설명' })

    expect(scrap?.description).toBe('원래 설명')
  })

  it('블로그 같은 일반 사이트는 본문 글을 줄이지 않고 길게 남긴다', async () => {
    page.caption = ''
    page.text = '블로그 본문 '.repeat(30)

    const scrap = await saveAndEnrich({ url: 'https://blog.naver.com/a/1', title: '블로그', memo: '', source: 'naver', description: '짧음' })

    expect(scrap?.description).toBe(page.text.trim())
  })

  it('일반 사이트 본문에서 메뉴 · 로그인 · 저작권 줄은 뺀다', async () => {
    const body = '자취방 곰팡이 없애는 방법을 정리했어요. 락스와 물을 1:10으로 섞어요.\n환기를 자주 해 주세요. 제습기도 도움이 돼요.'
    page.caption = ''
    page.text = `홈\n메뉴\n로그인\n${body}\nCopyright © 2026 blog`

    const scrap = await saveAndEnrich({ url: 'https://example.com/post/1', title: '곰팡이 청소', memo: '', source: 'web', description: '' })

    expect(scrap?.description).toBe(body)
  })
})

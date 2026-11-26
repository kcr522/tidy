import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// 미리보기는 인터넷에서 받아 오므로 가짜로 바꾼다
const preview = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('../../src/lib/scrap/fetchPreview', () => ({ fetchLinkPreview: preview.fn }))

const { db } = await import('../../src/db/database')
const { fillThumbs } = await import('../../src/lib/scrap/enrich')
const { scrapMediaRepo } = await import('../../src/repositories/scrapMediaRepo')

const UNREAD = 0 as const
const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' })
const addScrap = async (url: string) => (await db.bookmarks.add({ url, title: 'a', memo: '', isRead: UNREAD, createdAt: '', updatedAt: '' })) as number
const scrapOf = async (id: number) => (await db.bookmarks.get(id))!

beforeEach(async () => {
  await db.bookmarks.clear()
  await db.scrapMedia.clear()
  preview.fn.mockReset()
})

describe('카드 사진 채우기 (fillThumbs)', () => {
  it('사진이 없는 스크랩만 미리보기 사진을 받아 두고, 사진이 있는 것은 묻지 않는다', async () => {
    const noPhoto = await addScrap('https://www.instagram.com/p/AAA111/')
    const hasPhoto = await addScrap('https://b.com')
    await scrapMediaRepo.setThumb(hasPhoto, jpeg('old'))
    preview.fn.mockResolvedValue({ source: 'instagram', thumb: jpeg('new') })

    const filled = await fillThumbs([await scrapOf(noPhoto), await scrapOf(hasPhoto)])

    expect(filled).toBe(1)
    expect(preview.fn).toHaveBeenCalledTimes(1)
    expect((await scrapMediaRepo.covers()).get(noPhoto)?.cover).toBeDefined()
  })

  it('비공개 게시물이라 미리보기를 못 받아도 멈추지 않고 0개로 끝낸다', async () => {
    const privatePost = await addScrap('https://x.com')
    preview.fn.mockRejectedValue(new Error('비공개'))

    expect(await fillThumbs([await scrapOf(privatePost)])).toBe(0)
  })
})

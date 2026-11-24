import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const preview = vi.hoisted(() => ({ fn: vi.fn() }))
vi.mock('../../src/lib/scrap/fetchPreview', () => ({ fetchLinkPreview: preview.fn }))

const { db } = await import('../../src/db/database')
const { fillThumbs } = await import('../../src/lib/scrap/enrich')
const { scrapMediaRepo } = await import('../../src/repositories/scrapMediaRepo')

beforeEach(async () => {
  await db.bookmarks.clear()
  await db.scrapMedia.clear()
  preview.fn.mockReset()
})

describe('카드 사진 채우기 (fillThumbs)', () => {
  it('사진이 없는 스크랩만 미리보기 사진을 받아 둔다', async () => {
    const a = (await db.bookmarks.add({ url: 'https://www.instagram.com/p/AAA111/', title: 'a', memo: '', isRead: 0, createdAt: '', updatedAt: '' })) as number
    const b = (await db.bookmarks.add({ url: 'https://b.com', title: 'b', memo: '', isRead: 0, createdAt: '', updatedAt: '' })) as number
    await scrapMediaRepo.setThumb(b, new Blob(['old'], { type: 'image/jpeg' }))
    preview.fn.mockResolvedValue({ source: 'instagram', thumb: new Blob(['new'], { type: 'image/jpeg' }) })
    const n = await fillThumbs([(await db.bookmarks.get(a))!, (await db.bookmarks.get(b))!])
    expect(n).toBe(1)
    expect(preview.fn).toHaveBeenCalledTimes(1)
    expect((await scrapMediaRepo.covers()).get(a)?.cover).toBeDefined()
  })
  it('미리보기를 못 받아도 멈추지 않는다', async () => {
    const a = (await db.bookmarks.add({ url: 'https://x.com', title: 'a', memo: '', isRead: 0, createdAt: '', updatedAt: '' })) as number
    preview.fn.mockRejectedValue(new Error('비공개'))
    expect(await fillThumbs([(await db.bookmarks.get(a))!])).toBe(0)
  })
})

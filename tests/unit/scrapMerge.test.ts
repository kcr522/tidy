import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { linkKey } from '../../src/lib/scrap/link'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

const AUTO_TITLE = { titleByUser: false }
const USER_TITLE = { titleByUser: true }
// 저장 시각이 겹치지 않게 잠깐 기다린다 (목록은 updatedAt 순)
const tick = () => new Promise((resolve) => setTimeout(resolve, 5))

describe('같은 게시물 알아보기 (linkKey)', () => {
  it.each([
    ['인스타 (아이디 · img_index · igsh)', 'https://www.instagram.com/cafe_seoul/p/ABC123xyz/?img_index=2&igsh=xx', 'https://instagram.com/p/ABC123xyz'],
    ['X · 트위터', 'https://twitter.com/abc/status/1234567890?s=20', 'https://x.com/abc/status/1234567890'],
    ['유튜브 짧은 주소 · 긴 주소', 'https://youtu.be/dQw4w9WgXcQ?si=abc', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'],
    ['네이버 블로그 (utm · # · 모바일)', 'https://blog.naver.com/a/123?utm_source=share#top', 'https://m.blog.naver.com/a/123/'],
  ])('%s: 주소 모양이 달라도 같은 게시물이면 같다', (_case, url, sameUrl) => {
    expect(linkKey(url)).toBe(linkKey(sameUrl))
  })

  it.each([
    ['인스타 게시물 코드가 다르면', 'https://www.instagram.com/p/ABC123xyz/', 'https://www.instagram.com/p/ZZZ999xyz/'],
    ['검색어(?q=)가 다르면', 'https://example.com/search?q=a', 'https://example.com/search?q=b'],
  ])('%s 다른 게시물이다', (_case, url, otherUrl) => {
    expect(linkKey(url)).not.toBe(linkKey(otherUrl))
  })
})

describe('같은 게시물은 하나로 (bookmarkRepo.addOrMerge)', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })

  it('새로 만들지 않고 최신 주소 · 설명으로 바꾸되, 사용자가 쓴 메모 · 제목 · 카테고리는 지킨다', async () => {
    db = new TidyDB('scrap-merge-1')
    const repo = createBookmarkRepo(db)
    const MY_CATEGORY = 3
    const old = await repo.add({ url: 'https://www.instagram.com/p/ABC123xyz/', title: '성수 카페 모음', memo: '주말에 가 보기', categoryId: MY_CATEGORY, source: 'instagram', description: '예전 설명' })
    const newUrl = 'https://www.instagram.com/cafe/p/ABC123xyz/?img_index=1'

    const result = await repo.addOrMerge({ url: newUrl, title: 'cafe_seoul님의 Instagram', memo: '', categoryId: null, source: 'instagram', description: '새 캡션' }, AUTO_TITLE)

    expect(result).toEqual({ id: old, merged: true })
    expect(await db.bookmarks.count()).toBe(1)
    expect(await repo.get(old)).toMatchObject({ title: '성수 카페 모음', memo: '주말에 가 보기', categoryId: MY_CATEGORY, description: '새 캡션', url: newUrl })
  })

  it('새로 직접 쓴 메모 · 제목이 있으면 그것으로 바꾸고 목록 맨 위로 올린다', async () => {
    db = new TidyDB('scrap-merge-2')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://x.com/abc/status/1234567890', title: '옛 제목', memo: '옛 메모' })
    await tick()
    await repo.add({ url: 'https://react.dev/', title: '다른 것', memo: '' })
    await tick()

    await repo.addOrMerge({ url: 'https://twitter.com/abc/status/1234567890', title: '새 제목', memo: '새 메모' }, USER_TITLE)

    expect(await repo.get(id)).toMatchObject({ title: '새 제목', memo: '새 메모' })
    expect((await repo.list())[0].id).toBe(id)
  })

  it('같은 게시물이 없으면 새로 만든다', async () => {
    db = new TidyDB('scrap-merge-3')
    const repo = createBookmarkRepo(db)
    await repo.add({ url: 'https://react.dev/', title: 'React', memo: '' })

    const result = await repo.addOrMerge({ url: 'https://vite.dev/', title: 'Vite', memo: '' })

    expect(result.merged).toBe(false)
    expect(await db.bookmarks.count()).toBe(2)
  })

  it('인스타 가져오기에서 이미 있는 게시물은 하나로 두고, 카테고리가 없으면 컬렉션 이름으로 채운다', async () => {
    db = new TidyDB('scrap-merge-4')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://www.instagram.com/p/ABC123xyz/', title: '내가 쓴 제목', memo: '메모', source: 'instagram' })

    const result = await repo.importInstagram([{ url: 'https://www.instagram.com/p/ABC123xyz/', code: 'ABC123xyz', collection: '성수 맛집' }])

    expect(result).toEqual({ added: [], skipped: 1 })
    const saved = await repo.get(id)
    expect(saved).toMatchObject({ title: '내가 쓴 제목', memo: '메모' })
    expect((await db.scrapCategories.get(saved!.categoryId!))?.name).toBe('성수 맛집')
  })
})

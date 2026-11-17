import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { linkKey } from '../../src/lib/scrap/link'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

describe('같은 게시물 알아보기 (linkKey)', () => {
  it('주소 모양이 달라도 같은 게시물이면 같다', () => {
    expect(linkKey('https://www.instagram.com/cafe_seoul/p/ABC123xyz/?img_index=2&igsh=xx')).toBe(linkKey('https://instagram.com/p/ABC123xyz'))
    expect(linkKey('https://twitter.com/abc/status/1234567890?s=20')).toBe(linkKey('https://x.com/abc/status/1234567890'))
    expect(linkKey('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe(linkKey('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10'))
    expect(linkKey('https://blog.naver.com/a/123?utm_source=share#top')).toBe(linkKey('https://m.blog.naver.com/a/123/'))
  })

  it('다른 게시물은 다르다', () => {
    expect(linkKey('https://www.instagram.com/p/ABC123xyz/')).not.toBe(linkKey('https://www.instagram.com/p/ZZZ999xyz/'))
    expect(linkKey('https://example.com/search?q=a')).not.toBe(linkKey('https://example.com/search?q=b'))
  })
})

describe('같은 게시물은 하나로 (bookmarkRepo.addOrMerge)', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })

  it('새로 만들지 않고 최신 내용으로 바꾸되, 사용자가 쓴 메모 · 제목 · 카테고리는 지킨다', async () => {
    db = new TidyDB('scrap-merge-1')
    const repo = createBookmarkRepo(db)
    const old = await repo.add({ url: 'https://www.instagram.com/p/ABC123xyz/', title: '성수 카페 모음', memo: '주말에 가 보기', categoryId: 3, source: 'instagram', description: '예전 설명' })
    const r = await repo.addOrMerge({ url: 'https://www.instagram.com/cafe/p/ABC123xyz/?img_index=1', title: 'cafe_seoul님의 Instagram', memo: '', categoryId: null, source: 'instagram', description: '새 캡션' }, { titleByUser: false })
    expect(r).toEqual({ id: old, merged: true })
    expect(await db.bookmarks.count()).toBe(1)
    expect(await repo.get(old)).toMatchObject({ title: '성수 카페 모음', memo: '주말에 가 보기', categoryId: 3, description: '새 캡션', url: 'https://www.instagram.com/cafe/p/ABC123xyz/?img_index=1' })
  })

  it('새로 직접 쓴 메모 · 제목이 있으면 그걸로', async () => {
    db = new TidyDB('scrap-merge-2')
    const repo = createBookmarkRepo(db)
    const a = await repo.add({ url: 'https://x.com/abc/status/1234567890', title: '옛 제목', memo: '옛 메모' })
    await new Promise((res) => setTimeout(res, 5))
    await repo.add({ url: 'https://react.dev/', title: '다른 것', memo: '' })
    await new Promise((res) => setTimeout(res, 5))
    await repo.addOrMerge({ url: 'https://twitter.com/abc/status/1234567890', title: '새 제목', memo: '새 메모' }, { titleByUser: true })
    expect(await repo.get(a)).toMatchObject({ title: '새 제목', memo: '새 메모' })
    // 다시 저장한 것이 목록 맨 위로
    expect((await repo.list())[0].id).toBe(a)
  })

  it('같은 게 없으면 새로 만든다', async () => {
    db = new TidyDB('scrap-merge-3')
    const repo = createBookmarkRepo(db)
    await repo.add({ url: 'https://react.dev/', title: 'React', memo: '' })
    const r = await repo.addOrMerge({ url: 'https://vite.dev/', title: 'Vite', memo: '' })
    expect(r.merged).toBe(false)
    expect(await db.bookmarks.count()).toBe(2)
  })

  it('인스타 가져오기: 이미 있는 게시물은 하나로 두고, 카테고리가 없으면 컬렉션으로 채운다', async () => {
    db = new TidyDB('scrap-merge-4')
    const repo = createBookmarkRepo(db)
    const id = await repo.add({ url: 'https://www.instagram.com/p/ABC123xyz/', title: '내가 쓴 제목', memo: '메모', source: 'instagram' })
    const r = await repo.importInstagram([{ url: 'https://www.instagram.com/p/ABC123xyz/', code: 'ABC123xyz', collection: '성수 맛집' }])
    expect(r).toEqual({ added: [], skipped: 1 })
    const b = await repo.get(id)
    expect(b).toMatchObject({ title: '내가 쓴 제목', memo: '메모' })
    expect((await db.scrapCategories.get(b!.categoryId!))?.name).toBe('성수 맛집')
  })
})

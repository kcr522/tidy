import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { cleanCaption } from '../../src/lib/scrap/link'
import { instagramPost, mergeSaved, parseSavedHtml, parseSavedJson, readInstagramSaved } from '../../src/lib/scrap/instagramSaved'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'

// 인스타 "내 정보 다운로드"의 saved_posts.json 모양
const SAVED_POSTS = JSON.stringify({
  saved_saved_media: [
    { title: 'cafe_seoul', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/p/ABC123xyz/', timestamp: 1763000000 } } },
    { title: 'travel.kr', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/reel/REEL9876/', timestamp: 1763100000 } } },
    { title: 'nope', string_map_data: { 'Saved on': { href: 'https://www.instagram.com/someone/', timestamp: 1763100000 } } },
  ],
})

// saved_collections.json 모양: 컬렉션 머리 줄 다음에 그 컬렉션의 게시물들
const SAVED_COLLECTIONS = JSON.stringify({
  saved_saved_collections: [
    { title: 'Collection', string_map_data: { Name: { value: '성수 맛집' }, 'Creation Time': { timestamp: 1762000000 } } },
    { string_map_data: { Name: { href: 'https://www.instagram.com/p/ABC123xyz/', value: 'cafe_seoul' }, 'Added Time': { timestamp: 1763000000 } } },
    { title: 'Collection', string_map_data: { Name: { value: '여행' } } },
    { string_map_data: { Name: { href: 'https://www.instagram.com/reel/REEL9876/', value: 'travel.kr' }, 'Added Time': { timestamp: 1763100000 } } },
  ],
})

/** 테스트용 zip 만들기 (deflate). CRC는 읽는 쪽이 보지 않아서 0 */
async function makeZip(files: Record<string, string>): Promise<Uint8Array> {
  const enc = new TextEncoder()
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const [name, text] of Object.entries(files)) {
    const raw = enc.encode(text)
    const comp = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    const n = enc.encode(name)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(8, 8, true)
    head.setUint32(18, comp.length, true)
    head.setUint32(22, raw.length, true)
    head.setUint16(26, n.length, true)
    parts.push(new Uint8Array(head.buffer), n, comp)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(10, 8, true)
    cd.setUint32(20, comp.length, true)
    cd.setUint32(24, raw.length, true)
    cd.setUint16(28, n.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), n)
    offset += 30 + n.length + comp.length
  }
  const cdSize = central.reduce((a, b) => a + b.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, Object.keys(files).length, true)
  end.setUint16(10, Object.keys(files).length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0))
  let p = 0
  for (const a of all) {
    out.set(a, p)
    p += a.length
  }
  return out
}

describe('인스타 저장 목록 읽기', () => {
  it('게시물 주소만 골라 깔끔하게 (p / reel, 프로필 주소는 뺌)', () => {
    expect(instagramPost('https://instagram.com/p/ABC123xyz/?img_index=2')).toEqual({ code: 'ABC123xyz', url: 'https://www.instagram.com/p/ABC123xyz/' })
    expect(instagramPost('https://www.instagram.com/someone/reel/REEL9876')?.url).toBe('https://www.instagram.com/reel/REEL9876/')
    expect(instagramPost('https://www.instagram.com/someone/')).toBeNull()
  })

  it('saved_posts.json: 올린 사람 아이디와 저장한 때', () => {
    const list = parseSavedJson(SAVED_POSTS)
    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ code: 'ABC123xyz', author: 'cafe_seoul', savedAt: new Date(1763000000 * 1000).toISOString() })
  })

  it('saved_collections.json: 컬렉션 이름이 붙고, 두 파일을 합치면 하나씩 (최근 저장이 먼저)', () => {
    const merged = mergeSaved([...parseSavedJson(SAVED_POSTS), ...parseSavedJson(SAVED_COLLECTIONS)])
    expect(merged.map((p) => [p.code, p.collection, p.author])).toEqual([
      ['REEL9876', '여행', 'travel.kr'],
      ['ABC123xyz', '성수 맛집', 'cafe_seoul'],
    ])
  })

  it('HTML 형식 파일도 게시물 주소를 찾는다', () => {
    const html = '<a href="https://www.instagram.com/p/ABC123xyz/">x</a><a href="https://www.instagram.com/reel/REEL9876/?utm=1&amp;a=b">y</a><a href="https://example.com">z</a>'
    expect(parseSavedHtml(html).map((p) => p.code)).toEqual(['ABC123xyz', 'REEL9876'])
  })

  it('받은 zip 파일을 풀지 않고 바로 읽는다', async () => {
    const zip = await makeZip({
      'your_instagram_activity/saved/saved_posts.json': SAVED_POSTS,
      'your_instagram_activity/saved/saved_collections.json': SAVED_COLLECTIONS,
      'media/other.txt': 'hello',
    })
    const list = await readInstagramSaved(new File([zip], 'instagram-me-2026-11-17.zip'))
    expect(list).toHaveLength(2)
    expect(list.find((p) => p.code === 'ABC123xyz')?.collection).toBe('성수 맛집')
  })

  it('"저장됨"이 없는 zip은 알려 준다', async () => {
    const zip = await makeZip({ 'media/other.txt': 'hello' })
    await expect(readInstagramSaved(new File([zip], 'a.zip'))).rejects.toThrow('저장됨')
  })
})

describe('가져오기 (bookmarkRepo.importInstagram)', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })

  it('컬렉션은 카테고리로, 이미 있는 게시물은 건너뛴다', async () => {
    db = new TidyDB('ig-import-1')
    const repo = createBookmarkRepo(db)
    await repo.add({ url: 'https://www.instagram.com/p/ABC123xyz/', title: '전에 저장한 것', memo: '', source: 'instagram' })
    const posts = mergeSaved([...parseSavedJson(SAVED_POSTS), ...parseSavedJson(SAVED_COLLECTIONS)])
    const r = await repo.importInstagram(posts)
    expect(r.added).toHaveLength(1)
    expect(r.skipped).toBe(1)
    const b = await repo.get(r.added[0])
    expect(b).toMatchObject({ url: 'https://www.instagram.com/reel/REEL9876/', title: '@travel.kr의 게시물', source: 'instagram', isVideo: 1, isRead: 0 })
    const cats = await db.scrapCategories.toArray()
    expect(cats.map((c) => c.name)).toContain('여행')
    expect(b?.categoryId).toBe(cats.find((c) => c.name === '여행')?.id)
    // 한 번 더 가져와도 늘지 않는다
    expect((await repo.importInstagram(posts)).added).toHaveLength(0)
  })

  it('컬렉션 나누기를 끄면 미분류로', async () => {
    db = new TidyDB('ig-import-2')
    const repo = createBookmarkRepo(db)
    const before = await db.scrapCategories.count()
    const r = await repo.importInstagram(parseSavedJson(SAVED_COLLECTIONS), false)
    expect(r.added).toHaveLength(2)
    expect(await db.scrapCategories.count()).toBe(before)
    expect((await repo.get(r.added[0]))?.categoryId).toBeUndefined()
  })
})

describe('캡션만 남기기 (cleanCaption)', () => {
  it('좋아요 · 아이디 · 날짜 머리말과 바깥 따옴표를 뗀다', () => {
    expect(cleanCaption('좋아요 1,234개, 댓글 56개 - cafe_seoul님, 2026년 11월 1일: "성수 카페 3곳 정리 ☕️\n\n#성수"')).toBe('성수 카페 3곳 정리 ☕️\n\n#성수')
    expect(cleanCaption('1,234 likes, 56 comments - cafe_seoul on November 1, 2026: "Best cafes"')).toBe('Best cafes')
  })

  it('X 글 끝의 t.co · pic.twitter.com 링크를 뗀다', () => {
    expect(cleanCaption('오늘 본 전시 정리 https://t.co/AbCd123 pic.twitter.com/XyZ987')).toBe('오늘 본 전시 정리')
  })

  it('빈 값은 빈 글', () => {
    expect(cleanCaption(undefined)).toBe('')
  })
})

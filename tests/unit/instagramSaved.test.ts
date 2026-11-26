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
    const nameBytes = enc.encode(name)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true)
    head.setUint16(8, 8, true)
    head.setUint32(18, comp.length, true)
    head.setUint32(22, raw.length, true)
    head.setUint16(26, nameBytes.length, true)
    parts.push(new Uint8Array(head.buffer), nameBytes, comp)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true)
    cd.setUint16(10, 8, true)
    cd.setUint32(20, comp.length, true)
    cd.setUint32(24, raw.length, true)
    cd.setUint16(28, nameBytes.length, true)
    cd.setUint32(42, offset, true)
    central.push(new Uint8Array(cd.buffer), nameBytes)
    offset += 30 + nameBytes.length + comp.length
  }
  const cdSize = central.reduce((sum, part) => sum + part.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true)
  end.setUint16(8, Object.keys(files).length, true)
  end.setUint16(10, Object.keys(files).length, true)
  end.setUint32(12, cdSize, true)
  end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((sum, part) => sum + part.length, 0))
  let position = 0
  for (const part of all) {
    out.set(part, position)
    position += part.length
  }
  return out
}

const POST_URL = 'https://www.instagram.com/p/ABC123xyz/'
const REEL_URL = 'https://www.instagram.com/reel/REEL9876/'
const bothFiles = () => mergeSaved([...parseSavedJson(SAVED_POSTS), ...parseSavedJson(SAVED_COLLECTIONS)])

describe('인스타 저장 목록 읽기', () => {
  it('게시물 주소는 코드와 깔끔한 주소로 바꾸고 ?img_index 같은 꼬리는 뗀다', () => {
    expect(instagramPost('https://instagram.com/p/ABC123xyz/?img_index=2')).toEqual({ code: 'ABC123xyz', url: POST_URL })
  })

  it('아이디가 들어간 릴스 주소도 /reel/코드/ 로 바꾼다', () => {
    expect(instagramPost('https://www.instagram.com/someone/reel/REEL9876')?.url).toBe(REEL_URL)
  })

  it('프로필 주소는 게시물이 아니다', () => {
    expect(instagramPost('https://www.instagram.com/someone/')).toBeNull()
  })

  it('saved_posts.json 에서 게시물마다 올린 사람 아이디와 저장한 때를 읽는다', () => {
    const list = parseSavedJson(SAVED_POSTS)

    expect(list).toHaveLength(2)
    expect(list[0]).toMatchObject({ code: 'ABC123xyz', author: 'cafe_seoul', savedAt: new Date(1763000000 * 1000).toISOString() })
  })

  it('두 파일을 합치면 게시물은 하나씩, 컬렉션 이름이 붙고, 최근 저장이 먼저다', () => {
    expect(bothFiles().map((post) => [post.code, post.collection, post.author])).toEqual([
      ['REEL9876', '여행', 'travel.kr'],
      ['ABC123xyz', '성수 맛집', 'cafe_seoul'],
    ])
  })

  it('HTML 형식 파일에서도 인스타 게시물 주소만 찾는다', () => {
    const html = '<a href="https://www.instagram.com/p/ABC123xyz/">x</a><a href="https://www.instagram.com/reel/REEL9876/?utm=1&amp;a=b">y</a><a href="https://example.com">z</a>'

    expect(parseSavedHtml(html).map((post) => post.code)).toEqual(['ABC123xyz', 'REEL9876'])
  })

  it('받은 zip 파일을 풀지 않고 바로 읽는다', async () => {
    const zip = await makeZip({
      'your_instagram_activity/saved/saved_posts.json': SAVED_POSTS,
      'your_instagram_activity/saved/saved_collections.json': SAVED_COLLECTIONS,
      'media/other.txt': 'hello',
    })

    const list = await readInstagramSaved(new File([zip], 'instagram-me-2026-11-17.zip'))

    expect(list).toHaveLength(2)
    expect(list.find((post) => post.code === 'ABC123xyz')?.collection).toBe('성수 맛집')
  })

  it('"저장됨" 파일이 없는 zip 은 저장됨이 없다고 알려 준다', async () => {
    const zip = await makeZip({ 'media/other.txt': 'hello' })

    await expect(readInstagramSaved(new File([zip], 'a.zip'))).rejects.toThrow('저장됨')
  })
})

describe('가져오기 (bookmarkRepo.importInstagram)', () => {
  let db: TidyDB
  afterEach(async () => {
    await db?.delete()
  })
  const NO_COLLECTIONS = false

  it('이미 있는 게시물은 건너뛰고 새 게시물은 영상 · 안 읽음으로 넣는다', async () => {
    db = new TidyDB('ig-import-1')
    const repo = createBookmarkRepo(db)
    await repo.add({ url: POST_URL, title: '전에 저장한 것', memo: '', source: 'instagram' })

    const result = await repo.importInstagram(bothFiles())

    expect(result.added).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(await repo.get(result.added[0])).toMatchObject({ url: REEL_URL, title: '@travel.kr의 게시물', source: 'instagram', isVideo: 1, isRead: 0 })
  })

  it('컬렉션은 같은 이름의 스크랩 카테고리로 만들어 넣는다', async () => {
    db = new TidyDB('ig-import-1b')
    const repo = createBookmarkRepo(db)

    await repo.importInstagram(bothFiles())

    const travel = (await db.scrapCategories.toArray()).find((category) => category.name === '여행')
    const reel = (await db.bookmarks.toArray()).find((bookmark) => bookmark.url === REEL_URL)
    expect(travel).toBeDefined()
    expect(reel?.categoryId).toBe(travel?.id)
  })

  it('한 번 더 가져와도 늘지 않는다', async () => {
    db = new TidyDB('ig-import-1c')
    const repo = createBookmarkRepo(db)
    await repo.importInstagram(bothFiles())

    const again = await repo.importInstagram(bothFiles())

    expect(again.added).toHaveLength(0)
  })

  it('컬렉션 나누기를 끄면 카테고리를 만들지 않고 미분류로 넣는다', async () => {
    db = new TidyDB('ig-import-2')
    const repo = createBookmarkRepo(db)
    const before = await db.scrapCategories.count()

    const result = await repo.importInstagram(parseSavedJson(SAVED_COLLECTIONS), NO_COLLECTIONS)

    expect(result.added).toHaveLength(2)
    expect(await db.scrapCategories.count()).toBe(before)
    expect((await repo.get(result.added[0]))?.categoryId).toBeUndefined()
  })
})

describe('캡션만 남기기 (cleanCaption)', () => {
  it.each([
    ['한국어', '좋아요 1,234개, 댓글 56개 - cafe_seoul님, 2026년 11월 1일: "성수 카페 3곳 정리 ☕️\n\n#성수"', '성수 카페 3곳 정리 ☕️\n\n#성수'],
    ['영어', '1,234 likes, 56 comments - cafe_seoul on November 1, 2026: "Best cafes"', 'Best cafes'],
  ])('%s 미리보기에서 좋아요 · 아이디 · 날짜 머리말과 바깥 따옴표를 뗀다', (_case, preview, caption) => {
    expect(cleanCaption(preview)).toBe(caption)
  })

  it('X 글 끝의 t.co · pic.twitter.com 링크를 뗀다', () => {
    expect(cleanCaption('오늘 본 전시 정리 https://t.co/AbCd123 pic.twitter.com/XyZ987')).toBe('오늘 본 전시 정리')
  })

  it('값이 없으면 빈 글을 준다', () => {
    expect(cleanCaption(undefined)).toBe('')
  })
})

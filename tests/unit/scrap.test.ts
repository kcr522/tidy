import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCRAP_CATEGORIES, TidyDB } from '../../src/db/database'
import { localSummary, sanitizeSummaryInput, summaryPrompt } from '../../src/lib/ai/scrapSummary'
import {
  detectSource,
  cleanSharedUrl,
  extractSharedUrl,
  instagramEmbedUrl,
  isPrivateIp,
  isPublicHttpUrl,
  naverBlogInnerUrl,
  parseLinkMeta,
  sharedTextWithoutUrl,
  xEmbedUrl,
  youtubeEmbedUrl,
} from '../../src/lib/scrap/link'
import { buildPreview, PreviewError, setHostResolver } from '../../src/lib/scrap/previewServer'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { CategoryNameError, createScrapCategoryRepo } from '../../src/repositories/scrapCategoryRepo'
import { createScrapMediaRepo } from '../../src/repositories/scrapMediaRepo'

const UNSORTED = null
const okScrap = { url: 'https://a.com/', title: 'A', memo: '' }

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const db = new TidyDB(name)
  dbs.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

describe('링크 출처와 공유받기', () => {
  it.each([
    ['https://www.instagram.com/reel/Cx1/', 'instagram'],
    ['https://m.blog.naver.com/abc/123', 'naver'],
    ['https://naver.me/xyz', 'naver'],
    ['https://x.com/user/status/1', 'x'],
    ['https://twitter.com/user/status/1', 'x'],
    ['https://youtu.be/abc', 'youtube'],
    ['https://react.dev', 'web'],
  ])('%s 는 %s 링크로 알아본다', (url, source) => {
    expect(detectSource(url)).toBe(source)
  })

  it.each([
    ['글 뒤에 붙은 인스타 주소', { text: '이 게시물 보세요 https://www.instagram.com/p/ABC123/?igsh=xyz' }, 'https://www.instagram.com/p/ABC123/?igsh=xyz'],
    ['url 칸이 따로 오면 그 주소', { url: 'https://x.com/a/status/1', text: '아무거나' }, 'https://x.com/a/status/1'],
    ['괄호 · 마침표에 둘러싸인 주소', { text: '[네이버 블로그] 성수 맛집 (https://naver.me/5abc).' }, 'https://naver.me/5abc'],
    ['주소가 없으면 없음', { text: '주소 없음' }, null],
  ])('공유받은 글에서 주소를 찾는다: %s', (_case, shared, url) => {
    expect(extractSharedUrl(shared)).toBe(url)
  })

  it('공유받은 글에서 주소를 뺀 나머지 글을 남긴다', () => {
    expect(sharedTextWithoutUrl('성수 맛집 https://naver.me/5abc')).toBe('성수 맛집')
    // X 앱 공유: 추적용 ?s= · ?t= 는 떼고, 다른 사이트 주소는 그대로
    expect(cleanSharedUrl('https://x.com/someone/status/1790000000000000000?s=46&t=AbC')).toBe('https://x.com/someone/status/1790000000000000000')
    expect(cleanSharedUrl('https://twitter.com/someone/status/123/')).toBe('https://twitter.com/someone/status/123')
    expect(cleanSharedUrl('https://x.com/someone?s=20')).toBe('https://x.com/someone?s=20')
    expect(cleanSharedUrl('https://naver.me/5abc?s=1')).toBe('https://naver.me/5abc?s=1')
  })

  it.each([
    ['https://www.instagram.com/reel/C9xYz_1/?igsh=1', 'https://www.instagram.com/reel/C9xYz_1/embed/captioned/'],
    ['https://instagram.com/p/ABC/', 'https://www.instagram.com/p/ABC/embed/captioned/'],
    ['https://www.instagram.com/someone/reels/XYZ/', 'https://www.instagram.com/reel/XYZ/embed/captioned/'],
    ['https://www.instagram.com/someone/', null],
  ])('인스타 %s 는 앱 안에서 재생할 공식 퍼가기 주소 %s 로 바꾼다', (url, embed) => {
    expect(instagramEmbedUrl(url)).toBe(embed)
  })

  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/embed/dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/abcdefg', 'https://www.youtube.com/embed/abcdefg'],
  ])('유튜브 %s 는 퍼가기 주소 %s 로 바꾼다', (url, embed) => {
    expect(youtubeEmbedUrl(url)).toBe(embed)
  })

  it.each([
    ['https://x.com/someone/status/1790000000000000000?s=20', 'https://platform.twitter.com/embed/Tweet.html?id=1790000000000000000&lang=ko&dnt=true'],
    ['https://mobile.twitter.com/someone/status/123456789', 'https://platform.twitter.com/embed/Tweet.html?id=123456789&lang=ko&dnt=true'],
    ['https://x.com/someone', null],
    ['https://instagram.com/p/ABC/', null],
  ])('X 주소 %s 는 퍼가기 주소 %s 로 바꾼다', (url, embed) => {
    expect(xEmbedUrl(url)).toBe(embed)
  })

  it('서버는 공개된 https 주소를 읽는다', () => {
    expect(isPublicHttpUrl('https://www.instagram.com/p/1')).toBe(true)
  })

  it.each(['http://localhost:3000', 'http://127.0.0.1/', 'http://192.168.0.1/', 'http://10.0.0.5/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'http://[::1]/', 'http://intranet/'])('서버는 내 컴퓨터 · 사설망 주소 %s 를 읽지 않는다 (보안)', (url) => {
    expect(isPublicHttpUrl(url)).toBe(false)
  })

  // 보안 강화 2026-11-27: 클라우드 내부 · 통신사 공유망(100.64/10) · IPv6 안에 숨긴 IPv4 도 막는다. 경계값은 안쪽 · 바깥쪽 짝으로
  it.each([
    ['100.64.0.1', true],
    ['100.63.255.255', false],
    ['100.127.255.255', true],
    ['100.128.0.0', false],
    ['172.16.0.1', true],
    ['172.15.255.255', false],
    ['172.31.255.255', true],
    ['172.32.0.0', false],
    ['::ffff:10.0.0.1', true],
    ['::ffff:8.8.8.8', false],
    ['::', true],
    ['224.0.0.1', true],
    ['2606:4700:4700::1111', false],
    ['8.8.8.8', false],
  ])('IP %s 는 사설망인가: %s', (ip, isPrivate) => {
    expect(isPrivateIp(ip)).toBe(isPrivate)
  })
})

describe('서버 미리보기: 이름이 가리키는 진짜 IP 확인 (SSRF) — 보안 강화 2026-11-27', () => {
  const page = () => new Response('<html><head><meta property="og:title" content="공개 글"></head></html>', { headers: { 'content-type': 'text/html' } })
  afterEach(() => setHostResolver(null))

  it('겉은 공개 이름이지만 안쪽 IP(127.0.0.1)를 가리키면 읽지 않는다', async () => {
    setHostResolver(async () => ['127.0.0.1'])
    let asked = false
    const f = (async () => ((asked = true), page())) as typeof fetch

    const result = buildPreview('https://127.0.0.1.nip.io/', f)

    await expect(result).rejects.toBeInstanceOf(PreviewError)
    expect(asked).toBe(false) // 그 주소로 아예 묻지 않았는지 확인
  })

  it('공개 IP 를 가리키는 이름은 그대로 읽는다', async () => {
    setHostResolver(async () => ['93.184.215.14'])
    const f = (async () => page()) as typeof fetch

    const result = await buildPreview('https://example.com/', f)

    expect(result.title).toBe('공개 글')
  })
})

describe('링크 미리보기 (OG 태그)', () => {
  const html = `<html><head><title>대체 제목</title>
    <meta property="og:title" content="성수 브런치 맛집 &amp; 카페 TOP5">
    <meta property="og:description" content='1,234 likes, 56 comments - foodie on November 1, 2026: "웨이팅 30분, 에그베네딕트 18,000원. 주말엔 10시 전에 가세요. #성수맛집 #브런치"'>
    <meta property="og:image" content="/img/cover.jpg">
    <meta property="og:site_name" content="Instagram">
    <meta property="og:type" content="video">
  </head><body></body></html>`

  it('제목, 설명, 사이트, 썸네일(절대 주소), 동영상 여부를 읽는다', () => {
    const meta = parseLinkMeta(html, 'https://www.instagram.com/reel/X/')

    expect(meta).toMatchObject({ title: '성수 브런치 맛집 & 카페 TOP5', siteName: 'Instagram', image: 'https://www.instagram.com/img/cover.jpg', isVideo: true })
    // 인스타 설명 앞의 "좋아요 수 - 아이디, 날짜:"와 따옴표는 빼고 본문만
    expect(meta.description).toBe('웨이팅 30분, 에그베네딕트 18,000원. 주말엔 10시 전에 가세요. #성수맛집 #브런치')
  })

  it('og 태그가 없으면 <title> 을 앞뒤 공백 없이 제목으로 쓴다', () => {
    expect(parseLinkMeta('<title> 그냥 페이지 </title>', 'https://a.com').title).toBe('그냥 페이지')
  })

  it('네이버 블로그는 바깥 틀 안의 글(PostView) 주소를 찾는다', () => {
    const outer = '<iframe id="mainFrame" name="mainFrame" src="/PostView.naver?blogId=abc&amp;logNo=123"></iframe>'

    expect(naverBlogInnerUrl(outer, 'https://blog.naver.com/abc/123')).toBe('https://blog.naver.com/PostView.naver?blogId=abc&logNo=123')
  })

  it('서버는 페이지와 썸네일을 받아 썸네일은 data 주소로 담아 하나로 돌려준다', async () => {
    // PNG 파일 첫 4바이트
    const png = new Uint8Array([137, 80, 78, 71])
    const fakeFetch = (async (input: string | URL | Request) => {
      if (String(input).endsWith('/img/cover.jpg')) return new Response(png, { headers: { 'content-type': 'image/png' } })
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }) as typeof fetch

    const preview = await buildPreview('https://www.instagram.com/reel/X/', fakeFetch)

    expect(preview.source).toBe('instagram')
    expect(preview.title).toContain('성수')
    expect(preview.imageData).toBe('data:image/png;base64,iVBORw==')
  })

  it('서버는 사설망 주소로 넘어가는 리다이렉트를 막는다 (보안)', async () => {
    const redirectToLocal = (async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })) as typeof fetch

    await expect(buildPreview('https://evil.example.com/', redirectToLocal)).rejects.toBeInstanceOf(PreviewError)
  })
})

describe('스크랩 카테고리', () => {
  it('처음엔 기본 카테고리가 들어 있다', async () => {
    const repo = createScrapCategoryRepo(freshDb('cat-1'))

    expect((await repo.list()).map((category) => category.name)).toEqual(DEFAULT_SCRAP_CATEGORIES)
  })

  it('새 카테고리는 앞뒤 공백을 빼고 맨 뒤에 더한다', async () => {
    const repo = createScrapCategoryRepo(freshDb('cat-add'))

    await repo.add('  레시피 ')

    expect((await repo.list()).at(-1)?.name).toBe('레시피')
  })

  it.each([
    ['이미 있는 이름', '레시피'],
    ['빈 이름', ''],
    ['미분류', '미분류'],
  ])('%s 으로는 카테고리를 만들지 않는다', async (_case, name) => {
    const repo = createScrapCategoryRepo(freshDb('cat-bad'))
    await repo.add('레시피')

    await expect(repo.add(name)).rejects.toBeInstanceOf(CategoryNameError)
  })

  it('이름을 바꾸고 한 칸 앞으로 옮길 수 있다', async () => {
    const repo = createScrapCategoryRepo(freshDb('cat-2'))
    const id = await repo.add('레시피')
    const ONE_UP = -1

    await repo.rename(id, '요리')
    await repo.move(id, ONE_UP)

    const names = (await repo.list()).map((category) => category.name)
    expect(names.indexOf('요리')).toBe(names.length - 2)
  })

  it('카테고리를 지우면 그 안의 스크랩은 지우지 않고 미분류로 남긴다', async () => {
    const db = freshDb('cat-3')
    const categories = createScrapCategoryRepo(db)
    const bookmarks = createBookmarkRepo(db)
    const [food] = await categories.list()
    const id = await bookmarks.add({ ...okScrap, categoryId: food.id })

    await categories.remove(food.id!)

    expect(await bookmarks.get(id)).toBeTruthy()
    expect((await bookmarks.get(id))?.categoryId).toBeUndefined()
  })

  it('수정할 때 카테고리를 안 보내면 그대로 둔다', async () => {
    const db = freshDb('cat-4')
    const [category] = await createScrapCategoryRepo(db).list()
    const bookmarks = createBookmarkRepo(db)
    const id = await bookmarks.add({ ...okScrap, categoryId: category.id })

    await bookmarks.update(id, { ...okScrap, title: 'B' })

    expect((await bookmarks.get(id))?.categoryId).toBe(category.id)
  })

  it('수정할 때 카테고리를 null 로 보내면 미분류로 바꾼다', async () => {
    const db = freshDb('cat-5')
    const [category] = await createScrapCategoryRepo(db).list()
    const bookmarks = createBookmarkRepo(db)
    const id = await bookmarks.add({ ...okScrap, categoryId: category.id })

    await bookmarks.update(id, { ...okScrap, title: 'B', categoryId: UNSORTED })

    expect((await bookmarks.get(id))?.categoryId).toBeUndefined()
  })
})

describe('캡처와 썸네일', () => {
  const jpeg = (text: string) => new Blob([text], { type: 'image/jpeg' })

  it('캡처를 여러 번 편집해도 처음 원본을 남긴다', async () => {
    const db = freshDb('media-1')
    const media = createScrapMediaRepo(db)
    const id = await media.addCapture(await createBookmarkRepo(db).add(okScrap), jpeg('원본'))

    await media.saveEdited(id, jpeg('편집1'))
    await media.saveEdited(id, jpeg('편집2'))

    const saved = await media.get(id)
    expect(await saved!.blob.text()).toBe('편집2')
    expect(await saved!.original!.text()).toBe('원본')
  })

  it('원본으로 되돌리면 원본이 다시 보이고 따로 둔 원본은 비운다', async () => {
    const db = freshDb('media-restore')
    const media = createScrapMediaRepo(db)
    const id = await media.addCapture(await createBookmarkRepo(db).add(okScrap), jpeg('원본'))
    await media.saveEdited(id, jpeg('편집'))

    await media.restoreOriginal(id)

    const saved = await media.get(id)
    expect(await saved!.blob.text()).toBe('원본')
    expect(saved!.original).toBeUndefined()
  })

  it('대표 사진은 썸네일이 없으면 영상을 빼고 첫 캡처 사진으로 한다', async () => {
    const db = freshDb('media-2')
    const media = createScrapMediaRepo(db)
    const id = await createBookmarkRepo(db).add(okScrap)
    await media.addCapture(id, new Blob(['v'], { type: 'video/mp4' }))
    await media.addCapture(id, jpeg('캡처'))

    const covers = await media.covers()

    expect(await covers.get(id)!.cover!.text()).toBe('캡처')
    expect(covers.get(id)).toMatchObject({ captures: 2, videos: 1 })
  })

  it('대표 사진은 썸네일이 있으면 마지막 썸네일로 하고, 썸네일은 캡처 수에 넣지 않는다', async () => {
    const db = freshDb('media-thumb')
    const media = createScrapMediaRepo(db)
    const id = await createBookmarkRepo(db).add(okScrap)
    await media.setThumb(id, jpeg('썸네일1'))
    await media.setThumb(id, jpeg('썸네일2'))
    await media.addCapture(id, jpeg('캡처'))

    const covers = await media.covers()

    expect(await covers.get(id)!.cover!.text()).toBe('썸네일2')
    expect(covers.get(id)?.captures).toBe(1)
  })

  it('스크랩을 지우면 붙은 캡처 · 썸네일도 지운다', async () => {
    const db = freshDb('media-3')
    const media = createScrapMediaRepo(db)
    const bookmarks = createBookmarkRepo(db)
    const id = await bookmarks.add(okScrap)
    await media.addCapture(id, jpeg('x'))
    await media.setThumb(id, jpeg('t'))

    await bookmarks.remove(id)

    expect(await db.scrapMedia.count()).toBe(0)
  })

  it('백업에 카테고리와 캡처(편집본 + 원본)가 들어가고 다른 기기에서 그대로 돌아온다', async () => {
    const from = freshDb('media-bk-a')
    const [category] = await createScrapCategoryRepo(from).list()
    const id = await createBookmarkRepo(from).add({ ...okScrap, categoryId: category.id, source: 'web' })
    const mediaId = await createScrapMediaRepo(from).addCapture(id, jpeg('원본'))
    await createScrapMediaRepo(from).saveEdited(mediaId, jpeg('편집'))
    const backup = await createBackupRepo(from, '0.1.0').exportAll()
    expect(backup.schemaVersion).toBe(from.verno)
    expect(backup.scrapMedia?.[0].blob).toMatch(/^data:image\/jpeg;base64,/)

    const to = freshDb('media-bk-b')
    await createBackupRepo(to).importAll(JSON.stringify(backup))

    expect((await createBookmarkRepo(to).get(id))?.categoryId).toBe(category.id)
    const restored = await createScrapMediaRepo(to).get(mediaId)
    expect([await restored!.blob.text(), await restored!.original!.text()]).toEqual(['편집', '원본'])
    expect(await createScrapCategoryRepo(to).list()).toHaveLength(DEFAULT_SCRAP_CATEGORIES.length)
  })
})

describe('스크랩 AI 정리', () => {
  it('AI 없이 정리하면 인스타 설명 앞부분(좋아요 수)을 빼고 핵심 문장 · 내 메모 · 해시태그로 쓴다', () => {
    const text = localSummary({
      url: 'https://www.instagram.com/reel/X/',
      title: '성수 브런치 맛집',
      description: '1,234 likes, 56 comments - foodie on November 1, 2026: "웨이팅 30분, 에그베네딕트 18,000원. 주말엔 10시 전에 가세요. #성수맛집 #브런치"',
      memo: '엄마랑 가기',
    })

    expect(text.split('\n')[0]).toBe('웨이팅 30분, 에그베네딕트 18,000원.')
    expect(text).toContain('• 주말엔 10시 전에 가세요.')
    expect(text).not.toContain('likes')
    expect(text).toContain('• 내 메모: 엄마랑 가기')
    expect(text).toContain('#성수맛집 #브런치')
  })

  it('정리할 내용이 없으면 미리보기에 내용이 없다고 말한다', () => {
    expect(localSummary({ url: 'https://a.com', title: 'a.com' })).toContain('미리보기에 내용이 없어서')
  })

  it.each([
    ['주소가 없는', { title: 'x' }],
    ['javascript: 주소인', { url: 'javascript:alert(1)' }],
  ])('서버는 %s 요청을 거절한다', (_case, body) => {
    expect(sanitizeSummaryInput(body)).toBeNull()
  })

  it('서버는 빈 제목을 주소로 채우고, 받지 않는 GIF 사진은 뺀다', () => {
    const input = sanitizeSummaryInput({ url: 'https://a.com', title: '', image: { mediaType: 'image/gif', data: 'AAAA' } })

    expect(input).toEqual({ url: 'https://a.com', title: 'https://a.com' })
  })

  it('JPEG 캡처가 있으면 남기고, AI 에게 사진을 첨부했다고 알린다', () => {
    const input = sanitizeSummaryInput({ url: 'https://a.com', title: 'A', image: { mediaType: 'image/jpeg', data: 'AAAA' } })

    expect(input?.image?.mediaType).toBe('image/jpeg')
    expect(summaryPrompt(input!)).toContain('캡처 사진을 첨부했어')
  })
})

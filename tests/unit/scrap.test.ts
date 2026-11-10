import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { DEFAULT_SCRAP_CATEGORIES, TidyDB } from '../../src/db/database'
import { localSummary, sanitizeSummaryInput, summaryPrompt } from '../../src/lib/ai/scrapSummary'
import {
  detectSource,
  extractSharedUrl,
  instagramEmbedUrl,
  isPublicHttpUrl,
  naverBlogInnerUrl,
  parseLinkMeta,
  sharedTextWithoutUrl,
  youtubeEmbedUrl,
} from '../../src/lib/scrap/link'
import { buildPreview, PreviewError } from '../../src/lib/scrap/previewServer'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { CategoryNameError, createScrapCategoryRepo } from '../../src/repositories/scrapCategoryRepo'
import { createScrapMediaRepo } from '../../src/repositories/scrapMediaRepo'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const d = new TidyDB(name)
  dbs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

describe('링크 출처와 공유받기', () => {
  it('인스타그램, 네이버, X, 유튜브를 알아본다', () => {
    expect(detectSource('https://www.instagram.com/reel/Cx1/')).toBe('instagram')
    expect(detectSource('https://m.blog.naver.com/abc/123')).toBe('naver')
    expect(detectSource('https://naver.me/xyz')).toBe('naver')
    expect(detectSource('https://x.com/user/status/1')).toBe('x')
    expect(detectSource('https://twitter.com/user/status/1')).toBe('x')
    expect(detectSource('https://youtu.be/abc')).toBe('youtube')
    expect(detectSource('https://react.dev')).toBe('web')
  })

  it('공유 글(text) 안에 섞인 주소를 찾는다', () => {
    expect(extractSharedUrl({ text: '이 게시물 보세요 https://www.instagram.com/p/ABC123/?igsh=xyz' })).toBe('https://www.instagram.com/p/ABC123/?igsh=xyz')
    expect(extractSharedUrl({ url: 'https://x.com/a/status/1', text: '아무거나' })).toBe('https://x.com/a/status/1')
    expect(extractSharedUrl({ text: '[네이버 블로그] 성수 맛집 (https://naver.me/5abc).' })).toBe('https://naver.me/5abc')
    expect(extractSharedUrl({ text: '주소 없음' })).toBeNull()
    expect(sharedTextWithoutUrl('성수 맛집 https://naver.me/5abc')).toBe('성수 맛집')
  })

  it('인스타 게시물·릴스는 앱 안에서 재생할 공식 퍼가기 주소로', () => {
    expect(instagramEmbedUrl('https://www.instagram.com/reel/C9xYz_1/?igsh=1')).toBe('https://www.instagram.com/reel/C9xYz_1/embed/captioned/')
    expect(instagramEmbedUrl('https://instagram.com/p/ABC/')).toBe('https://www.instagram.com/p/ABC/embed/captioned/')
    expect(instagramEmbedUrl('https://www.instagram.com/someone/reels/XYZ/')).toBe('https://www.instagram.com/reel/XYZ/embed/captioned/')
    expect(instagramEmbedUrl('https://www.instagram.com/someone/')).toBeNull()
    expect(youtubeEmbedUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ')
    expect(youtubeEmbedUrl('https://youtube.com/shorts/abcdefg')).toBe('https://www.youtube.com/embed/abcdefg')
  })

  it('서버가 내 컴퓨터나 사설망 주소는 읽지 않는다', () => {
    expect(isPublicHttpUrl('https://www.instagram.com/p/1')).toBe(true)
    for (const bad of ['http://localhost:3000', 'http://127.0.0.1/', 'http://192.168.0.1/', 'http://10.0.0.5/', 'http://169.254.169.254/latest', 'file:///etc/passwd', 'http://[::1]/', 'http://intranet/']) {
      expect(isPublicHttpUrl(bad), bad).toBe(false)
    }
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
    const m = parseLinkMeta(html, 'https://www.instagram.com/reel/X/')
    expect(m.title).toBe('성수 브런치 맛집 & 카페 TOP5')
    expect(m.siteName).toBe('Instagram')
    expect(m.image).toBe('https://www.instagram.com/img/cover.jpg')
    expect(m.isVideo).toBe(true)
    // 인스타 설명 앞의 "좋아요 수 - 아이디, 날짜:"와 따옴표는 빼고 본문만
    expect(m.description).toBe('웨이팅 30분, 에그베네딕트 18,000원. 주말엔 10시 전에 가세요. #성수맛집 #브런치')
  })

  it('og 태그가 없으면 <title>로', () => {
    expect(parseLinkMeta('<title> 그냥 페이지 </title>', 'https://a.com').title).toBe('그냥 페이지')
  })

  it('네이버 블로그는 안쪽 글(PostView) 주소를 찾는다', () => {
    const outer = '<iframe id="mainFrame" name="mainFrame" src="/PostView.naver?blogId=abc&amp;logNo=123"></iframe>'
    expect(naverBlogInnerUrl(outer, 'https://blog.naver.com/abc/123')).toBe('https://blog.naver.com/PostView.naver?blogId=abc&logNo=123')
  })

  it('서버: 페이지와 썸네일을 받아 하나로 돌려준다', async () => {
    const png = new Uint8Array([137, 80, 78, 71])
    const fakeFetch = (async (input: string | URL | Request) => {
      const url = String(input)
      if (url.endsWith('/img/cover.jpg')) return new Response(png, { headers: { 'content-type': 'image/png' } })
      return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }) as typeof fetch
    const p = await buildPreview('https://www.instagram.com/reel/X/', fakeFetch)
    expect(p.source).toBe('instagram')
    expect(p.title).toContain('성수')
    expect(p.imageData).toBe('data:image/png;base64,iVBORw==')
  })

  it('서버: 사설망 주소로 넘어가는 리다이렉트는 막는다', async () => {
    const fakeFetch = (async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } })) as typeof fetch
    await expect(buildPreview('https://evil.example.com/', fakeFetch)).rejects.toBeInstanceOf(PreviewError)
  })
})

describe('스크랩 카테고리', () => {
  it('처음엔 기본 카테고리가 들어 있다', async () => {
    const d = freshDb('cat-1')
    const repo = createScrapCategoryRepo(d)
    expect((await repo.list()).map((c) => c.name)).toEqual(DEFAULT_SCRAP_CATEGORIES)
  })

  it('추가, 이름 바꾸기, 순서, 같은 이름 막기', async () => {
    const d = freshDb('cat-2')
    const repo = createScrapCategoryRepo(d)
    const id = await repo.add('  레시피 ')
    expect((await repo.list()).at(-1)?.name).toBe('레시피')
    await expect(repo.add('레시피')).rejects.toBeInstanceOf(CategoryNameError)
    await expect(repo.add('')).rejects.toBeInstanceOf(CategoryNameError)
    await expect(repo.add('미분류')).rejects.toBeInstanceOf(CategoryNameError)
    await repo.rename(id, '요리')
    await repo.move(id, -1)
    const names = (await repo.list()).map((c) => c.name)
    expect(names.indexOf('요리')).toBe(names.length - 2)
  })

  it('카테고리를 지우면 스크랩은 미분류로 남는다', async () => {
    const d = freshDb('cat-3')
    const cats = createScrapCategoryRepo(d)
    const bms = createBookmarkRepo(d)
    const [food] = await cats.list()
    const b = await bms.add({ url: 'https://a.com/', title: 'A', memo: '', categoryId: food.id })
    expect((await bms.get(b))?.categoryId).toBe(food.id)
    await cats.remove(food.id!)
    expect((await bms.get(b))?.categoryId).toBeUndefined()
    expect(await bms.get(b)).toBeTruthy()
  })

  it('수정할 때 미분류(null)로 바꿀 수 있고, 안 보내면 그대로', async () => {
    const d = freshDb('cat-4')
    const [c] = await createScrapCategoryRepo(d).list()
    const bms = createBookmarkRepo(d)
    const id = await bms.add({ url: 'https://a.com/', title: 'A', memo: '', categoryId: c.id })
    await bms.update(id, { url: 'https://a.com/', title: 'B', memo: '' })
    expect((await bms.get(id))?.categoryId).toBe(c.id)
    await bms.update(id, { url: 'https://a.com/', title: 'B', memo: '', categoryId: null })
    expect((await bms.get(id))?.categoryId).toBeUndefined()
  })
})

describe('캡처와 썸네일', () => {
  const img = (text: string) => new Blob([text], { type: 'image/jpeg' })

  it('편집하면 원본을 남기고, 원본으로 되돌릴 수 있다', async () => {
    const d = freshDb('media-1')
    const media = createScrapMediaRepo(d)
    const b = await createBookmarkRepo(d).add({ url: 'https://a.com/', title: 'A', memo: '' })
    const id = await media.addCapture(b, img('원본'))
    await media.saveEdited(id, img('편집1'))
    await media.saveEdited(id, img('편집2'))
    let m = await media.get(id)
    expect(await m!.blob.text()).toBe('편집2')
    expect(await m!.original!.text()).toBe('원본')
    await media.restoreOriginal(id)
    m = await media.get(id)
    expect(await m!.blob.text()).toBe('원본')
    expect(m!.original).toBeUndefined()
  })

  it('대표 사진은 썸네일 먼저, 없으면 첫 캡처 사진 (영상은 빼고)', async () => {
    const d = freshDb('media-2')
    const media = createScrapMediaRepo(d)
    const bms = createBookmarkRepo(d)
    const a = await bms.add({ url: 'https://a.com/', title: 'A', memo: '' })
    const b = await bms.add({ url: 'https://b.com/', title: 'B', memo: '' })
    await media.addCapture(a, new Blob(['v'], { type: 'video/mp4' }))
    await media.addCapture(a, img('캡처'))
    await media.setThumb(b, img('썸네일1'))
    await media.setThumb(b, img('썸네일2'))
    await media.addCapture(b, img('캡처b'))
    const covers = await media.covers()
    expect(await covers.get(a)!.cover!.text()).toBe('캡처')
    expect(covers.get(a)).toMatchObject({ captures: 2, videos: 1 })
    expect(await covers.get(b)!.cover!.text()).toBe('썸네일2')
    expect(covers.get(b)?.captures).toBe(1)
  })

  it('스크랩을 지우면 붙은 사진도 지운다', async () => {
    const d = freshDb('media-3')
    const media = createScrapMediaRepo(d)
    const bms = createBookmarkRepo(d)
    const a = await bms.add({ url: 'https://a.com/', title: 'A', memo: '' })
    await media.addCapture(a, img('x'))
    await media.setThumb(a, img('t'))
    await bms.remove(a)
    expect(await d.scrapMedia.count()).toBe(0)
  })

  it('백업에 카테고리와 캡처도 들어가고 그대로 돌아온다', async () => {
    const a = freshDb('media-bk-a')
    const [c] = await createScrapCategoryRepo(a).list()
    const id = await createBookmarkRepo(a).add({ url: 'https://a.com/', title: 'A', memo: '', categoryId: c.id, source: 'web' })
    const mId = await createScrapMediaRepo(a).addCapture(id, img('원본'))
    await createScrapMediaRepo(a).saveEdited(mId, img('편집'))
    const backup = await createBackupRepo(a, '0.1.0').exportAll()
    expect(backup.schemaVersion).toBe(a.verno)
    expect(backup.scrapMedia?.[0].blob).toMatch(/^data:image\/jpeg;base64,/)

    const b = freshDb('media-bk-b')
    await createBackupRepo(b).importAll(JSON.stringify(backup))
    expect((await createBookmarkRepo(b).get(id))?.categoryId).toBe(c.id)
    const m = await createScrapMediaRepo(b).get(mId)
    expect(await m!.blob.text()).toBe('편집')
    expect(await m!.original!.text()).toBe('원본')
    expect((await createScrapCategoryRepo(b).list()).length).toBe(DEFAULT_SCRAP_CATEGORIES.length)
  })
})

describe('스크랩 AI 정리', () => {
  it('AI 없이: 인스타 설명 앞부분(좋아요 수)을 빼고 핵심 문장과 해시태그로', () => {
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

  it('정보가 없으면 그렇다고 말한다', () => {
    expect(localSummary({ url: 'https://a.com', title: 'a.com' })).toContain('미리보기에 내용이 없어서')
  })

  it('서버로 들어온 값 다듬기: 주소가 없거나 이상하면 거절, 큰 사진은 뺀다', () => {
    expect(sanitizeSummaryInput({ title: 'x' })).toBeNull()
    expect(sanitizeSummaryInput({ url: 'javascript:alert(1)' })).toBeNull()
    const ok = sanitizeSummaryInput({ url: 'https://a.com', title: '', image: { mediaType: 'image/gif', data: 'AAAA' } })
    expect(ok).toEqual({ url: 'https://a.com', title: 'https://a.com' })
    const withImg = sanitizeSummaryInput({ url: 'https://a.com', title: 'A', image: { mediaType: 'image/jpeg', data: 'AAAA' } })
    expect(withImg?.image?.mediaType).toBe('image/jpeg')
    expect(summaryPrompt(withImg!)).toContain('캡처 사진을 첨부했어')
  })
})

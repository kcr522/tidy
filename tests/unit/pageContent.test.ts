import { describe, expect, it } from 'vitest'
import { localSummary, summaryPrompt } from '../../src/lib/ai/scrapSummary'
import { captureSite, contentImageUrls, htmlToText, mainRegion, readPageContent, shotTarget } from '../../src/lib/scrap/pageContent'

const PHOTO_BYTES = new Uint8Array(3000).fill(7) // 너무 작은 아이콘으로 걸러지지 않을 크기
const photoReply = (type = 'image/jpeg') => new Response(PHOTO_BYTES, { headers: { 'content-type': type } })
const htmlReply = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })
const notFound = () => new Response('', { status: 404 })
const DATA_JPEG = /^data:image\/jpeg;base64,/

describe('사이트 본문 읽기', () => {
  it('메뉴 · 스크립트 · 꼬리말을 빼고, 줄바꿈을 지키며 글만 남긴다', () => {
    const html = '<nav>메뉴</nav><script>x()</script><p>삼겹살은 &amp; 키친타월로</p><p>환기 필수<br>뚜껑 덮기</p><footer>꼬리</footer>'

    expect(htmlToText(html)).toBe('삼겹살은 & 키친타월로\n환기 필수\n뚜껑 덮기')
  })

  it('네이버 블로그는 본문 영역만 고르고, 큰 사진만 원본 크기 주소로 바꾼다', () => {
    const page = '<div id="top">광고</div><div class="se-main-container"><p>본문</p><img src="https://postfiles.pstatic.net/a.jpg?type=w80_blur"><img src="/icon.png" width="20"></div><div class="post_footer">댓글</div>'

    const region = mainRegion(page)

    expect(htmlToText(region)).toBe('본문')
    expect(contentImageUrls(region, 'https://blog.naver.com/x')).toEqual(['https://postfiles.pstatic.net/a.jpg?type=w773'])
  })

  it('X 글은 로그인 없이 공식 퍼가기 서버에서 글과 사진을 읽는다', async () => {
    const tweet = { text: '삼겹살 냄새 안 나게 굽는 법: 물 반 컵', user: { name: '민상', screen_name: 'ms' }, photos: [{ url: 'https://pbs.twimg.com/media/a.jpg' }] }
    const fakeFetch = (async (url: string) => {
      if (url.startsWith('https://cdn.syndication.twimg.com/tweet-result?id=123')) return new Response(JSON.stringify(tweet))
      if (url === 'https://pbs.twimg.com/media/a.jpg') return photoReply()
      return notFound()
    }) as typeof fetch

    const content = await readPageContent('https://x.com/ms/status/123', fakeFetch)

    expect(content.text).toContain('물 반 컵')
    expect(content.images).toHaveLength(1)
    expect(content.images[0]).toMatch(DATA_JPEG)
  })

  it('일반 사이트는 og 설명 + 본문 글과, og 사진 + 본문 사진을 읽는다', async () => {
    const page = '<html><head><meta property="og:description" content="요약 설명입니다"><meta property="og:image" content="/cover.jpg"></head><body><article><h1>제목</h1><p>본문 내용</p><img src="/p1.jpg"></article></body></html>'
    const fakeFetch = (async (url: string) => {
      if (url === 'https://a.com/post') return htmlReply(page)
      if (url.endsWith('.jpg')) return photoReply()
      return notFound()
    }) as typeof fetch

    const content = await readPageContent('https://a.com/post', fakeFetch)

    expect(content.text).toBe('요약 설명입니다\n제목\n본문 내용')
    expect(content.images).toHaveLength(2)
  })

  it('AI 에 보낼 글에 사이트 본문이 들어가고, AI 없을 때도 본문 첫 문장으로 정리한다', () => {
    const input = { url: 'https://x.com/a/status/1', title: '내 제목', memo: '나중에', pageText: '고기를 굽기 전에 물을 반 컵 붓는다. 그러면 연기가 덜 난다. 환기는 필수다.' }

    expect(summaryPrompt(input)).toContain('사이트 본문')
    expect(localSummary(input).split('\n')[0]).toContain('물을 반 컵')
  })
})

describe('사이트 화면 자동 캡처', () => {
  it('X 글은 로그인 화면 대신 퍼가기 화면을 찍는다', () => {
    expect(shotTarget('https://x.com/a/status/55')).toContain('platform.twitter.com/embed/Tweet.html?id=55')
  })

  it.each([
    ['인스타 게시물은 캡션 퍼가기 화면', 'https://www.instagram.com/p/ABC/', 'https://www.instagram.com/p/ABC/embed/captioned/'],
    ['일반 사이트는 그 주소', 'https://a.com/', 'https://a.com/'],
  ])('%s 을 찍는다', (_case, url, target) => {
    expect(shotTarget(url)).toBe(target)
  })

  it('microlink 가 안 되면 mshots 로 찍고, "만드는 중" gif 는 건너뛰고 다시 받는다', async () => {
    let mshotsCalls = 0
    const fakeFetch = (async (url: string) => {
      if (url.startsWith('https://api.microlink.io/')) return new Response('{}', { status: 429 })
      if (url.startsWith('https://s.wordpress.com/mshots/')) return ++mshotsCalls === 1 ? photoReply('image/gif') : photoReply('image/jpeg')
      return notFound()
    }) as typeof fetch

    const shot = await captureSite('https://a.com/', fakeFetch)

    expect(shot).toMatch(DATA_JPEG)
    expect(mshotsCalls).toBe(2)
  }, 15000)

  it('microlink 가 되면 그 사진을 쓴다', async () => {
    const fakeFetch = (async (url: string) => (url.startsWith('https://api.microlink.io/') ? photoReply('image/png') : notFound())) as typeof fetch

    expect(await captureSite('https://a.com/', fakeFetch)).toMatch(/^data:image\/png;base64,/)
  })
})

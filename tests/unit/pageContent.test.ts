import { describe, expect, it } from 'vitest'
import { localSummary, summaryPrompt } from '../../src/lib/ai/scrapSummary'
import { captureSite, contentImageUrls, htmlToText, mainRegion, readPageContent, shotTarget } from '../../src/lib/scrap/pageContent'

const png = new Uint8Array(3000).fill(7)
const img = (type = 'image/jpeg') => new Response(png, { headers: { 'content-type': type } })
const html = (body: string) => new Response(body, { headers: { 'content-type': 'text/html; charset=utf-8' } })

describe('사이트 본문 읽기', () => {
  it('메뉴·스크립트를 빼고 글만 남긴다', () => {
    const t = htmlToText('<nav>메뉴</nav><script>x()</script><p>삼겹살은 &amp; 키친타월로</p><p>환기 필수<br>뚜껑 덮기</p><footer>꼬리</footer>')
    expect(t).toBe('삼겹살은 & 키친타월로\n환기 필수\n뚜껑 덮기')
  })

  it('네이버 블로그 본문 영역과 큰 사진만 고른다', () => {
    const page = '<div id="top">광고</div><div class="se-main-container"><p>본문</p><img src="https://postfiles.pstatic.net/a.jpg?type=w80_blur"><img src="/icon.png" width="20"></div><div class="post_footer">댓글</div>'
    const region = mainRegion(page)
    expect(htmlToText(region)).toBe('본문')
    expect(contentImageUrls(region, 'https://blog.naver.com/x')).toEqual(['https://postfiles.pstatic.net/a.jpg?type=w773'])
  })

  it('X 글은 로그인 없이 공식 퍼가기 서버에서 글과 사진을 읽는다', async () => {
    const f = (async (u: string) => {
      if (u.startsWith('https://cdn.syndication.twimg.com/tweet-result?id=123')) return new Response(JSON.stringify({ text: '삼겹살 냄새 안 나게 굽는 법: 물 반 컵', user: { name: '민상', screen_name: 'ms' }, photos: [{ url: 'https://pbs.twimg.com/media/a.jpg' }] }))
      if (u === 'https://pbs.twimg.com/media/a.jpg') return img()
      return new Response('', { status: 404 })
    }) as typeof fetch
    const c = await readPageContent('https://x.com/ms/status/123', f)
    expect(c.text).toContain('물 반 컵')
    expect(c.images).toHaveLength(1)
    expect(c.images[0]).toMatch(/^data:image\/jpeg;base64,/)
  })

  it('일반 사이트는 og 설명 + 본문 + 사진', async () => {
    const f = (async (u: string) => {
      if (u === 'https://a.com/post') return html('<html><head><meta property="og:description" content="요약 설명입니다"><meta property="og:image" content="/cover.jpg"></head><body><article><h1>제목</h1><p>본문 내용</p><img src="/p1.jpg"></article></body></html>')
      if (u.endsWith('.jpg')) return img()
      return new Response('', { status: 404 })
    }) as typeof fetch
    const c = await readPageContent('https://a.com/post', f)
    expect(c.text).toBe('요약 설명입니다\n제목\n본문 내용')
    expect(c.images).toHaveLength(2)
  })

  it('AI에 보낼 글에 사이트 본문이 들어가고, AI 없을 때도 본문으로 정리한다', () => {
    const input = { url: 'https://x.com/a/status/1', title: '내 제목', memo: '나중에', pageText: '고기를 굽기 전에 물을 반 컵 붓는다. 그러면 연기가 덜 난다. 환기는 필수다.' }
    expect(summaryPrompt(input)).toContain('사이트 본문')
    expect(localSummary(input).split('\n')[0]).toContain('물을 반 컵')
  })
})

describe('사이트 화면 자동 캡처', () => {
  it('X·인스타그램은 로그인 화면 대신 퍼가기 화면을 찍는다', () => {
    expect(shotTarget('https://x.com/a/status/55')).toContain('platform.twitter.com/embed/Tweet.html?id=55')
    expect(shotTarget('https://www.instagram.com/p/ABC/')).toBe('https://www.instagram.com/p/ABC/embed/captioned/')
    expect(shotTarget('https://a.com/')).toBe('https://a.com/')
  })

  it('microlink 가 안 되면 mshots 로, "만드는 중" gif 는 건너뛴다', async () => {
    let mshots = 0
    const f = (async (u: string) => {
      if (u.startsWith('https://api.microlink.io/')) return new Response('{}', { status: 429 })
      if (u.startsWith('https://s.wordpress.com/mshots/')) return ++mshots === 1 ? img('image/gif') : img('image/jpeg')
      return new Response('', { status: 404 })
    }) as typeof fetch
    const d = await captureSite('https://a.com/', f)
    expect(d).toMatch(/^data:image\/jpeg;base64,/)
    expect(mshots).toBe(2)
  }, 15000)

  it('microlink 가 되면 그 사진을 쓴다', async () => {
    const f = (async (u: string) => (u.startsWith('https://api.microlink.io/') ? img('image/png') : new Response('', { status: 404 }))) as typeof fetch
    expect(await captureSite('https://a.com/', f)).toMatch(/^data:image\/png;base64,/)
  })
})

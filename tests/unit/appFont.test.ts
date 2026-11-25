import { describe, expect, it } from 'vitest'
import { APP_FONTS, facesCss, rewriteFontCss } from '../../src/lib/appFont'

describe('앱 글꼴', () => {
  it('Pretendard(기본) + 인기 글꼴 5개, 기본 말고는 모두 받을 곳이 있다', () => {
    expect(APP_FONTS.map((f) => f.name)).toEqual(['Pretendard', 'Noto Sans KR', '나눔스퀘어 네오', 'G마켓 산스', '에스코어 드림', '스포카 한 산스 네오'])
    expect(new Set(APP_FONTS.map((f) => f.id)).size).toBe(APP_FONTS.length)
    for (const f of APP_FONTS.slice(1)) expect(Boolean(f.css) || (f.faces?.length ?? 0) > 0).toBe(true)
  })

  it('굵기별 파일로 @font-face 를 만든다', () => {
    const css = facesCss(
      [
        { weight: '400 500', url: 'https://cdn.jsdelivr.net/a.woff2' },
        { weight: '700', url: 'https://cdn.jsdelivr.net/b.woff' },
      ],
      'Tidy Font',
    )
    expect(css).toContain("font-family: 'Tidy Font'; font-style: normal; font-weight: 400 500;")
    expect(css).toContain("url('https://cdn.jsdelivr.net/a.woff2') format('woff2')")
    expect(css).toContain("url('https://cdn.jsdelivr.net/b.woff') format('woff')")
  })

  it('구글 폰트 CSS 이름을 바꾸고 local() 은 뺀다', () => {
    const css = `@font-face { font-family: 'Noto Sans KR'; font-display: swap; src: local('Noto Sans KR'), url(https://fonts.gstatic.com/s/notosanskr/a.woff2) format('woff2'); unicode-range: U+d723-d728; }`
    const out = rewriteFontCss(css, 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR', 'Tidy Font')
    expect(out).toContain("font-family: 'Tidy Font'")
    expect(out).toContain("url('https://fonts.gstatic.com/s/notosanskr/a.woff2')")
    expect(out).toContain('unicode-range: U+d723-d728')
    expect(out).not.toContain('local(')
    expect(out.match(/font-display/g)).toHaveLength(1)
  })
})

import { describe, expect, it } from 'vitest'
import { APP_FONTS, FONT_KINDS, rewriteFontCss } from '../../src/lib/appFont'

describe('앱 글꼴', () => {
  it('종류마다 글꼴이 있고 기본 말고 12개', () => {
    expect(APP_FONTS.filter((f) => f.id !== 'pretendard')).toHaveLength(12)
    for (const k of FONT_KINDS) expect(APP_FONTS.some((f) => f.kind === k.kind)).toBe(true)
    expect(new Set(APP_FONTS.map((f) => f.id)).size).toBe(APP_FONTS.length)
  })

  it('CSS 이름을 바꾸고 상대 주소를 절대 주소로, local() 은 뺀다', () => {
    const css = `@font-face {\n  font-family: '나눔스퀘어라운드';\n  src: local('나눔스퀘어라운드'), local('NanumSquareRound'), url(./NanumSquareRoundR.woff2) format('woff2');\n  font-display: swap;\n  font-weight: 400;\n}`
    const out = rewriteFontCss(css, 'https://cdn.jsdelivr.net/npm/@kfonts/nanum-square-round@0.2.0/index.css', 'Tidy Font', 112)
    expect(out).toContain("font-family: 'Tidy Font'")
    expect(out).toContain("url('https://cdn.jsdelivr.net/npm/@kfonts/nanum-square-round@0.2.0/NanumSquareRoundR.woff2')")
    expect(out).not.toContain('local(')
    expect(out).toContain('size-adjust: 112%')
    expect(out.match(/font-display/g)).toHaveLength(1)
  })

  it('구글 폰트 절대 주소는 그대로', () => {
    const css = `@font-face { font-family: 'Jua'; src: url(https://fonts.gstatic.com/s/jua/v18/a.woff2) format('woff2'); unicode-range: U+d723-d728; }`
    const out = rewriteFontCss(css, 'https://fonts.googleapis.com/css2?family=Jua', 'Tidy Font')
    expect(out).toContain("url('https://fonts.gstatic.com/s/jua/v18/a.woff2')")
    expect(out).toContain('unicode-range: U+d723-d728')
    expect(out).not.toContain('size-adjust')
  })
})

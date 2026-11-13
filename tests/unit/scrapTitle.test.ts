import { describe, expect, it } from 'vitest'
import { isAutoSocialTitle } from '../../src/lib/scrap/enrich'
import { parseLinkMeta, simpleTitle, socialCaptionFromTitle, tidyTitle } from '../../src/lib/scrap/link'
import { shareRoute } from '../../src/platform/shareIntent'

describe('AI 없이 짧은 스크랩 제목', () => {
  it('"Instagram의 OO님 : "…"" 에서 본문만 꺼낸다', () => {
    expect(socialCaptionFromTitle('Instagram의 집조아 🏠 | 집밥 • 샌드위치 • 홈베이킹님 : "웬만한 디저트는 이제 집에서"')).toBe('웬만한 디저트는 이제 집에서')
    expect(socialCaptionFromTitle('jibjoa on Instagram: "버터 없이 쿠키"')).toBe('버터 없이 쿠키')
    expect(socialCaptionFromTitle('Minsang Kim on X: "삼겹살 팁" / X')).toBe('삼겹살 팁')
    expect(socialCaptionFromTitle('그냥 블로그 글')).toBeNull()
  })

  it('본문 첫 문장에서 해시태그·아이디를 빼고 40자 안으로', () => {
    expect(simpleTitle('웬만한 디저트는 이제 집에서 만들어요 🍪\n재료: 버터 30g #홈베이킹')).toBe('웬만한 디저트는 이제 집에서 만들어요 🍪')
    expect(simpleTitle('#먹스타그램 @abc 오늘은 성수 카페 투어 다녀왔어요! 분위기 최고')).toBe('오늘은 성수 카페 투어 다녀왔어요!')
    expect(simpleTitle('가'.repeat(60)).length).toBeLessThanOrEqual(41)
  })

  it('인스타그램·X 제목은 이름 대신 본문으로, 본문이 없으면 "Instagram 게시물"', () => {
    const t = 'Instagram의 집조아님 : "웬만한 디저트는 이제 ..."'
    expect(tidyTitle(t, '웬만한 디저트는 이제 집에서 만들어요 🍪\n재료', 'instagram')).toBe('웬만한 디저트는 이제 집에서 만들어요 🍪')
    expect(tidyTitle('Instagram의 집조아님', undefined, 'instagram')).toBe('Instagram 게시물')
    expect(tidyTitle('네이버 블로그 글', undefined, 'web')).toBe('네이버 블로그 글')
  })

  it('미리보기를 읽을 때부터 짧은 제목으로', () => {
    const html = `<meta property="og:title" content="Instagram의 집조아님 : &quot;웬만한 디저트&quot;"><meta property="og:description" content="좋아요 1,234개, 댓글 5개 - jibjoa님, 2026년 11월 13일: &quot;웬만한 디저트는 이제 집에서 만들어요. 재료는 버터 #홈베이킹&quot;">`
    const m = parseLinkMeta(html, 'https://www.instagram.com/reel/ABC/')
    expect(m.title).toBe('웬만한 디저트는 이제 집에서 만들어요')
  })

  it('사용자가 직접 쓴 제목은 자동 제목이 아니다', () => {
    expect(isAutoSocialTitle('Instagram의 집조아님 : "웬만한"', 'instagram')).toBe(true)
    expect(isAutoSocialTitle('Instagram 게시물', 'instagram')).toBe(true)
    expect(isAutoSocialTitle('쿠키 레시피', 'instagram')).toBe(false)
    expect(isAutoSocialTitle('Instagram의 집조아님 : "웬만한"', 'web')).toBe(false)
  })
})

describe('공유 → Tidy (안드로이드 앱)', () => {
  it('공유로 들어온 글을 /share 주소로', () => {
    expect(shareRoute({ text: 'https://www.instagram.com/reel/ABC/?igsh=1' })).toBe('/share?text=https%3A%2F%2Fwww.instagram.com%2Freel%2FABC%2F%3Figsh%3D1')
    expect(shareRoute({ text: '', title: '' })).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { isAutoSocialTitle } from '../../src/lib/scrap/enrich'
import { parseLinkMeta, simpleTitle, socialCaptionFromTitle, tidyTitle } from '../../src/lib/scrap/link'
import { shareRoute } from '../../src/platform/shareIntent'

// 짧은 제목은 40자 + 말줄임표 1자
const MAX_TITLE = 41

describe('AI 없이 짧은 스크랩 제목', () => {
  it.each([
    ['Instagram의 집조아 🏠 | 집밥 • 샌드위치 • 홈베이킹님 : "웬만한 디저트는 이제 집에서"', '웬만한 디저트는 이제 집에서'],
    ['jibjoa on Instagram: "버터 없이 쿠키"', '버터 없이 쿠키'],
    ['Minsang Kim on X: "삼겹살 팁" / X', '삼겹살 팁'],
    ['그냥 블로그 글', null],
  ])('"%s" 에서 따옴표 속 본문 %s 만 꺼낸다', (title, caption) => {
    expect(socialCaptionFromTitle(title)).toBe(caption)
  })

  it.each([
    ['첫 줄만', '웬만한 디저트는 이제 집에서 만들어요 🍪\n재료: 버터 30g #홈베이킹', '웬만한 디저트는 이제 집에서 만들어요 🍪'],
    ['해시태그 · 아이디를 빼고 첫 문장만', '#먹스타그램 @abc 오늘은 성수 카페 투어 다녀왔어요! 분위기 최고', '오늘은 성수 카페 투어 다녀왔어요!'],
  ])('본문에서 %s 제목으로 쓴다', (_case, caption, title) => {
    expect(simpleTitle(caption)).toBe(title)
  })

  it('60자 본문은 40자 안으로 줄인다', () => {
    expect(simpleTitle('가'.repeat(60)).length).toBeLessThanOrEqual(MAX_TITLE)
  })

  it.each([
    ['인스타 자동 제목은 본문 첫 줄로', 'Instagram의 집조아님 : "웬만한 디저트는 이제 ..."', '웬만한 디저트는 이제 집에서 만들어요 🍪\n재료', 'instagram', '웬만한 디저트는 이제 집에서 만들어요 🍪'],
    ['본문이 없는 인스타는 "Instagram 게시물"', 'Instagram의 집조아님', undefined, 'instagram', 'Instagram 게시물'],
    ['웹 페이지 제목은 그대로', '네이버 블로그 글', undefined, 'web', '네이버 블로그 글'],
  ])('제목 다듬기: %s', (_case, title, caption, source, tidy) => {
    expect(tidyTitle(title, caption, source as 'instagram' | 'web')).toBe(tidy)
  })

  it('미리보기를 읽을 때부터 인스타 제목을 본문 첫 문장으로 줄인다', () => {
    const html = `<meta property="og:title" content="Instagram의 집조아님 : &quot;웬만한 디저트&quot;"><meta property="og:description" content="좋아요 1,234개, 댓글 5개 - jibjoa님, 2026년 11월 13일: &quot;웬만한 디저트는 이제 집에서 만들어요. 재료는 버터 #홈베이킹&quot;">`

    expect(parseLinkMeta(html, 'https://www.instagram.com/reel/ABC/').title).toBe('웬만한 디저트는 이제 집에서 만들어요')
  })

  it.each([
    ['인스타 이름 : "본문" 제목', 'Instagram의 집조아님 : "웬만한"', 'instagram', true],
    ['"Instagram 게시물"', 'Instagram 게시물', 'instagram', true],
    ['사용자가 직접 쓴 제목', '쿠키 레시피', 'instagram', false],
    ['웹 스크랩의 인스타 모양 제목', 'Instagram의 집조아님 : "웬만한"', 'web', false],
  ])('%s 은 자동 제목인가: $3', (_case, title, source, isAuto) => {
    expect(isAutoSocialTitle(title, source as 'instagram' | 'web')).toBe(isAuto)
  })
})

describe('공유 → Tidy (안드로이드 앱)', () => {
  it('공유로 들어온 글을 /share 주소의 text 로 넘긴다', () => {
    expect(shareRoute({ text: 'https://www.instagram.com/reel/ABC/?igsh=1' })).toBe('/share?text=https%3A%2F%2Fwww.instagram.com%2Freel%2FABC%2F%3Figsh%3D1')
  })

  it('글도 제목도 비었으면 열지 않는다', () => {
    expect(shareRoute({ text: '', title: '' })).toBeNull()
  })
})

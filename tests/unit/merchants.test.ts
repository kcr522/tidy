import { describe, expect, it } from 'vitest'
import { BRANDS, brandShort, brandTextColor, logoUrls, matchMerchant } from '../../src/lib/merchants'

const displayName = (text: string) => matchMerchant(text)?.display ?? null

describe('matchMerchant', () => {
  it.each([
    ['다이소 운남점', '운남 다이소'],
    ['다이소운남점', '운남 다이소'],
    ['(주)아성다이소 홍대2호점', '홍대2호 다이소'],
    ['스타벅스 강남R점', '강남R 스타벅스'],
    ['GS25 역삼점', '역삼 GS25'],
    ['CU(신촌역점)', '신촌역 CU'],
  ])('브랜드 + 지점 "%s" 는 "%s" 로 보여 준다', (text, display) => {
    expect(displayName(text)).toBe(display)
  })

  it.each([
    ['올리브영', '올리브영'],
    ['CJ올리브영 온라인몰', '올리브영'],
    ['스벅 라떼', '스타벅스'],
  ])('지점이 없는 "%s" 는 브랜드 이름 "%s" 만 보여 준다', (text, display) => {
    expect(displayName(text)).toBe(display)
  })

  it.each([
    ['쿠팡이츠 주문', '쿠팡이츠'],
    ['쿠팡 로켓배송', '쿠팡'],
  ])('긴 브랜드 이름을 먼저 찾는다: "%s" → %s', (text, brand) => {
    expect(matchMerchant(text)?.brand.name).toBe(brand)
  })

  it.each([
    ['KTX 서울-부산', null],
    ['KT 통신요금', 'KT'],
    ['cucumber', null],
  ])('짧은 영어 브랜드는 단어 안에 섞이면 잡지 않는다: "%s" → %s', (text, display) => {
    expect(displayName(text)).toBe(display)
  })

  it.each(['동네 분식', ''])('모르는 가게나 빈 메모 "%s" 는 null 이다', (text) => {
    expect(displayName(text)).toBeNull()
  })

  it('브랜드의 추천 카테고리와 동그라미 속 짧은 이름을 준다', () => {
    const oliveYoung = matchMerchant('올리브영 명동점')!

    expect(oliveYoung.brand.category).toBe('쇼핑')
    expect(brandShort(oliveYoung.brand)).toBe('올영')
    expect(brandShort(matchMerchant('다이소')!.brand)).toBe('다이소')
  })

  it.each([
    ['#FFE600', '#191f28'],
    ['#E60012', '#ffffff'],
  ])('브랜드 색 %s 위에는 읽히는 %s 글자를 쓴다', (brandColor, textColor) => {
    expect(brandTextColor(brandColor)).toBe(textColor)
  })
})

describe('isUnclearMerchant', () => {
  it.each(['KCP*결제', 'NICE페이먼츠', '(주)KG이니시스', '토스페이먼츠', 'PAYPAL *STEAM'])('결제 대행사 이름 "%s" 는 어느 가게인지 물어본다', async (name) => {
    const { isUnclearMerchant } = await import('../../src/lib/merchants')

    expect(isUnclearMerchant(name)).toBe(true)
  })

  it.each(['NICE*배달의민족', '동네 분식', ''])('가게를 알 수 있는 "%s" 는 묻지 않는다', async (name) => {
    const { isUnclearMerchant } = await import('../../src/lib/merchants')

    expect(isUnclearMerchant(name)).toBe(false)
  })
})

describe('가게 로고 파일', () => {
  it('앱 아이콘 · 위키백과 로고를 쓰는 브랜드는 public/brands 에 그림이 있다', async () => {
    const { existsSync } = await import('node:fs')
    const withLogo = BRANDS.filter((brand) => brand.app || brand.wiki)

    const missing = withLogo.filter((brand) => !existsSync(`public${logoUrls(brand)[0]}`)).map((brand) => brand.name)

    expect(missing).toEqual([])
  })

  it.each(['다이소 운남점', '올리브영 수완점', '롯데리아 첨단점', 'GS25 운남점', '노브랜드버거 수완점'])('"%s" 는 앱에 넣어 둔 로고를 먼저 쓴다', (name) => {
    expect(logoUrls(matchMerchant(name)!.brand)[0]).toMatch(/^\/brands\//)
  })
})

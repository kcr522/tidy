import { describe, expect, it } from 'vitest'
import { brandShort, brandTextColor, matchMerchant } from '../../src/lib/merchants'

const d = (t: string) => matchMerchant(t)?.display ?? null

describe('matchMerchant', () => {
  it('브랜드 + 지점', () => {
    expect(d('다이소 운남점')).toBe('운남 다이소')
    expect(d('다이소운남점')).toBe('운남 다이소')
    expect(d('(주)아성다이소 홍대2호점')).toBe('홍대2호 다이소')
    expect(d('스타벅스 강남R점')).toBe('강남R 스타벅스')
    expect(d('GS25 역삼점')).toBe('역삼 GS25')
    expect(d('CU(신촌역점)')).toBe('신촌역 CU')
  })

  it('지점이 없으면 브랜드 이름만', () => {
    expect(d('올리브영')).toBe('올리브영')
    expect(d('CJ올리브영 온라인몰')).toBe('올리브영')
    expect(d('스벅 라떼')).toBe('스타벅스')
  })

  it('긴 이름이 먼저 (쿠팡이츠 ≠ 쿠팡)', () => {
    expect(matchMerchant('쿠팡이츠 주문')?.brand.name).toBe('쿠팡이츠')
    expect(matchMerchant('쿠팡 로켓배송')?.brand.name).toBe('쿠팡')
  })

  it('짧은 영어 이름은 단어 안에 섞이면 안 잡는다', () => {
    expect(d('KTX 서울-부산')).toBeNull()
    expect(d('KT 통신요금')).toBe('KT')
    expect(d('cucumber')).toBeNull()
  })

  it('모르는 가게나 빈 메모는 null', () => {
    expect(d('동네 분식')).toBeNull()
    expect(d('')).toBeNull()
  })

  it('카테고리 추천과 동그라미 글자', () => {
    const m = matchMerchant('올리브영 명동점')!
    expect(m.brand.category).toBe('쇼핑')
    expect(brandShort(m.brand)).toBe('올영')
    expect(brandShort(matchMerchant('다이소')!.brand)).toBe('다이소')
    expect(brandTextColor('#FFE600')).toBe('#191f28')
    expect(brandTextColor('#E60012')).toBe('#ffffff')
  })
})

describe('isUnclearMerchant', () => {
  it('결제 대행사 이름은 물어본다', async () => {
    const { isUnclearMerchant } = await import('../../src/lib/merchants')
    expect(isUnclearMerchant('KCP*결제')).toBe(true)
    expect(isUnclearMerchant('NICE페이먼츠')).toBe(true)
    expect(isUnclearMerchant('(주)KG이니시스')).toBe(true)
    expect(isUnclearMerchant('토스페이먼츠')).toBe(true)
    expect(isUnclearMerchant('PAYPAL *STEAM')).toBe(true)
  })
  it('가게를 알 수 있으면 묻지 않는다', async () => {
    const { isUnclearMerchant } = await import('../../src/lib/merchants')
    expect(isUnclearMerchant('NICE*배달의민족')).toBe(false)
    expect(isUnclearMerchant('동네 분식')).toBe(false)
    expect(isUnclearMerchant('')).toBe(false)
  })
})

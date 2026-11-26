import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { MealError, mealPrompt, priceLine, sanitizeGuess, sanitizeMealRequest, type MealGuess } from '../../src/lib/ai/meal'
import { geminiMealEngine, mealEngineFor } from '../../src/lib/ai/mealEngines'
import { nearbyPlaces } from '../../src/lib/ai/places'
import { readPhotoInfo, toDateTime, validLocation } from '../../src/lib/meal/photo'
import { mealMemo, suggestedAmount } from '../../src/lib/meal/record'

const guess: MealGuess = {
  dish: '김치찌개',
  place: '진미식당',
  placeSure: true,
  price: 9000,
  priceUrl: 'https://map.naver.com/x',
  priceNote: '네이버 플레이스 메뉴',
  guessPrice: null,
  servings: 1,
}

const GANGNAM = { lat: 37.4979, lng: 127.0276 } // 강남역 근처 (fixtures/meal-gps.jpg 에 넣은 좌표)
const okLocation = { lat: 37.5, lng: 127 }
const okImage = 'QUJD' // base64 로 "ABC"

describe('사진 정보 읽기', () => {
  it('EXIF 에서 찍은 시각과 GPS 위치를 읽는다', async () => {
    const bytes = readFileSync(new URL('../fixtures/meal-gps.jpg', import.meta.url))
    const file = new File([bytes], 'meal.jpg', { type: 'image/jpeg', lastModified: 0 })

    const info = await readPhotoInfo(file)

    expect(info).toMatchObject({ date: '2026-11-10', time: '12:34', fromExif: true })
    expect(info.location?.lat).toBeCloseTo(GANGNAM.lat, 3)
    expect(info.location?.lng).toBeCloseTo(GANGNAM.lng, 3)
  })

  it('사진 정보가 없으면 파일 날짜를 쓰고 위치는 없다', async () => {
    const savedAt = new Date(2026, 10, 9, 19, 5)
    const noExif = new File([new Uint8Array([1, 2, 3])], 'x.jpg', { lastModified: savedAt.getTime() })

    const info = await readPhotoInfo(noExif)

    expect(info).toEqual({ date: '2026-11-09', time: '19:05', fromExif: false })
  })

  it.each([
    ['0, 0 (GPS 가 없을 때 들어오는 값)', 0, 0],
    ['위도 91 (90 을 넘음)', 91, 10],
  ])('말이 안 되는 좌표 %s 는 버린다', (_case, lat, lng) => {
    expect(validLocation(lat, lng)).toBeUndefined()
  })

  it('한국 안의 좌표는 그대로 쓴다', () => {
    expect(validLocation(okLocation.lat, okLocation.lng)).toEqual(okLocation)
  })

  it('시각은 날짜와 두 자리 시:분으로 나눈다', () => {
    expect(toDateTime(new Date(2026, 0, 2, 3, 4))).toEqual({ date: '2026-01-02', time: '03:04' })
  })
})

describe('요청과 결과 다듬기', () => {
  it.each([
    ['비어 있는 요청', null],
    ['날짜가 "어제"', { image: 'abc', date: '어제' }],
    ['사진이 base64 가 아님', { image: '<script>', date: '2026-11-10' }],
  ])('%s 은 거절한다', (_case, request) => {
    expect(sanitizeMealRequest(request)).toBeNull()
  })

  it('맞는 요청은 받고, 브라우저가 보낸 근처 가게 목록은 버린다', () => {
    const request = { image: okImage, date: '2026-11-10', time: '12:34', location: okLocation, nearby: [{ name: '가짜' }] }

    expect(sanitizeMealRequest(request)).toEqual({ image: okImage, date: '2026-11-10', time: '12:34', location: okLocation })
  })

  it('AI 결과에 음식 이름이 없으면 버린다', () => {
    expect(sanitizeGuess({ dish: '' })).toBeNull()
  })

  it('AI 결과의 금액은 반올림, 위험한 주소 · 음수 가격은 비우고, 그릇 수는 9 까지로 막는다', () => {
    const messy = { dish: ' 라멘 ', place: '', placeSure: 'yes', price: 12000.4, priceUrl: 'javascript:alert(1)', priceNote: '', guessPrice: -5, servings: 20 }

    expect(sanitizeGuess(messy)).toEqual({ dish: '라멘', place: null, placeSure: false, price: 12000, priceUrl: null, priceNote: '', guessPrice: null, servings: 9 })
  })

  it('프롬프트에 찍은 시각 · 좌표 · 근처 가게를 넣는다', () => {
    const nearby = [{ name: '진미식당', category: '음식점 > 한식', address: '강남대로 1', distance: 12 }]

    const text = mealPrompt({ image: 'x', date: '2026-11-10', time: '12:34', location: { lat: 37.49791, lng: 127.02761 }, nearby })

    expect(text).toContain('2026-11-10 12:34')
    expect(text).toContain('위도 37.49791')
    expect(text).toContain('- 진미식당 | 음식점 > 한식 | 12m')
  })

  it('위치가 없으면 프롬프트에 위치 정보가 없다고 쓴다', () => {
    expect(mealPrompt({ image: 'x', date: '2026-11-10' })).toContain('위치 정보가 없어')
  })

  it('메뉴판 가격이 있으면 그 가격, 없으면 보통 가격으로 가격 문장을 만든다', () => {
    expect(priceLine(guess)).toBe('메뉴판 가격 9,000원')
    expect(priceLine({ ...guess, price: null, guessPrice: 8000 })).toContain('보통 8,000원')
  })

  it('넣을 금액은 메뉴판 가격 × 그릇 수이고, 메뉴판 가격이 없으면 비운다', () => {
    expect(suggestedAmount({ ...guess, servings: 2 })).toBe(18000)
    expect(suggestedAmount({ ...guess, price: null })).toBeNull()
  })

  it('메모는 "가게 · 음식" 이고, 둘 다 비면 "외식" 이다', () => {
    expect(mealMemo('진미식당', '김치찌개')).toBe('진미식당 · 김치찌개')
    expect(mealMemo('', ' ')).toBe('외식')
  })
})

describe('근처 가게 찾기 (카카오)', () => {
  it('음식점(FD6)과 카페를 합쳐 가까운 순으로 놓고 좌표는 x=경도 · y=위도로 묻는다', async () => {
    const place = (name: string, distance: string) => ({ place_name: name, category_name: '음식점', road_address_name: '', address_name: '역삼동', distance, place_url: '' })
    const fakeKakao = vi.fn(async (url: string) => {
      const documents = url.includes('FD6') ? [place('진미식당', '30'), place('국밥집', '70')] : [place('스타벅스', '10')]
      return new Response(JSON.stringify({ documents }))
    })

    const list = await nearbyPlaces(okLocation.lat, okLocation.lng, 'key', undefined, fakeKakao as never)

    expect(list.map((item) => item.name)).toEqual(['스타벅스', '진미식당', '국밥집'])
    expect(list[0]).toEqual({ name: '스타벅스', category: '음식점', address: '역삼동', distance: 10 })
    expect(fakeKakao.mock.calls[0][0]).toContain('x=127&y=37.5')
  })
})

describe('어느 AI에 물을지', () => {
  it.each([
    ['기본(AI 없이)', { engine: 'local' as const }],
    ['Gemini 인데 키가 없으면', { engine: 'gemini' as const }],
  ])('%s 이면 AI 없이 직접 입력한다', (_case, settings) => {
    expect(mealEngineFor(settings)).toBeNull()
  })

  it.each([
    ['Tidy AI 서버', { engine: 'tidy' as const }],
    ['Gemini 키가 있으면', { engine: 'gemini' as const, geminiKey: 'k' }],
  ])('%s 이면 AI 로 사진을 읽는다', (_case, settings) => {
    expect(mealEngineFor(settings)).toBeTypeOf('function')
  })
})

describe('무료 Gemini', () => {
  const request = { image: okImage, date: '2026-11-10', time: '12:34', location: okLocation }
  const answer = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))
  const bodyOf = (fetcher: ReturnType<typeof vi.fn>, call: number) => JSON.parse((fetcher.mock.calls[call] as unknown as [string, RequestInit])[1].body as string)

  it('```json 으로 감싼 답도 읽는다', async () => {
    const fetcher = vi.fn(async () => answer(`\`\`\`json\n${JSON.stringify(guess)}\n\`\`\``))

    const result = await geminiMealEngine('k', fetcher as never)(request)

    expect(result).toEqual({ guess, nearby: [] })
  })

  it('구글 검색을 켜고 사진과 함께 JSON 하나만 달라고 묻는다', async () => {
    const fetcher = vi.fn(async () => answer(JSON.stringify(guess)))

    await geminiMealEngine('k', fetcher as never)(request)

    const body = bodyOf(fetcher, 0)
    expect(body.tools).toEqual([{ google_search: {} }])
    expect(body.generationConfig.responseMimeType).toBeUndefined() // 검색과 JSON 모드는 함께 못 쓴다
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: okImage } })
    expect(body.systemInstruction.parts[0].text).toContain('JSON 하나만')
  })

  it('검색이 막히면 검색 없이 다시 묻고, 확인 못 한 가격은 비운다', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }))
      .mockResolvedValueOnce(answer(JSON.stringify(guess)))

    const result = await geminiMealEngine('k', fetcher as never)(request)

    expect(result.guess).toMatchObject({ dish: '김치찌개', place: '진미식당', price: null, priceUrl: null })
    expect(bodyOf(fetcher, 1).tools).toBeUndefined()
  })

  it('검색 없이도 429 면 무료 사용량을 다 썼다는 MealError 를 낸다', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 429 }))

    const error = await geminiMealEngine('k', fetcher as never)(request).catch((caught) => caught)

    expect(error).toBeInstanceOf(MealError)
    expect(error.message).toContain('무료 사용량')
    expect(fetcher).toHaveBeenCalledTimes(2) // 검색 켜고 한 번, 끄고 한 번
  })

  it('키가 틀리면(403) 다시 묻지 않고 키가 맞지 않다고 알려 준다', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 403 }))

    const error = await geminiMealEngine('k', fetcher as never)(request).catch((caught) => caught)

    expect(error.message).toContain('키가 맞지 않아요')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

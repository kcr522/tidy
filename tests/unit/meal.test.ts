import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { askClaudeMeal, MealError, mealPrompt, priceLine, sanitizeGuess, sanitizeMealRequest, type MealGuess } from '../../src/lib/ai/meal'
import { geminiMealEngine, mealEngineFor, mealUrlFrom } from '../../src/lib/ai/mealEngines'
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

describe('사진 정보 읽기', () => {
  it('EXIF에서 찍은 시각과 GPS 위치를 읽는다', async () => {
    const buf = readFileSync(new URL('../fixtures/meal-gps.jpg', import.meta.url))
    const file = new File([buf], 'meal.jpg', { type: 'image/jpeg', lastModified: 0 })
    const info = await readPhotoInfo(file)
    expect(info.date).toBe('2026-11-10')
    expect(info.time).toBe('12:34')
    expect(info.fromExif).toBe(true)
    expect(info.location?.lat).toBeCloseTo(37.4979, 3)
    expect(info.location?.lng).toBeCloseTo(127.0276, 3)
  })

  it('사진 정보가 없으면 파일 날짜를 쓰고 위치는 없다', async () => {
    const when = new Date(2026, 10, 9, 19, 5)
    const info = await readPhotoInfo(new File([new Uint8Array([1, 2, 3])], 'x.jpg', { lastModified: when.getTime() }))
    expect(info).toEqual({ date: '2026-11-09', time: '19:05', fromExif: false })
  })

  it('말이 안 되는 좌표는 버린다', () => {
    expect(validLocation(0, 0)).toBeUndefined()
    expect(validLocation(91, 10)).toBeUndefined()
    expect(validLocation(37.5, 127)).toEqual({ lat: 37.5, lng: 127 })
    expect(toDateTime(new Date(2026, 0, 2, 3, 4))).toEqual({ date: '2026-01-02', time: '03:04' })
  })
})

describe('요청과 결과 다듬기', () => {
  it('이상한 요청은 거절한다', () => {
    expect(sanitizeMealRequest(null)).toBeNull()
    expect(sanitizeMealRequest({ image: 'abc', date: '어제' })).toBeNull()
    expect(sanitizeMealRequest({ image: '<script>', date: '2026-11-10' })).toBeNull()
    expect(sanitizeMealRequest({ image: 'QUJD', date: '2026-11-10', time: '12:34', location: { lat: 37.5, lng: 127 }, nearby: [{ name: '가짜' }] })).toEqual({
      image: 'QUJD',
      date: '2026-11-10',
      time: '12:34',
      location: { lat: 37.5, lng: 127 },
    })
  })

  it('AI 결과의 금액, 주소, 그릇 수를 정리한다', () => {
    expect(sanitizeGuess({ dish: '' })).toBeNull()
    expect(
      sanitizeGuess({ dish: ' 라멘 ', place: '', placeSure: 'yes', price: 12000.4, priceUrl: 'javascript:alert(1)', priceNote: '', guessPrice: -5, servings: 20 }),
    ).toEqual({ dish: '라멘', place: null, placeSure: false, price: 12000, priceUrl: null, priceNote: '', guessPrice: null, servings: 9 })
  })

  it('프롬프트에 시각, 좌표, 근처 가게를 넣는다', () => {
    const text = mealPrompt({
      image: 'x',
      date: '2026-11-10',
      time: '12:34',
      location: { lat: 37.49791, lng: 127.02761 },
      nearby: [{ name: '진미식당', category: '음식점 > 한식', address: '강남대로 1', distance: 12 }],
    })
    expect(text).toContain('2026-11-10 12:34')
    expect(text).toContain('위도 37.49791')
    expect(text).toContain('- 진미식당 | 음식점 > 한식 | 12m')
    expect(mealPrompt({ image: 'x', date: '2026-11-10' })).toContain('위치 정보가 없어')
  })

  it('가격 문장과 기본 금액, 메모', () => {
    expect(priceLine(guess)).toBe('메뉴판 가격 9,000원')
    expect(priceLine({ ...guess, price: null, guessPrice: 8000 })).toContain('보통 8,000원')
    expect(suggestedAmount({ ...guess, servings: 2 })).toBe(18000)
    expect(suggestedAmount({ ...guess, price: null })).toBeNull()
    expect(mealMemo('진미식당', '김치찌개')).toBe('진미식당 · 김치찌개')
    expect(mealMemo('', ' ')).toBe('외식')
  })
})

describe('Claude 호출', () => {
  const fakeClient = (...responses: unknown[]) => {
    const create = vi.fn()
    for (const r of responses) create.mockResolvedValueOnce(r)
    return { client: { beta: { messages: { create } } } as never, create }
  }

  it('report_meal 도구 결과를 돌려준다', async () => {
    const { client, create } = fakeClient({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'report_meal', input: guess }] })
    await expect(askClaudeMeal(client, { image: 'QUJD', date: '2026-11-10' })).resolves.toEqual(guess)
    const body = create.mock.calls[0][0]
    expect(body.tools.map((t: { name: string }) => t.name)).toEqual(['web_search', 'report_meal'])
    expect(body.messages[0].content[0]).toMatchObject({ type: 'image', source: { type: 'base64', data: 'QUJD' } })
  })

  it('검색 중 멈추면(pause_turn) 이어서 묻는다', async () => {
    const paused = { stop_reason: 'pause_turn', content: [{ type: 'server_tool_use', name: 'web_search', id: 's1', input: {} }] }
    const { client, create } = fakeClient(paused, { stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'report_meal', input: guess }] })
    await expect(askClaudeMeal(client, { image: 'QUJD', date: '2026-11-10' })).resolves.toEqual(guess)
    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0].messages[1]).toEqual({ role: 'assistant', content: paused.content })
  })

  it('거절하거나 결과가 없으면 MealError', async () => {
    await expect(askClaudeMeal(fakeClient({ stop_reason: 'refusal', content: [] }).client, { image: 'Q', date: '2026-11-10' })).rejects.toBeInstanceOf(MealError)
    await expect(
      askClaudeMeal(fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: '모르겠어요' }] }).client, { image: 'Q', date: '2026-11-10' }),
    ).rejects.toBeInstanceOf(MealError)
  })
})

describe('근처 가게 찾기 (카카오)', () => {
  it('음식점과 카페를 합쳐 가까운 순으로', async () => {
    const doc = (name: string, distance: string) => ({ place_name: name, category_name: '음식점', road_address_name: '', address_name: '역삼동', distance, place_url: '' })
    const fetchImpl = vi.fn(async (url: string) => {
      const docs = url.includes('FD6') ? [doc('진미식당', '30'), doc('국밥집', '70')] : [doc('스타벅스', '10')]
      return new Response(JSON.stringify({ documents: docs }))
    })
    const list = await nearbyPlaces(37.5, 127, 'key', undefined, fetchImpl as never)
    expect(list.map((p) => p.name)).toEqual(['스타벅스', '진미식당', '국밥집'])
    expect(list[0]).toEqual({ name: '스타벅스', category: '음식점', address: '역삼동', distance: 10 })
    expect(fetchImpl.mock.calls[0][0]).toContain('x=127&y=37.5')
  })
})

describe('어느 AI에 물을지', () => {
  it('기본(AI 없이)이면 직접 입력', () => {
    expect(mealEngineFor({ engine: 'local' })).toBeNull()
    expect(mealEngineFor({ engine: 'key' })).toBeNull()
    expect(mealEngineFor({ engine: 'server' })).toBeTypeOf('function')
    expect(mealEngineFor({ engine: 'gemini' })).toBeNull()
    expect(mealEngineFor({ engine: 'gemini', geminiKey: 'k' })).toBeTypeOf('function')
  })

  it('한마디 서버 주소에서 음식 사진 주소를 만든다', () => {
    expect(mealUrlFrom()).toBe('/api/meal')
    expect(mealUrlFrom('/api/feedback')).toBe('/api/meal')
    expect(mealUrlFrom('https://tidy.vercel.app/api/feedback')).toBe('https://tidy.vercel.app/api/meal')
  })
})

describe('무료 Gemini', () => {
  const req = { image: 'QUJD', date: '2026-11-10', time: '12:34', location: { lat: 37.5, lng: 127 } }
  const answer = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }))

  it('구글 검색을 켜고 사진과 함께 묻고, 글로 온 JSON을 읽는다', async () => {
    const fetcher = vi.fn(async () => answer(`\`\`\`json\n${JSON.stringify(guess)}\n\`\`\``))
    const out = await geminiMealEngine('k', fetcher as never)(req)
    expect(out).toEqual({ guess, nearby: [] })
    const body = JSON.parse((fetcher.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.tools).toEqual([{ google_search: {} }])
    expect(body.generationConfig.responseMimeType).toBeUndefined()
    expect(body.contents[0].parts[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })
    expect(body.systemInstruction.parts[0].text).toContain('JSON 하나만')
  })

  it('검색이 막히면 검색 없이 다시 묻고, 가격은 비운다', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 }))
      .mockResolvedValueOnce(answer(JSON.stringify(guess)))
    const out = await geminiMealEngine('k', fetcher as never)(req)
    expect(out.guess).toMatchObject({ dish: '김치찌개', place: '진미식당', price: null, priceUrl: null })
    const second = JSON.parse(fetcher.mock.calls[1][1].body as string)
    expect(second.tools).toBeUndefined()
  })

  it('무료 사용량을 다 쓰면 알아듣기 쉬운 MealError', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 429 }))
    const err = await geminiMealEngine('k', fetcher as never)(req).catch((e) => e)
    expect(err).toBeInstanceOf(MealError)
    expect(err.message).toContain('무료 사용량')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('키가 틀리면 다시 묻지 않는다', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 403 }))
    const err = await geminiMealEngine('k', fetcher as never)(req).catch((e) => e)
    expect(err.message).toContain('키가 맞지 않아요')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

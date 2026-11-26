import { describe, expect, it, vi } from 'vitest'
import { assistantPrompt, eventMemo, sanitizeAssistantReply, sanitizeAssistantRequest } from '../../src/lib/ai/assistant'
import { findAmount, findDates, findTime, localAssistant } from '../../src/lib/ai/assistantLocal'
import { greeting } from '../../src/lib/assistant/greetings'
import { buildContext, matchAccount, refineEvents, refinePayments } from '../../src/lib/assistant/learn'
import type { CalendarEvent, MerchantAlias, Transaction } from '../../src/db/types'

const TODAY = '2026-11-10' // 화요일
const YESTERDAY = '2026-11-09'
const TOMORROW = '2026-11-11'
const KEY = 'KEY'
const PHOTO = 'QQ==' // base64 로 'A' 한 글자
const ask = { system: 'S', parts: [{ text: 'x' }] }

const okTx = (over: Partial<Transaction>): Transaction => ({
  type: 'EXPENSE',
  amount: 5000,
  category: '식비',
  date: '2026-11-01',
  memo: '스타벅스',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
})

/** AI 답 하나: 필요한 칸만 바꾼다 */
const aiReply = (over: object) => ({ kind: 'none', reply: '', events: [], payments: [], diary: null, ...over })

describe('AI 답 다듬기', () => {
  it('일정의 날짜가 없는 날(2월 30일)이면 그 일정은 버린다', () => {
    const badDay = { title: '이상한 날', startDate: '2026-02-30', endDate: '2026-02-30', time: null, place: null, note: '' }
    const okEvent = { title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-22', time: '14:00', place: '시민공원', note: '' }

    const result = sanitizeAssistantReply(aiReply({ kind: 'event', reply: '플리마켓이 있네요!', events: [okEvent, badDay] }))

    expect(result?.kind).toBe('event')
    expect(result?.events).toEqual([okEvent])
  })

  it('일정의 끝 날짜가 시작보다 앞이면 하루 일정으로 고친다', () => {
    const endBeforeStart = { title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-20', time: '14:00', place: '시민공원', note: '' }

    const result = sanitizeAssistantReply(aiReply({ kind: 'event', events: [endBeforeStart] }))

    expect(result?.events[0].endDate).toBe('2026-11-22')
  })

  it('결제 금액이 0 이면 버리고, 시각이 25:00 이면 비우고, 모르는 카테고리는 기타로 바꾼다', () => {
    const okPayment = { type: 'EXPENSE', merchant: 'GS25 역삼점', amount: 3200, date: YESTERDAY, time: '25:00', account: '신한카드', category: '편의점' }
    const zeroAmount = { type: 'EXPENSE', merchant: '잔액', amount: 0, date: YESTERDAY, time: null, account: null, category: '기타' }

    const result = sanitizeAssistantReply(aiReply({ kind: 'payment', payments: [okPayment, zeroAmount] }))

    expect(result?.payments).toEqual([{ ...okPayment, time: null, category: '기타' }])
    expect(result?.reply).toBe('결제 내역 1건을 찾았어요')
  })

  it('일기 답은 날짜와 글을 그대로 둔다', () => {
    const diary = { date: TODAY, text: '친구랑 떡볶이를 먹었다.' }

    const result = sanitizeAssistantReply(aiReply({ kind: 'diary', reply: '그런 일이 있으셨군요', diary }))

    expect(result).toMatchObject({ kind: 'diary', diary })
  })

  it('일정이라면서 일정이 비어 있으면 아무것도 아닌 답(none)으로 바꾼다', () => {
    const result = sanitizeAssistantReply(aiReply({ kind: 'event', reply: '음' }))

    expect(result?.kind).toBe('none')
  })

  it('모르는 종류의 답은 버린다', () => {
    expect(sanitizeAssistantReply({ kind: 'weird' })).toBeNull()
  })

  it.each([
    ['사진도 글도 없으면', { today: TODAY }],
    ['사진이 base64 가 아니면', { today: TODAY, image: 'not base64!' }],
  ])('서버 요청에 %s 거절한다', (_case, request) => {
    expect(sanitizeAssistantRequest(request)).toBeNull()
  })

  it('서버 요청 글의 앞뒤 공백을 지우고, 이름이 빈 별명은 뺀다', () => {
    const emptyAlias = { original: 'KCP', name: '' }
    const request = { today: TODAY, text: '  내일 치과  ', context: { aliases: [emptyAlias], merchants: [], accounts: ['토스'] } }

    const clean = sanitizeAssistantRequest(request)

    expect(clean).toEqual({ today: TODAY, text: '내일 치과', context: { aliases: [], merchants: [], accounts: ['토스'] } })
  })

  it('프롬프트에 오늘 요일 · 알려 준 이름 · 자주 간 가게를 넣는다', () => {
    const context = { aliases: [{ original: 'KCP*결제', name: '운남 다이소' }], merchants: [{ name: '스타벅스', category: '식비', account: '신한카드' }], accounts: ['신한카드'] }

    const prompt = assistantPrompt({ today: TODAY, image: PHOTO, context })

    expect(prompt).toContain('2026-11-10 (화요일)')
    expect(prompt).toContain('"KCP*결제"로 찍히는 곳은 실제로 "운남 다이소"')
    expect(prompt).toContain('스타벅스: 식비, 신한카드')
  })

  it.each([
    [{ time: '14:30', place: '시민공원', note: '참가비 무료' }, '오후 2:30 · 시민공원 · 참가비 무료'],
    [{ time: '00:05', place: null, note: '' }, '오전 12:05'],
  ])('캘린더 메모는 있는 칸만 "시각 · 장소 · 메모" 로 잇는다 (%#)', (event, memo) => {
    expect(eventMemo(event)).toBe(memo)
  })
})

describe('AI 없이(기본) 대답하기', () => {
  it.each([
    ['11월 22일 플리마켓', ['2026-11-22']],
    ['3월 2일 개강', ['2027-03-02']], // 지난 달이면 내년
    ['내일 치과', [TOMORROW]],
    ['금요일 회식', ['2026-11-13']],
    ['다음 주 월요일 면접', ['2026-11-16']],
    ['12.24~12.26 여행', ['2026-12-24', '2026-12-26']],
  ])('"%s" 에서 날짜 %j 를 찾는다', (text, dates) => {
    expect(findDates(text, TODAY).map((found) => found.date)).toEqual(dates)
  })

  it.each([
    ['오후 3시 반', '15:30'],
    ['19:00 저녁', '19:00'],
  ])('"%s" 에서 시각 %s 를 찾는다', (text, time) => {
    expect(findTime(text)?.time).toBe(time)
  })

  it.each([
    ['스타벅스 5,600원', 5600],
    ['1만 2천원 택시', 12000],
  ])('"%s" 에서 금액 %i 원을 찾는다', (text, amount) => {
    expect(findAmount(text)?.amount).toBe(amount)
  })

  it('금액이 있으면 가계부로 넣고, 아는 가게는 카테고리도 고른다', () => {
    const result = localAssistant({ today: TODAY, text: '올리브영 12,000원 결제' })

    expect(result.kind).toBe('payment')
    expect(result.payments[0]).toMatchObject({ merchant: '올리브영', amount: 12000, date: TODAY, category: '쇼핑', type: 'EXPENSE' })
  })

  it('"12.24~12.26" 처럼 기간이 있으면 여러 날 일정으로 넣는다', () => {
    const result = localAssistant({ today: TODAY, text: '12.24~12.26 부산 여행' })

    expect(result.kind).toBe('event')
    expect(result.events[0]).toMatchObject({ title: '부산 여행', startDate: '2026-12-24', endDate: '2026-12-26' })
  })

  it('"내일 오후 3시" 가 있으면 날짜와 시각을 넣은 일정으로 만든다', () => {
    const result = localAssistant({ today: TODAY, text: '내일 오후 3시 치과 예약' })

    expect(result.events[0]).toMatchObject({ title: '치과 예약', startDate: TOMORROW, time: '15:00' })
  })

  it('"25일부터 27일까지" 처럼 뒤 날짜에 달이 없어도 기간으로 알아본다', () => {
    const result = localAssistant({ today: TODAY, text: '11월 25일부터 27일까지 제주도 여행' })

    expect(result.events[0]).toMatchObject({ title: '제주도 여행', startDate: '2026-11-25', endDate: '2026-11-27' })
  })

  it.each([
    [TODAY, '2026-12-05'],
    ['2026-12-10', '2027-01-05'], // 12월의 다음 달은 내년 1월
  ])('오늘이 %s 일 때 "다음 달 5일" 은 %s 이다', (today, startDate) => {
    const result = localAssistant({ today, text: '다음 달 5일 정기검진 예약' })

    expect(result.events[0]).toMatchObject({ startDate })
  })

  it.each([
    ['점심 김밥천국 8천원', { amount: 8000, category: '식비' }],
    ['어제 택시비 12000원 냈어', { amount: 12000, category: '교통', date: YESTERDAY }],
    ['약국에서 감기약 4500원', { category: '의료/건강' }],
  ])('"%s" 는 브랜드가 아니어도 낱말로 카테고리를 고른다', (text, payment) => {
    expect(localAssistant({ today: TODAY, text }).payments[0]).toMatchObject(payment)
  })

  it('질문이면 답하지 않고 AI(Gemini)를 켜면 답할 수 있다고 알려 준다', () => {
    const result = localAssistant({ today: TODAY, text: '적금이랑 예금 차이가 뭐야?' })

    expect(result.kind).toBe('none')
    expect(result.reply).toContain('Gemini')
  })

  it.each(['오늘 친구랑 한강에 갔어', '오늘 팀장님한테 칭찬받았다', '어제 영화 봤는데 너무 재밌었어'])('지난 이야기 "%s" 는 일기로 넣는다', (text) => {
    const result = localAssistant({ today: TODAY, text })

    expect(result.kind).toBe('diary')
    expect(result.reply).toContain('그런 일이 있으셨군요')
  })

  it('"어제" 이야기는 어제 날짜 일기로 넣는다', () => {
    const result = localAssistant({ today: TODAY, text: '어제 영화 봤어' })

    expect(result.diary?.date).toBe(YESTERDAY)
  })

  it('사진만 보내면 읽지 못하니 아무것도 넣지 않는다 (AI 연결 안내)', () => {
    expect(localAssistant({ today: TODAY, image: PHOTO })).toMatchObject({ kind: 'none' })
  })
})

describe('이전 기록에서 배우기', () => {
  const history = [
    okTx({ memo: '스타벅스 강남R점', category: '식비', account: '신한카드' }),
    okTx({ memo: '스타벅스 강남R점', category: '식비', account: '신한카드', date: '2026-11-03' }),
    okTx({ memo: '운남 다이소', originalMemo: 'KCP*결제', category: '생활' as string, account: '토스', amount: 3000 }),
    okTx({ memo: '동네 헬스장', category: '의료/건강', account: '카카오뱅크', amount: 50000 }),
  ]
  const aliases: MerchantAlias[] = [{ raw: 'kcp*결제', original: 'KCP*결제', name: '운남 다이소', createdAt: '' }]
  const payment = (merchant: string, amount: number, date: string, account: string | null, category: string) => ({ type: 'EXPENSE' as const, merchant, amount, date, time: null, account, category })

  it('AI 에 보낼 요약에 자주 간 곳 · 알려 준 이름 · 많이 쓴 결제 수단을 넣는다', () => {
    const context = buildContext(history, aliases)

    expect(context.merchants[0]).toEqual({ name: '스타벅스 강남R점', category: '식비', account: '신한카드' })
    expect(context.aliases).toEqual([{ original: 'KCP*결제', name: '운남 다이소' }])
    expect(context.accounts[0]).toBe('신한카드')
  })

  it.each([
    ['띄어쓰기만 다르면 전에 쓰던 글자로', '신한 카드', ['신한카드', '토스'], '신한카드'],
    ['처음 보는 결제 수단은 그대로', '토스뱅크', ['신한카드'], '토스뱅크'],
    ['결제 수단이 없으면 비운다', null, ['신한카드'], undefined],
  ])('%s', (_case, account, used, matched) => {
    expect(matchAccount(account, used)).toBe(matched)
  })

  it('같은 가게면 전에 고른 카테고리 · 결제 수단을 쓰고 그 이유를 보여 준다', () => {
    const [gym] = refinePayments([payment('동네 헬스장', 50000, TODAY, null, '문화/여가')], history, aliases)

    expect(gym.input).toMatchObject({ category: '의료/건강', account: '카카오뱅크' })
    expect(gym.learned).toEqual(['카테고리: 전에 고른 의료/건강', '결제 수단: 늘 쓰던 카카오뱅크'])
    expect(gym.duplicate).toBe(false)
  })

  it('알려 준 이름이 있는 결제처는 그 이름으로 보여 주고, 같은 날 같은 금액이 있으면 이미 있다고 표시한다', () => {
    const [kcp] = refinePayments([payment('KCP*결제', 3000, '2026-11-01', null, '기타')], history, aliases)

    expect(kcp.display).toBe('운남 다이소')
    expect(kcp.input.memo).toBe('KCP*결제') // 저장할 때 transactionRepo 가 알려 준 이름으로 바꾼다
    expect(kcp.duplicate).toBe(true)
  })

  it('이미 있는 결제는 두 번 들어와도 둘 다 이미 있다고 표시하고 결제 수단 글자를 맞춘다', () => {
    const starbucks = payment('스타벅스 강남R점', 5000, '2026-11-01', '신한 카드', '식비')

    const drafts = refinePayments([starbucks, starbucks], history, aliases)

    expect(drafts[0]).toMatchObject({ duplicate: true, input: { account: '신한카드' } })
    expect(drafts[1].duplicate).toBe(true)
  })

  it('일정은 같은 날 같은 이름(띄어쓰기 달라도)이면 이미 있다고 표시하고, 새 일정 메모에 시각 · 장소를 넣는다', () => {
    const existing = [{ title: '플리 마켓', startDate: '2026-11-22', endDate: '2026-11-22', color: 'pink', memo: '' } as CalendarEvent]
    const sameEvent = { title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-22', time: null, place: null, note: '' }
    const newEvent = { title: '김장', startDate: '2026-11-29', endDate: '2026-11-29', time: '09:00', place: '할머니 댁', note: '' }

    const drafts = refineEvents([sameEvent, newEvent], existing)

    expect(drafts.map((draft) => draft.duplicate)).toEqual([true, false])
    expect(drafts[1].input.memo).toBe('오전 9:00 · 할머니 댁')
  })
})

describe('첫인사', () => {
  const firstPick = () => 0
  const lastPick = () => 0.99

  it('아침 8시에는 아침 인사를 한다', () => {
    expect(greeting(new Date(2026, 10, 10, 8), firstPick)).toContain('아침')
  })

  it('낮 1시에는 하루 인사를 한다', () => {
    expect(greeting(new Date(2026, 10, 10, 13), firstPick)).toBe('안녕하세요! 오늘도 즐거운 하루 보내세요 😊')
  })

  it('밤 11시에는 밤 인사를 한다', () => {
    expect(greeting(new Date(2026, 10, 10, 23), lastPick)).toContain('밤')
  })
})

describe('Gemini (무료)', () => {
  const okGemini = (text: string, status = 200) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status }))

  it('키를 헤더로, 사진을 inlineData 로 보내고 JSON 으로 답하게 한다', async () => {
    const { callGemini, GEMINI_MODEL } = await import('../../src/lib/ai/gemini')
    const fetchGemini = okGemini('{"a":1}')
    const photoAsk = { system: 'S', parts: [{ inlineData: { mimeType: 'image/jpeg', data: PHOTO } }, { text: 'hi' }], schema: {} }

    const answer = await callGemini(KEY, photoAsk, fetchGemini)

    expect(answer).toBe('{"a":1}')
    const [url, init] = fetchGemini.mock.calls[0]
    expect(url).toContain(`models/${GEMINI_MODEL}:generateContent`)
    expect(init.headers['x-goog-api-key']).toBe(KEY)
    const body = JSON.parse(init.body)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseJsonSchema).toBeUndefined()
    expect(body.contents[0].parts[0].inlineData.data).toBe(PHOTO)
  })

  it('빨리 답하게 생각은 끄고 묻는다 (thinkingBudget 0)', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const fetchGemini = okGemini('안녕')

    await callGemini(KEY, ask, fetchGemini)

    expect(JSON.parse(fetchGemini.mock.calls[0][1].body).generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 })
  })

  it('생각 설정을 받지 않는 모델이면 생각 설정을 빼고 다시 묻는다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const noThinking = new Response(JSON.stringify({ error: { message: 'Thinking budget is not supported for this model.' } }), { status: 400 })
    const okAnswer = new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '좋아요' }] } }] }), { status: 200 })
    const fetchGemini = vi.fn().mockResolvedValueOnce(noThinking).mockResolvedValue(okAnswer)

    const answer = await callGemini(KEY, ask, fetchGemini)

    expect(answer).toBe('좋아요')
    expect(JSON.parse(fetchGemini.mock.calls[1][1].body).generationConfig.thinkingConfig).toBeUndefined()
  })

  it('너무 오래 걸리면 멈추고 시간 초과 에러를 낸다 (예비 AI · 기본 모드로 넘어가게)', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const { AiTimeoutError } = await import('../../src/lib/ai/timeout')
    const neverAnswers = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))))
    const shortTimeout = 30

    const answer = callGemini(KEY, { ...ask, timeoutMs: shortTimeout }, neverAnswers as unknown as typeof fetch)

    await expect(answer).rejects.toBeInstanceOf(AiTimeoutError)
  })

  it('무료 한도를 넘어 429 가 오면 다 썼다고 알려 준다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const tooMany = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))

    await expect(callGemini(KEY, ask, tooMany)).rejects.toThrow('오늘 무료 사용량을 다 썼어요')
  })

  it('대화창은 Gemini 의 JSON 답을 ```json 으로 감싸도 알아본다', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')
    const answer = aiReply({ kind: 'event', reply: '플리마켓이 있네요!', events: [{ title: '플리마켓', startDate: '2026-11-21', endDate: '2026-11-21', time: null, place: null, note: '' }] })
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(okGemini('```json\n' + JSON.stringify(answer) + '\n```'))

    const result = await askAssistant({ engine: 'gemini', geminiKey: KEY }, { today: TODAY, image: PHOTO })

    expect(result).toMatchObject({ engine: 'gemini', kind: 'event', events: [{ title: '플리마켓' }] })
    spy.mockRestore()
  })

  it('Gemini 를 골랐어도 키가 없으면 기본(AI 없이)으로 답한다', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')

    const result = await askAssistant({ engine: 'gemini' }, { today: TODAY, text: '내일 치과' })

    expect(result.engine).toBe('local')
  })
})

describe('Gemini 오류 다루기', () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  const good = { candidates: [{ content: { parts: [{ text: '안녕' }] } }] }
  const busy = () => reply(503, { error: { message: 'overloaded' } })

  const models = {
    models: [
      { name: 'models/gemini-2.5-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-flash', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-flash-image', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/gemini-3.1-pro', supportedGenerationMethods: ['generateContent'] },
      { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
    ],
  }
  /** 모델 목록은 models, 그 밖의 주소는 모델 이름마다 answer 가 정한 답을 주는 가짜 구글 */
  const google = (answer: (model: string) => Response) =>
    vi.fn(async (url: string) => (url.includes('/models?') ? reply(200, models) : answer(url.match(/models\/([^:]+):/)![1])))

  it('쓸 수 있는 Flash 모델을 좋은 순으로 고르고 그림 · Pro · 임베딩 모델은 뺀다', async () => {
    const { rankFlashModels } = await import('../../src/lib/ai/gemini')

    const ranked = rankFlashModels(models.models.map((model) => model.name))

    expect(ranked).toEqual(['gemini-3.1-flash', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'])
  })

  it('모델이 막혔으면(404) 구글에 쓸 수 있는 모델을 물어보고 다시 묻는다', async () => {
    const { callGemini, clearGeminiModelCache } = await import('../../src/lib/ai/gemini')
    clearGeminiModelCache()
    const fetchGoogle = google((model) => (model === 'gemini-3.1-flash' ? reply(200, good) : reply(404, { error: { message: 'no longer available' } })))

    const answer = await callGemini('K', ask, fetchGoogle as unknown as typeof fetch)

    expect(answer).toBe('안녕')
  })

  it('붐비면(503) 다른 모델로 차례로 다시 묻는다', async () => {
    vi.useFakeTimers()
    const { callGemini, clearGeminiModelCache } = await import('../../src/lib/ai/gemini')
    clearGeminiModelCache()
    const fetchGoogle = google((model) => (model === 'gemini-3.1-flash-lite' ? reply(200, good) : busy()))

    const answer = callGemini('K', ask, fetchGoogle as unknown as typeof fetch)
    await vi.advanceTimersByTimeAsync(5000) // 다시 묻기 전 기다리는 시간을 건너뛴다

    await expect(answer).resolves.toBe('안녕')
    vi.useRealTimers()
  })

  it('모든 모델이 붐비면 붐빈다고 알려 준다', async () => {
    vi.useFakeTimers()
    const { callGemini, clearGeminiModelCache } = await import('../../src/lib/ai/gemini')
    clearGeminiModelCache()
    const fetchGoogle = google(busy)

    const answer = callGemini('K', ask, fetchGoogle as unknown as typeof fetch)
    const check = expect(answer).rejects.toThrow('붐벼요')
    await vi.advanceTimersByTimeAsync(10000)

    await check
    vi.useRealTimers()
  })

  it('그 밖의 400 오류는 구글이 준 이유를 보여 준다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const badPayload = vi.fn().mockResolvedValue(reply(400, { error: { message: 'Invalid JSON payload' } }))

    await expect(callGemini('K', ask, badPayload)).rejects.toThrow('Gemini에서 오류가 났어요 (400: Invalid JSON payload)')
  })

  it('키가 틀렸다는 400 오류는 키가 맞지 않다고 알려 준다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const badKey = vi.fn().mockResolvedValue(reply(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }))

    await expect(callGemini('K', ask, badKey)).rejects.toThrow('Gemini 키가 맞지 않아요')
  })

  it('답 토큰을 512 로 달라고 해도 최소 2048 로 묻는다 (생각하는 데 쓰는 토큰 때문에)', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const fetchGemini = vi.fn().mockResolvedValue(reply(200, good))
    const MIN_TOKENS = 2048

    await callGemini('K', { ...ask, maxTokens: 512 }, fetchGemini)

    expect(JSON.parse(fetchGemini.mock.calls[0][1].body).generationConfig.maxOutputTokens).toBe(MIN_TOKENS)
  })
})

describe('AI를 못 쓸 때 기본 모드로 넘어가기', () => {
  it('Gemini 무료 사용량을 다 쓰면 멈추지 않고 규칙으로 답하며 이유를 알려 준다', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')
    const real = globalThis.fetch
    globalThis.fetch = (async () => new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 })) as typeof fetch
    try {
      const result = await askAssistant({ engine: 'gemini', geminiKey: 'K' } as never, { today: TODAY, text: '내일 오후 3시 치과' })

      expect(result.engine).toBe('local')
      expect(result.fallback).toContain('무료 사용량')
      expect(result.kind).toBe('event')
    } finally {
      globalThis.fetch = real
    }
  })
})

describe('물어보기 (돈·생활 질문)', () => {
  const gemini = (body: object) => new Response(JSON.stringify(body), { status: 200 })
  const questionKind = gemini({ candidates: [{ content: { parts: [{ text: JSON.stringify(aiReply({ kind: 'question' })) }] } }] })
  const searchAnswer = () =>
    gemini({
      candidates: [
        {
          content: { parts: [{ text: '청년도약계좌는 5년 동안 모으는 상품이에요.' }] },
          groundingMetadata: { groundingChunks: [{ web: { uri: 'https://example.go.kr/a', title: '정부24' } }, { web: { uri: 'javascript:x', title: 'bad' } }] },
        },
      ],
    })

  it('질문이면 Gemini 가 구글 검색으로 답하고, 안전한 출처만 붙인다', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')
    const { clearGeminiModelCache } = await import('../../src/lib/ai/gemini')
    clearGeminiModelCache()
    const bodies: string[] = []
    const real = globalThis.fetch
    globalThis.fetch = (async (_url: string, init?: RequestInit) => {
      bodies.push(String(init?.body ?? ''))
      return bodies.length === 1 ? questionKind : searchAnswer() // 첫 번째는 종류 고르기, 두 번째는 검색 답
    }) as typeof fetch
    try {
      const result = await askAssistant({ engine: 'gemini', geminiKey: 'K' } as never, { today: TODAY, text: '청년도약계좌 뭐야' })

      expect(result.kind).toBe('question')
      expect(result.reply).toContain('청년도약계좌')
      expect(result.sources).toEqual([{ title: '정부24', url: 'https://example.go.kr/a' }])
      expect(bodies[1]).toContain('google_search')
    } finally {
      globalThis.fetch = real
    }
  })
})

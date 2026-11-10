import { describe, expect, it, vi } from 'vitest'
import type Anthropic from '@anthropic-ai/sdk'
import { askClaudeAssistant, AssistantError, assistantPrompt, eventMemo, sanitizeAssistantReply, sanitizeAssistantRequest } from '../../src/lib/ai/assistant'
import { assistantUrlFor } from '../../src/lib/ai/assistantEngines'
import { findAmount, findDates, findTime, localAssistant } from '../../src/lib/ai/assistantLocal'
import { greeting } from '../../src/lib/assistant/greetings'
import { buildContext, matchAccount, refineEvents, refinePayments } from '../../src/lib/assistant/learn'
import type { CalendarEvent, MerchantAlias, Transaction } from '../../src/db/types'

const TODAY = '2026-11-10' // 화요일

function fakeClient(res: unknown) {
  const create = vi.fn().mockResolvedValue(res)
  return { client: { beta: { messages: { create } } } as unknown as Anthropic, create }
}

const tx = (over: Partial<Transaction>): Transaction => ({
  type: 'EXPENSE',
  amount: 5000,
  category: '식비',
  date: '2026-11-01',
  memo: '스타벅스',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
})

describe('AI 답 다듬기', () => {
  it('일정: 날짜가 틀리면 버리고, 끝이 시작보다 앞이면 하루 일정으로', () => {
    const r = sanitizeAssistantReply({
      kind: 'event',
      reply: '플리마켓이 있네요!',
      events: [
        { title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-20', time: '14:00', place: '시민공원', note: '' },
        { title: '이상한 날', startDate: '2026-02-30', endDate: '2026-02-30', time: null, place: null, note: '' },
      ],
      payments: [],
      diary: null,
    })
    expect(r?.kind).toBe('event')
    expect(r?.events).toEqual([{ title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-22', time: '14:00', place: '시민공원', note: '' }])
  })

  it('결제: 금액이 없거나 이상하면 버리고, 모르는 카테고리는 기타', () => {
    const r = sanitizeAssistantReply({
      kind: 'payment',
      reply: '',
      events: [],
      payments: [
        { type: 'EXPENSE', merchant: 'GS25 역삼점', amount: 3200, date: '2026-11-09', time: '25:00', account: '신한카드', category: '편의점' },
        { type: 'EXPENSE', merchant: '잔액', amount: 0, date: '2026-11-09', time: null, account: null, category: '기타' },
      ],
      diary: null,
    })
    expect(r?.payments).toEqual([{ type: 'EXPENSE', merchant: 'GS25 역삼점', amount: 3200, date: '2026-11-09', time: null, account: '신한카드', category: '기타' }])
    expect(r?.reply).toBe('결제 내역 1건을 찾았어요')
  })

  it('일기와 아무것도 아닌 답', () => {
    expect(sanitizeAssistantReply({ kind: 'diary', reply: '그런 일이 있으셨군요', events: [], payments: [], diary: { date: TODAY, text: '친구랑 떡볶이를 먹었다.' } })).toMatchObject({
      kind: 'diary',
      diary: { date: TODAY, text: '친구랑 떡볶이를 먹었다.' },
    })
    // 일정이라면서 일정이 비어 있으면 none
    expect(sanitizeAssistantReply({ kind: 'event', reply: '음', events: [], payments: [], diary: null })?.kind).toBe('none')
    expect(sanitizeAssistantReply({ kind: 'weird' })).toBeNull()
  })

  it('서버 요청: 사진이나 글 중 하나는 있어야 하고, 이상한 사진은 거절', () => {
    expect(sanitizeAssistantRequest({ today: TODAY })).toBeNull()
    expect(sanitizeAssistantRequest({ today: TODAY, image: 'not base64!' })).toBeNull()
    expect(sanitizeAssistantRequest({ today: TODAY, text: '  내일 치과  ', context: { aliases: [{ original: 'KCP', name: '' }], merchants: [], accounts: ['토스'] } })).toEqual({
      today: TODAY,
      text: '내일 치과',
      context: { aliases: [], merchants: [], accounts: ['토스'] },
    })
  })

  it('프롬프트에 오늘 요일과 이전 기록을 넣는다', () => {
    const p = assistantPrompt({
      today: TODAY,
      image: 'QQ==',
      context: { aliases: [{ original: 'KCP*결제', name: '운남 다이소' }], merchants: [{ name: '스타벅스', category: '식비', account: '신한카드' }], accounts: ['신한카드'] },
    })
    expect(p).toContain('2026-11-10 (화요일)')
    expect(p).toContain('"KCP*결제"로 찍히는 곳은 실제로 "운남 다이소"')
    expect(p).toContain('스타벅스: 식비, 신한카드')
  })

  it('캘린더 메모: 시각 · 장소 · 메모', () => {
    expect(eventMemo({ time: '14:30', place: '시민공원', note: '참가비 무료' })).toBe('오후 2:30 · 시민공원 · 참가비 무료')
    expect(eventMemo({ time: '00:05', place: null, note: '' })).toBe('오전 12:05')
  })
})

describe('Claude 호출', () => {
  it('report 도구로 받은 결과를 돌려주고, 사진을 먼저 보낸다', async () => {
    const input = { kind: 'diary', reply: '좋은 하루였네요', events: [], payments: [], diary: { date: TODAY, text: '산책했다.' } }
    const { client, create } = fakeClient({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'report', input }] })
    await expect(askClaudeAssistant(client, { today: TODAY, image: 'QUJD', text: '오늘 산책했어' })).resolves.toMatchObject({ kind: 'diary' })
    const body = create.mock.calls[0][0]
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'report' })
    expect(body.messages[0].content[0]).toMatchObject({ type: 'image', source: { data: 'QUJD' } })
  })

  it('거절하면 AssistantError', async () => {
    await expect(askClaudeAssistant(fakeClient({ stop_reason: 'refusal', content: [] }).client, { today: TODAY, text: 'x' })).rejects.toBeInstanceOf(AssistantError)
  })

  it('서버 주소는 AI 소비 한마디 주소 옆', () => {
    expect(assistantUrlFor()).toBe('/api/assistant')
    expect(assistantUrlFor('https://tidy.vercel.app/api/feedback')).toBe('https://tidy.vercel.app/api/assistant')
  })
})

describe('AI 없이(기본) 대답하기', () => {
  it('날짜 찾기', () => {
    expect(findDates('11월 22일 플리마켓', TODAY).map((d) => d.date)).toEqual(['2026-11-22'])
    expect(findDates('3월 2일 개강', TODAY).map((d) => d.date)).toEqual(['2027-03-02'])
    expect(findDates('내일 치과', TODAY).map((d) => d.date)).toEqual(['2026-11-11'])
    expect(findDates('금요일 회식', TODAY).map((d) => d.date)).toEqual(['2026-11-13'])
    expect(findDates('다음 주 월요일 면접', TODAY).map((d) => d.date)).toEqual(['2026-11-16'])
    expect(findDates('12.24~12.26 여행', TODAY).map((d) => d.date)).toEqual(['2026-12-24', '2026-12-26'])
  })

  it('시각과 금액 찾기', () => {
    expect(findTime('오후 3시 반')?.time).toBe('15:30')
    expect(findTime('19:00 저녁')?.time).toBe('19:00')
    expect(findAmount('스타벅스 5,600원')?.amount).toBe(5600)
    expect(findAmount('1만 2천원 택시')?.amount).toBe(12000)
  })

  it('금액이 있으면 가계부, 아는 가게는 카테고리도', () => {
    const r = localAssistant({ today: TODAY, text: '올리브영 12,000원 결제' })
    expect(r.kind).toBe('payment')
    expect(r.payments[0]).toMatchObject({ merchant: '올리브영', amount: 12000, date: TODAY, category: '쇼핑', type: 'EXPENSE' })
  })

  it('날짜가 있으면 일정 (기간도)', () => {
    const r = localAssistant({ today: TODAY, text: '12.24~12.26 부산 여행' })
    expect(r.kind).toBe('event')
    expect(r.events[0]).toMatchObject({ title: '부산 여행', startDate: '2026-12-24', endDate: '2026-12-26' })
    expect(localAssistant({ today: TODAY, text: '내일 오후 3시 치과 예약' }).events[0]).toMatchObject({ title: '치과 예약', startDate: '2026-11-11', time: '15:00' })
  })

  it('지난 이야기면 일기', () => {
    for (const text of ['오늘 친구랑 한강에 갔어', '오늘 팀장님한테 칭찬받았다', '어제 영화 봤는데 너무 재밌었어']) {
      const r = localAssistant({ today: TODAY, text })
      expect(r.kind, text).toBe('diary')
      expect(r.reply).toContain('그런 일이 있으셨군요')
    }
    expect(localAssistant({ today: TODAY, text: '어제 영화 봤어' }).diary?.date).toBe('2026-11-09')
  })

  it('사진만 보내면 AI 연결을 켜 달라고 한다', () => {
    expect(localAssistant({ today: TODAY, image: 'QQ==' })).toMatchObject({ kind: 'none' })
  })
})

describe('이전 기록에서 배우기', () => {
  const history = [
    tx({ memo: '스타벅스 강남R점', category: '식비', account: '신한카드' }),
    tx({ memo: '스타벅스 강남R점', category: '식비', account: '신한카드', date: '2026-11-03' }),
    tx({ memo: '운남 다이소', originalMemo: 'KCP*결제', category: '생활' as string, account: '토스', amount: 3000 }),
    tx({ memo: '동네 헬스장', category: '의료/건강', account: '카카오뱅크', amount: 50000 }),
  ]
  const aliases: MerchantAlias[] = [{ raw: 'kcp*결제', original: 'KCP*결제', name: '운남 다이소', createdAt: '' }]

  it('AI에 보낼 요약: 자주 간 곳, 알려 준 이름, 결제 수단', () => {
    const c = buildContext(history, aliases)
    expect(c.merchants[0]).toEqual({ name: '스타벅스 강남R점', category: '식비', account: '신한카드' })
    expect(c.aliases).toEqual([{ original: 'KCP*결제', name: '운남 다이소' }])
    expect(c.accounts[0]).toBe('신한카드')
  })

  it('결제 수단은 전에 쓰던 글자로', () => {
    expect(matchAccount('신한 카드', ['신한카드', '토스'])).toBe('신한카드')
    expect(matchAccount('토스뱅크', ['신한카드'])).toBe('토스뱅크')
    expect(matchAccount(null, ['신한카드'])).toBeUndefined()
  })

  it('같은 가게면 전에 고른 카테고리·결제 수단, 알려 준 이름으로 보여 주고, 이미 있으면 표시', () => {
    const drafts = refinePayments(
      [
        { type: 'EXPENSE', merchant: '동네 헬스장', amount: 50000, date: '2026-11-10', time: null, account: null, category: '문화/여가' },
        { type: 'EXPENSE', merchant: 'KCP*결제', amount: 3000, date: '2026-11-01', time: null, account: null, category: '기타' },
        { type: 'EXPENSE', merchant: '스타벅스 강남R점', amount: 5000, date: '2026-11-01', time: null, account: '신한 카드', category: '식비' },
        { type: 'EXPENSE', merchant: '스타벅스 강남R점', amount: 5000, date: '2026-11-01', time: null, account: '신한 카드', category: '식비' },
      ],
      history,
      aliases,
    )
    expect(drafts[0].input).toMatchObject({ category: '의료/건강', account: '카카오뱅크' })
    expect(drafts[0].learned).toEqual(['카테고리: 전에 고른 의료/건강', '결제 수단: 늘 쓰던 카카오뱅크'])
    expect(drafts[0].duplicate).toBe(false)
    expect(drafts[1].display).toBe('운남 다이소')
    expect(drafts[1].input.memo).toBe('KCP*결제') // 저장할 때 transactionRepo 가 알려 준 이름으로 바꾼다
    expect(drafts[1].duplicate).toBe(true)
    expect(drafts[2]).toMatchObject({ duplicate: true, input: { account: '신한카드' } })
    expect(drafts[3].duplicate).toBe(true)
  })

  it('일정: 같은 날 같은 이름이면 이미 있어요', () => {
    const existing = [{ title: '플리 마켓', startDate: '2026-11-22', endDate: '2026-11-22', color: 'pink', memo: '' } as CalendarEvent]
    const d = refineEvents(
      [
        { title: '플리마켓', startDate: '2026-11-22', endDate: '2026-11-22', time: null, place: null, note: '' },
        { title: '김장', startDate: '2026-11-29', endDate: '2026-11-29', time: '09:00', place: '할머니 댁', note: '' },
      ],
      existing,
    )
    expect(d.map((x) => x.duplicate)).toEqual([true, false])
    expect(d[1].input.memo).toBe('오전 9:00 · 할머니 댁')
  })
})

describe('첫인사', () => {
  it('시간대마다 다른 인사', () => {
    expect(greeting(new Date(2026, 10, 10, 8), () => 0)).toContain('아침')
    expect(greeting(new Date(2026, 10, 10, 13), () => 0)).toBe('안녕하세요! 오늘도 즐거운 하루 보내세요 😊')
    expect(greeting(new Date(2026, 10, 10, 23), () => 0.99)).toContain('밤')
  })
})

describe('Gemini (무료)', () => {
  const ok = (text: string, status = 200) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status }))

  it('키를 헤더로 보내고, 사진을 inlineData 로 보내고, JSON 으로 답하게 한다', async () => {
    const { callGemini, GEMINI_MODEL } = await import('../../src/lib/ai/gemini')
    const f = ok('{"a":1}')
    await expect(callGemini('KEY', { system: 'S', parts: [{ inlineData: { mimeType: 'image/jpeg', data: 'QQ==' } }, { text: 'hi' }], schema: {} }, f)).resolves.toBe('{"a":1}')
    const [url, init] = f.mock.calls[0]
    expect(url).toContain(`models/${GEMINI_MODEL}:generateContent`)
    expect(init.headers['x-goog-api-key']).toBe('KEY')
    const body = JSON.parse(init.body)
    expect(body.generationConfig.responseMimeType).toBe('application/json')
    expect(body.generationConfig.responseJsonSchema).toBeUndefined()
    expect(body.contents[0].parts[0].inlineData.data).toBe('QQ==')
  })

  it('무료 한도를 넘으면 알려 준다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }))
    await expect(callGemini('KEY', { system: 'S', parts: [{ text: 'x' }] }, f)).rejects.toThrow('오늘 무료 사용량을 다 썼어요')
  })

  it('대화창: Gemini 의 JSON 답(```json 감싸도)을 알아본다', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')
    const answer = { kind: 'event', reply: '플리마켓이 있네요!', events: [{ title: '플리마켓', startDate: '2026-11-21', endDate: '2026-11-21', time: null, place: null, note: '' }], payments: [], diary: null }
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(ok('```json\n' + JSON.stringify(answer) + '\n```'))
    const r = await askAssistant({ engine: 'gemini', geminiKey: 'KEY' }, { today: TODAY, image: 'QQ==' })
    expect(r).toMatchObject({ engine: 'gemini', kind: 'event', events: [{ title: '플리마켓' }] })
    spy.mockRestore()
  })

  it('키가 없으면 기본(AI 없이)으로', async () => {
    const { askAssistant } = await import('../../src/lib/ai/assistantEngines')
    expect((await askAssistant({ engine: 'gemini' }, { today: TODAY, text: '내일 치과' })).engine).toBe('local')
  })
})

describe('Gemini 오류 다루기', () => {
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status })
  const good = { candidates: [{ content: { parts: [{ text: '안녕' }] } }] }

  it('모델을 못 찾으면(404) 고정 모델로 한 번 더', async () => {
    const { callGemini, GEMINI_FALLBACK_MODEL } = await import('../../src/lib/ai/gemini')
    const f = vi.fn().mockResolvedValueOnce(reply(404, { error: { message: 'not found' } })).mockResolvedValueOnce(reply(200, good))
    await expect(callGemini('K', { system: 'S', parts: [{ text: 'x' }] }, f)).resolves.toBe('안녕')
    expect(f.mock.calls[1][0]).toContain(GEMINI_FALLBACK_MODEL)
  })

  it('붐비면(503) 잠깐 쉬고 한 번 더', async () => {
    vi.useFakeTimers()
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const f = vi.fn().mockResolvedValueOnce(reply(503, { error: { message: 'overloaded' } })).mockResolvedValueOnce(reply(200, good))
    const p = callGemini('K', { system: 'S', parts: [{ text: 'x' }] }, f)
    await vi.advanceTimersByTimeAsync(2000)
    await expect(p).resolves.toBe('안녕')
    vi.useRealTimers()
  })

  it('그 밖의 오류는 구글이 준 이유를 보여 준다', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const f = vi.fn().mockResolvedValue(reply(400, { error: { message: 'Invalid JSON payload' } }))
    await expect(callGemini('K', { system: 'S', parts: [{ text: 'x' }] }, f)).rejects.toThrow('Gemini에서 오류가 났어요 (400: Invalid JSON payload)')
    const k = vi.fn().mockResolvedValue(reply(400, { error: { message: 'API key not valid. Please pass a valid API key.' } }))
    await expect(callGemini('K', { system: 'S', parts: [{ text: 'x' }] }, k)).rejects.toThrow('Gemini 키가 맞지 않아요')
  })

  it('답 토큰은 최소 2048 (생각하는 데 쓰는 토큰 때문에)', async () => {
    const { callGemini } = await import('../../src/lib/ai/gemini')
    const f = vi.fn().mockResolvedValue(reply(200, good))
    await callGemini('K', { system: 'S', parts: [{ text: 'x' }], maxTokens: 512 }, f)
    expect(JSON.parse(f.mock.calls[0][1].body).generationConfig.maxOutputTokens).toBe(2048)
  })
})

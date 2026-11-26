import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askAssistant } from '../../src/lib/ai/assistantEngines'
import { effectiveAi, engineFor } from '../../src/lib/ai/engines'
import { callGemini, clearGeminiModelCache } from '../../src/lib/ai/gemini'
import { handleAiProxy, kstDay, proxyEnvFrom, type AiProxyEnv, type AiUsage } from '../../src/lib/ai/proxyServer'
import { SERVER_KEY, ServerAiError } from '../../src/lib/ai/serverAi'
import { usageLine } from '../../src/lib/ai/usage'

const DAILY_LIMIT = 3
const OK = 200
const NOT_SIGNED_IN = 401
const NOT_ALLOWED = 403
const BAD_REQUEST = 400
const NO_KEY = 503
const TOO_MANY = 429
// 가짜 Gemini 가 한 번 답할 때 쓴 토큰
const TOKENS_PER_CALL = 120

const json = (body: object, status = OK) => new Response(JSON.stringify(body), { status })
const env = (more: Partial<AiProxyEnv> = {}): AiProxyEnv => ({ ...proxyEnvFrom({ GEMINI_API_KEY: 'SERVER-G' }), dailyLimit: DAILY_LIMIT, ...more })

/** 구글 로그인 확인 + Firestore 사용량 + Gemini 를 흉내 내는 가짜 인터넷 */
function fakeNet(opts: { gemini?: (body: unknown) => Response; email?: string } = {}) {
  const counts = new Map<string, { count: number; tokens: number }>()
  const calls: string[] = []
  const f = (async (url: string, init?: RequestInit) => {
    calls.push(url)
    const headers = (init?.headers ?? {}) as Record<string, string>
    if (url.includes('accounts:lookup')) {
      const { idToken } = JSON.parse(String(init?.body))
      return idToken === 'GOOD' ? json({ users: [{ localId: 'u1', email: opts.email ?? 'me@gmail.com' }] }) : json({ error: { message: 'INVALID_ID_TOKEN' } }, 400)
    }
    if (url.includes('documents:commit')) {
      expect(headers.authorization).toBe('Bearer GOOD')
      const w = JSON.parse(String(init?.body)).writes[0]
      const name = w.update.name as string
      const c = counts.get(name) ?? { count: 0, tokens: 0 }
      c.count += Number(w.updateTransforms[0].increment.integerValue)
      c.tokens += Number(w.updateTransforms[1].increment.integerValue)
      counts.set(name, c)
      return json({ writeResults: [{ transformResults: [{ integerValue: String(c.count) }, { integerValue: String(c.tokens) }] }] })
    }
    if (url.includes('firestore.googleapis.com')) {
      const c = [...counts.values()][0]
      return c ? json({ fields: { count: { integerValue: String(c.count) }, tokens: { integerValue: String(c.tokens) } } }) : json({}, 404)
    }
    if (url.startsWith('https://generativelanguage.googleapis.com/')) {
      expect(headers['x-goog-api-key']).toBe('SERVER-G')
      return opts.gemini?.(JSON.parse(String(init?.body ?? '{}'))) ?? json({ candidates: [{ content: { parts: [{ text: '좋아요' }] } }], usageMetadata: { totalTokenCount: TOKENS_PER_CALL } })
    }
    if (url === 'https://api.groq.com/openai/v1/models') {
      expect(headers.authorization).toBe('Bearer Q')
      return json({ data: [{ id: 'openai/gpt-oss-120b' }] })
    }
    throw new Error(`모르는 주소 ${url}`)
  }) as typeof fetch
  return { f, counts, calls }
}

const post = (body: object, auth: string | null = 'Bearer GOOD') => ({ method: 'POST', authorization: auth, body })
const geminiCall = { provider: 'gemini', path: 'models/gemini-flash-latest:generateContent', payload: { contents: [] } }
const countOf = (net: ReturnType<typeof fakeNet>) => [...net.counts.values()][0].count

describe('Tidy AI 서버 (api/ai)', () => {
  it('키가 있는지와 하루 횟수를 알려 주고, 키는 절대 돌려주지 않는다 (보안)', async () => {
    const result = await handleAiProxy({ method: 'GET' }, env(), fakeNet().f)

    expect(result.body).toEqual({ gemini: true, groq: false, limit: DAILY_LIMIT })
    expect(JSON.stringify(result.body)).not.toContain('SERVER-G')
  })

  it.each([
    ['로그인하지 않았으면', null],
    ['토큰이 틀리면', 'Bearer BAD'],
  ])('%s 막고 구글에 묻지 않는다', async (_case, auth) => {
    const net = fakeNet()

    const result = await handleAiProxy(post(geminiCall, auth), env(), net.f)

    expect(result.status).toBe(NOT_SIGNED_IN)
    expect(net.calls.some((url) => url.includes('generativelanguage'))).toBe(false)
  })

  it('허용한 메일만 쓰게 했으면 다른 메일은 막는다', async () => {
    const result = await handleAiProxy(post(geminiCall), env({ allowedEmails: ['friend@gmail.com'] }), fakeNet().f)

    expect(result.status).toBe(NOT_ALLOWED)
  })

  it.each([
    ['정해 두지 않은 Gemini 주소', { ...geminiCall, path: 'models/gemini-x:deleteEverything' }, {}, BAD_REQUEST],
    // Groq 모델 이름은 바뀔 수 있어서 모양만 본다
    ['모델 이름 모양이 아닌 Groq 요청', { provider: 'groq', payload: { model: '../../admin?x=1' } }, { groqKey: 'Q' }, BAD_REQUEST],
    ['모델 이름이 없는 Groq 요청', { provider: 'groq', payload: {} }, { groqKey: 'Q' }, BAD_REQUEST],
    ['서버에 Groq 키가 없을 때 Groq 요청', { provider: 'groq', payload: { model: 'llama-3.1-8b-instant' } }, {}, NO_KEY],
  ])('정해 둔 주소만 대신 묻는다: %s 는 $3', async (_case, call, more, status) => {
    expect((await handleAiProxy(post(call), env(more), fakeNet().f)).status).toBe(status)
  })

  it('Groq 모델 목록은 횟수에 세지 않고 그대로 알려 준다 (모델 이름이 바뀌었을 때 새로 찾으려고)', async () => {
    const net = fakeNet()

    const result = await handleAiProxy(post({ provider: 'groq', method: 'GET', path: 'models' }), env({ groqKey: 'Q' }), net.f)

    expect(result.body).toEqual({ status: OK, data: { data: [{ id: 'openai/gpt-oss-120b' }] } })
    expect(net.calls.some((url) => url.includes('documents:commit'))).toBe(false)
  })

  it('쓸 때마다 횟수와 토큰을 세서 남은 횟수를 돌려준다', async () => {
    const net = fakeNet()
    const usages: AiUsage[] = []

    for (const _ of Array(DAILY_LIMIT)) {
      const result = await handleAiProxy(post(geminiCall), env(), net.f)
      expect(result.status).toBe(OK)
      usages.push((result.body as { usage: AiUsage }).usage)
    }

    expect(usages.map((usage) => usage.remaining)).toEqual([2, 1, 0])
    expect(usages[2]).toMatchObject({ used: DAILY_LIMIT, limit: DAILY_LIMIT, tokens: TOKENS_PER_CALL, tokensToday: DAILY_LIMIT * TOKENS_PER_CALL, provider: 'gemini' })
  })

  it('하루 횟수를 넘으면 막고, 넘은 한 번은 세지 않으며, 한국 날짜별로 사용자 아래에 센다', async () => {
    const net = fakeNet()
    const now = new Date('2026-11-13T00:30:00Z')
    for (const _ of Array(DAILY_LIMIT)) await handleAiProxy(post(geminiCall), env(), net.f, now)

    const over = await handleAiProxy(post(geminiCall), env(), net.f, now)

    expect(over.status).toBe(TOO_MANY)
    expect((over.body as { tidyError: string }).tidyError).toContain('3번 다 썼어요')
    expect(countOf(net)).toBe(DAILY_LIMIT)
    expect([...net.counts.keys()][0]).toContain(`users/u1/aiUsage/${kstDay(now)}`)
  })

  it('구글이 실패하면(한도 초과 등) 그 한 번은 횟수에서 뺀다', async () => {
    const net = fakeNet({ gemini: () => json({ error: { message: 'quota' } }, TOO_MANY) })

    const result = await handleAiProxy(post(geminiCall), env(), net.f)

    expect(result.body).toMatchObject({ status: TOO_MANY })
    expect(countOf(net)).toBe(0)
  })

  it.each([
    // UTC 15:00 = 한국 자정
    ['2026-11-12T15:30:00Z', '2026-11-13'],
    ['2026-11-12T14:30:00Z', '2026-11-12'],
  ])('UTC %s 는 한국 날짜로 %s 이다', (utc, day) => {
    expect(kstDay(new Date(utc))).toBe(day)
  })
})

describe('Tidy AI (앱 쪽)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AI_TEST_TOKEN', 'GOOD')
    clearGeminiModelCache()
  })
  afterEach(() => vi.unstubAllEnvs())

  /** 앱 → Tidy 서버(가짜) → 구글(가짜) */
  function viaServer(net = fakeNet(), serverEnv = env({ dailyLimit: 50 })) {
    const sent: unknown[] = []
    const f = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? 'null'))
      sent.push(body)
      const auth = (init?.headers as Record<string, string>).authorization
      const result = await handleAiProxy({ method: init?.method ?? 'GET', authorization: auth, body }, serverEnv, net.f)
      return json(result.body as object, result.status)
    }) as typeof fetch
    return { f, sent }
  }

  it('키 자리에 SERVER_KEY 를 주면 서버를 거쳐 묻고, 앱은 키를 보내지 않는다', async () => {
    const { f, sent } = viaServer()

    const answer = await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '안녕' }] }, f)

    expect(answer).toBe('좋아요')
    expect(JSON.stringify(sent)).not.toContain('SERVER-G')
    expect(sent[0]).toMatchObject({ provider: 'gemini', path: 'models/gemini-flash-latest:generateContent' })
  })

  it('하루 횟수(1번)를 다 쓰면 알기 쉬운 말로 알려 준다', async () => {
    const ONCE_A_DAY = 1
    const { f } = viaServer(fakeNet(), env({ dailyLimit: ONCE_A_DAY }))
    await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '1' }] }, f)

    const error = await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '2' }] }, f).catch((thrown) => thrown)

    expect(error).toBeInstanceOf(ServerAiError)
    expect(error.message).toContain('1번 다 썼어요')
  })

  it('처음 쓰는 사람(Tidy AI)은 Gemini · Groq 둘 다 서버로 묻는다', () => {
    expect(effectiveAi({ engine: 'tidy' })).toMatchObject({ engine: 'gemini', geminiKey: SERVER_KEY, groqKey: SERVER_KEY })
    expect(engineFor({ engine: 'tidy' }).id).toBe('tidy')
  })

  it('내 Gemini 키가 있으면 그 키로 묻고 예비(Groq)만 서버로 묻는다', () => {
    expect(effectiveAi({ engine: 'gemini', geminiKey: 'MINE' })).toMatchObject({ geminiKey: 'MINE', groqKey: SERVER_KEY })
  })

  it('기본(AI 없이)을 고르면 서버 키를 붙이지 않는다', () => {
    expect(effectiveAi({ engine: 'local' })).toEqual({ engine: 'local' })
  })

  it('로그인하지 않으면 AI 비서는 멈추지 않고 기본(AI 없이)으로 답한다', async () => {
    vi.stubEnv('VITE_AI_TEST_TOKEN', '')

    const reply = await askAssistant({ engine: 'tidy' }, { text: '내일 3시 치과', today: '2026-11-13' })

    expect(reply.engine).toBe('local')
    expect(reply.fallback).toBeTruthy()
  })

  it('남은 횟수와 이번 토큰을 한 줄로 보여 준다', () => {
    expect(usageLine({ used: 12, limit: 50, remaining: 38, tokens: 1203, tokensToday: 9000, provider: 'gemini' })).toBe('오늘 38번 남았어요 (50번 중) · 이번 1,203토큰')
  })
})

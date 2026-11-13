import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { askAssistant } from '../../src/lib/ai/assistantEngines'
import { effectiveAi, engineFor } from '../../src/lib/ai/engines'
import { callGemini, clearGeminiModelCache } from '../../src/lib/ai/gemini'
import { handleAiProxy, kstDay, proxyEnvFrom, type AiProxyEnv, type AiUsage } from '../../src/lib/ai/proxyServer'
import { SERVER_KEY, ServerAiError } from '../../src/lib/ai/serverAi'
import { usageLine } from '../../src/lib/ai/usage'

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const env = (more: Partial<AiProxyEnv> = {}): AiProxyEnv => ({ ...proxyEnvFrom({ GEMINI_API_KEY: 'SERVER-G' }), dailyLimit: 3, ...more })

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
      return opts.gemini?.(JSON.parse(String(init?.body ?? '{}'))) ?? json({ candidates: [{ content: { parts: [{ text: '좋아요' }] } }], usageMetadata: { totalTokenCount: 120 } })
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

describe('Tidy AI 서버 (api/ai)', () => {
  it('키가 있는지와 하루 횟수를 알려 주고, 키는 절대 돌려주지 않는다', async () => {
    const r = await handleAiProxy({ method: 'GET' }, env(), fakeNet().f)
    expect(r.body).toEqual({ gemini: true, groq: false, limit: 3 })
    expect(JSON.stringify(r.body)).not.toContain('SERVER-G')
  })

  it('로그인하지 않았거나 토큰이 틀리면 막는다', async () => {
    const net = fakeNet()
    expect((await handleAiProxy(post(geminiCall, null), env(), net.f)).status).toBe(401)
    expect((await handleAiProxy(post(geminiCall, 'Bearer BAD'), env(), net.f)).status).toBe(401)
    expect(net.calls.some((u) => u.includes('generativelanguage'))).toBe(false)
  })

  it('허용한 메일만 쓸 수 있게 할 수 있다', async () => {
    const r = await handleAiProxy(post(geminiCall), env({ allowedEmails: ['friend@gmail.com'] }), fakeNet().f)
    expect(r.status).toBe(403)
  })

  it('정해 둔 주소만 대신 묻는다', async () => {
    const net = fakeNet()
    expect((await handleAiProxy(post({ ...geminiCall, path: 'models/gemini-x:deleteEverything' }), env(), net.f)).status).toBe(400)
    // Groq 모델 이름은 바뀔 수 있어서 모양만 본다
    expect((await handleAiProxy(post({ provider: 'groq', payload: { model: '../../admin?x=1' } }), env({ groqKey: 'Q' }), net.f)).status).toBe(400)
    expect((await handleAiProxy(post({ provider: 'groq', payload: {} }), env({ groqKey: 'Q' }), net.f)).status).toBe(400)
    expect((await handleAiProxy(post({ provider: 'groq', payload: { model: 'llama-3.1-8b-instant' } }), env(), net.f)).status).toBe(503)
  })

  it('Groq 모델 목록은 횟수에 세지 않고 그대로 알려 준다 (모델 이름이 바뀌었을 때 새로 찾으려고)', async () => {
    const net = fakeNet()
    const r = await handleAiProxy(post({ provider: 'groq', method: 'GET', path: 'models' }), env({ groqKey: 'Q' }), net.f)
    expect(r.body).toEqual({ status: 200, data: { data: [{ id: 'openai/gpt-oss-120b' }] } })
    expect(net.calls.some((u) => u.includes('documents:commit'))).toBe(false)
  })

  it('한 번 쓸 때마다 횟수와 토큰을 세서 남은 횟수를 돌려주고, 하루 횟수를 넘으면 막는다', async () => {
    const net = fakeNet()
    const now = new Date('2026-11-13T00:30:00Z')
    const usages: AiUsage[] = []
    for (let i = 0; i < 3; i++) {
      const r = await handleAiProxy(post(geminiCall), env(), net.f, now)
      expect(r.status).toBe(200)
      usages.push((r.body as { usage: AiUsage }).usage)
    }
    expect(usages.map((u) => u.remaining)).toEqual([2, 1, 0])
    expect(usages[2]).toMatchObject({ used: 3, limit: 3, tokens: 120, tokensToday: 360, provider: 'gemini' })
    const over = await handleAiProxy(post(geminiCall), env(), net.f, now)
    expect(over.status).toBe(429)
    expect((over.body as { tidyError: string }).tidyError).toContain('3번 다 썼어요')
    // 넘은 한 번은 세지 않는다
    expect([...net.counts.values()][0].count).toBe(3)
    expect([...net.counts.keys()][0]).toContain(`users/u1/aiUsage/${kstDay(now)}`)
  })

  it('구글이 실패하면(한도 초과 등) 그 한 번은 횟수에서 뺀다', async () => {
    const net = fakeNet({ gemini: () => json({ error: { message: 'quota' } }, 429) })
    const r = await handleAiProxy(post(geminiCall), env(), net.f)
    expect(r.body).toMatchObject({ status: 429 })
    expect([...net.counts.values()][0].count).toBe(0)
  })

  it('한국 시간으로 날짜를 나눈다', () => {
    expect(kstDay(new Date('2026-11-12T15:30:00Z'))).toBe('2026-11-13')
    expect(kstDay(new Date('2026-11-12T14:30:00Z'))).toBe('2026-11-12')
  })
})

describe('Tidy AI (앱 쪽)', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_AI_TEST_TOKEN', 'GOOD')
    clearGeminiModelCache()
  })
  afterEach(() => vi.unstubAllEnvs())

  /** 앱 → Tidy 서버(가짜) → 구글(가짜) */
  function viaServer(net = fakeNet(), e = env({ dailyLimit: 50 })) {
    const sent: unknown[] = []
    const f = (async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? 'null'))
      sent.push(body)
      const auth = (init?.headers as Record<string, string>).authorization
      const r = await handleAiProxy({ method: init?.method ?? 'GET', authorization: auth, body }, e, net.f)
      return json(r.body as object, r.status)
    }) as typeof fetch
    return { f, sent }
  }

  it('키 자리에 SERVER_KEY 를 주면 서버를 거쳐 묻고, 앱은 키를 보내지 않는다', async () => {
    const { f, sent } = viaServer()
    expect(await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '안녕' }] }, f)).toBe('좋아요')
    expect(JSON.stringify(sent)).not.toContain('SERVER-G')
    expect(sent[0]).toMatchObject({ provider: 'gemini', path: 'models/gemini-flash-latest:generateContent' })
  })

  it('하루 횟수를 다 쓰면 알기 쉬운 말로 알려 준다', async () => {
    const { f } = viaServer(fakeNet(), env({ dailyLimit: 0 + 1 }))
    await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '1' }] }, f)
    const e = await callGemini(SERVER_KEY, { system: 'S', parts: [{ text: '2' }] }, f).catch((x) => x)
    expect(e).toBeInstanceOf(ServerAiError)
    expect(e.message).toContain('1번 다 썼어요')
  })

  it('처음 쓰는 사람은 Tidy AI, 내 Gemini 키가 있으면 예비만 서버로', () => {
    expect(effectiveAi({ engine: 'tidy' })).toMatchObject({ engine: 'gemini', geminiKey: SERVER_KEY, groqKey: SERVER_KEY })
    expect(effectiveAi({ engine: 'gemini', geminiKey: 'MINE' })).toMatchObject({ geminiKey: 'MINE', groqKey: SERVER_KEY })
    expect(effectiveAi({ engine: 'local' })).toEqual({ engine: 'local' })
    expect(engineFor({ engine: 'tidy' }).id).toBe('tidy')
  })

  it('로그인하지 않으면 AI 비서는 멈추지 않고 기본(AI 없이)으로 답한다', async () => {
    vi.stubEnv('VITE_AI_TEST_TOKEN', '')
    const r = await askAssistant({ engine: 'tidy' }, { text: '내일 3시 치과', today: '2026-11-13' })
    expect(r.engine).toBe('local')
    expect(r.fallback).toBeTruthy()
  })

  it('남은 횟수 한 줄', () => {
    expect(usageLine({ used: 12, limit: 50, remaining: 38, tokens: 1203, tokensToday: 9000, provider: 'gemini' })).toBe('오늘 38번 남았어요 (50번 중) · 이번 1,203토큰')
  })
})

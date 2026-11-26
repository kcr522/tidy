import { describe, expect, it } from 'vitest'
import { askAssistant } from '../../src/lib/ai/assistantEngines'
import { engineFor } from '../../src/lib/ai/engines'
import { clearGeminiModelCache } from '../../src/lib/ai/gemini'
import { callGroq, clearGroqModelCache, GROQ_ENDPOINT, GROQ_MODELS, GROQ_MODELS_URL, pickGroqModels } from '../../src/lib/ai/groq'

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const answer = (content: string) => json({ choices: [{ message: { content } }] })
const GROQ_KEY = 'G'
const ask = { system: 'S', user: 'U' }
const NEW_MODEL = 'openai/gpt-oss-120b'
const emptySnapshot = { date: '2026-11-10', todayTotal: 0, items: [], monthExpense: 0, monthIncome: 0, dailyAverage: null }

/** 실제 fetch 를 잠깐 바꿔 끼우고 fn 이 끝나면 되돌린다 */
async function withFetch(fake: (url: string) => Promise<Response>, fn: () => Promise<void>) {
  const real = globalThis.fetch
  globalThis.fetch = fake as typeof fetch
  try {
    await fn()
  } finally {
    globalThis.fetch = real
  }
}
const isGemini = (url: string) => String(url).includes('generativelanguage')

describe('예비 AI: Groq', () => {
  /** 정해 둔 모델은 모두 404, 모델 목록의 openai/ 모델만 답하는 가짜 Groq */
  function groqWithNewModels(asked: string[]) {
    return (async (url: string, init?: RequestInit) => {
      if (url === GROQ_MODELS_URL) return json({ data: [{ id: 'whisper-large-v3' }, { id: 'openai/gpt-oss-20b' }, { id: NEW_MODEL }, { id: 'llama-guard-4-12b' }] })
      const model = JSON.parse(String(init?.body)).model as string
      asked.push(model)
      return model.startsWith('openai/') ? answer('새 모델 답') : json({ error: { message: 'The model does not exist', code: 'model_not_found' } }, 404)
    }) as typeof fetch
  }

  it('정해 둔 모델이 다 없어지면(404) 모델 목록에서 새 모델을 찾아 묻는다', async () => {
    clearGroqModelCache()
    const asked: string[] = []

    const result = await callGroq(GROQ_KEY, ask, groqWithNewModels(asked))

    expect(result).toEqual({ text: '새 모델 답', model: NEW_MODEL })
    expect(asked).toEqual([...GROQ_MODELS, NEW_MODEL])
    clearGroqModelCache()
  })

  it('한 번 찾은 새 모델은 다음부터 바로 묻는다', async () => {
    clearGroqModelCache()
    const asked: string[] = []
    const fakeGroq = groqWithNewModels(asked)
    await callGroq(GROQ_KEY, ask, fakeGroq)
    asked.length = 0

    await callGroq(GROQ_KEY, ask, fakeGroq)

    expect(asked).toEqual([NEW_MODEL])
    clearGroqModelCache()
  })

  it('모델 목록에서 음성 · 안전 검사 모델은 빼고 큰 모델을 먼저 놓는다', () => {
    const listed = ['whisper-large-v3', 'llama-3.1-8b-instant', NEW_MODEL, 'meta-llama/llama-guard-4-12b', 'playai-tts']

    expect(pickGroqModels(listed)).toEqual([NEW_MODEL, 'llama-3.1-8b-instant'])
  })

  it('큰 모델 한도가 차면(429) 키를 붙여 작은 모델로 다시 묻는다', async () => {
    const models: string[] = []
    const fakeGroq = (async (url: string, init?: RequestInit) => {
      expect(url).toBe(GROQ_ENDPOINT)
      expect((init?.headers as Record<string, string>).authorization).toBe(`Bearer ${GROQ_KEY}`)
      models.push(JSON.parse(String(init?.body)).model)
      return models.length === 1 ? json({ error: { message: 'rate limit' } }, 429) : answer('안녕')
    }) as typeof fetch

    const result = await callGroq(GROQ_KEY, ask, fakeGroq)

    expect(result).toEqual({ text: '안녕', model: GROQ_MODELS[1] })
    expect(models).toEqual(GROQ_MODELS)
  })

  it('모든 모델 한도가 차면 무료 사용량을 다 썼다고 알려 준다', async () => {
    const full = (async () => json({}, 429)) as typeof fetch

    await expect(callGroq(GROQ_KEY, ask, full)).rejects.toThrow('Groq 무료 사용량도 다 썼어요')
  })

  it('키가 틀리면(401) 다른 모델을 묻지 않고 바로 알려 준다', async () => {
    const badKey = (async () => json({}, 401)) as typeof fetch

    await expect(callGroq(GROQ_KEY, ask, badKey)).rejects.toThrow('Groq 키가 맞지 않아요')
  })

  it('Gemini 한도가 차면 AI 비서는 Groq 로 답하고 예비 AI 를 썼다고 알려 준다', async () => {
    clearGeminiModelCache()
    const groqReply = JSON.stringify({ kind: 'event', reply: '일정을 찾았어요', events: [{ title: '치과', startDate: '2026-11-11', endDate: '2026-11-11', time: '15:00', place: null, note: '' }], payments: [], diary: null })

    await withFetch(
      async (url) => (isGemini(url) ? json({ error: { message: 'quota' } }, 429) : answer(groqReply)),
      async () => {
        const result = await askAssistant({ engine: 'gemini', geminiKey: 'K', groqKey: GROQ_KEY }, { today: '2026-11-10', text: '내일 3시 치과' })

        expect(result.engine).toBe('groq')
        expect(result.kind).toBe('event')
        expect(result.note).toContain('예비 AI')
        expect(result.fallback).toBeUndefined()
      },
    )
  })

  it('소비 한마디도 Gemini 가 막히면 Groq 로 답한다', async () => {
    clearGeminiModelCache()

    await withFetch(
      async (url) => (isGemini(url) ? json({}, 429) : answer('오늘도 잘 아꼈어요')),
      async () => {
        const engine = engineFor({ engine: 'gemini', geminiKey: 'K', groqKey: GROQ_KEY })

        expect(await engine.generate('feedback', emptySnapshot)).toBe('오늘도 잘 아꼈어요')
      },
    )
  })

  it('소비 한마디에서 Gemini 도 Groq 도 안 되면 둘 다 이유를 보여 준다', async () => {
    clearGeminiModelCache()
    clearGroqModelCache()

    await withFetch(
      async (url) => (isGemini(url) ? json({}, 429) : json({}, 401)),
      async () => {
        const engine = engineFor({ engine: 'gemini', geminiKey: 'K', groqKey: GROQ_KEY })

        await expect(engine.generate('feedback', emptySnapshot)).rejects.toThrow(/사용량.*예비 AI\(Groq\)도 안 됐어요: Groq 키가 맞지 않아요/)
      },
    )
  })
})

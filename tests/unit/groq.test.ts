import { describe, expect, it } from 'vitest'
import { askAssistant } from '../../src/lib/ai/assistantEngines'
import { engineFor } from '../../src/lib/ai/engines'
import { clearGeminiModelCache } from '../../src/lib/ai/gemini'
import { callGroq, GROQ_ENDPOINT, GROQ_MODELS } from '../../src/lib/ai/groq'

const json = (body: object, status = 200) => new Response(JSON.stringify(body), { status })
const answer = (content: string) => json({ choices: [{ message: { content } }] })

describe('예비 AI: Groq', () => {
  it('큰 모델 한도가 차면 작은 모델로 묻는다', async () => {
    const models: string[] = []
    const f = (async (url: string, init?: RequestInit) => {
      expect(url).toBe(GROQ_ENDPOINT)
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer G')
      const body = JSON.parse(String(init?.body))
      models.push(body.model)
      return models.length === 1 ? json({ error: { message: 'rate limit' } }, 429) : answer('안녕')
    }) as typeof fetch
    expect(await callGroq('G', { system: 'S', user: 'U' }, f)).toEqual({ text: '안녕', model: GROQ_MODELS[1] })
    expect(models).toEqual(GROQ_MODELS)
  })

  it('둘 다 차면 알기 쉬운 에러, 키가 틀리면 바로 에러', async () => {
    const full = (async () => json({}, 429)) as typeof fetch
    await expect(callGroq('G', { system: 'S', user: 'U' }, full)).rejects.toThrow('Groq 무료 사용량도 다 썼어요')
    const bad = (async () => json({}, 401)) as typeof fetch
    await expect(callGroq('G', { system: 'S', user: 'U' }, bad)).rejects.toThrow('Groq 키가 맞지 않아요')
  })

  it('Gemini 한도가 차면 AI 비서는 Groq로 답한다', async () => {
    clearGeminiModelCache()
    const real = globalThis.fetch
    globalThis.fetch = (async (url: string) => {
      if (String(url).includes('generativelanguage')) return json({ error: { message: 'quota' } }, 429)
      return answer(JSON.stringify({ kind: 'event', reply: '일정을 찾았어요', events: [{ title: '치과', startDate: '2026-11-11', endDate: '2026-11-11', time: '15:00', place: null, note: '' }], payments: [], diary: null }))
    }) as typeof fetch
    try {
      const res = await askAssistant({ engine: 'gemini', geminiKey: 'K', groqKey: 'G' }, { today: '2026-11-10', text: '내일 3시 치과' })
      expect(res.engine).toBe('groq')
      expect(res.kind).toBe('event')
      expect(res.note).toContain('예비 AI')
      expect(res.fallback).toBeUndefined()
    } finally {
      globalThis.fetch = real
    }
  })

  it('소비 한마디도 Gemini가 막히면 Groq로', async () => {
    clearGeminiModelCache()
    const real = globalThis.fetch
    globalThis.fetch = (async (url: string) => (String(url).includes('generativelanguage') ? json({}, 429) : answer('오늘도 잘 아꼈어요'))) as typeof fetch
    try {
      const engine = engineFor({ engine: 'gemini', geminiKey: 'K', groqKey: 'G' })
      const snapshot = { date: '2026-11-10', todayTotal: 0, items: [], monthExpense: 0, monthIncome: 0, dailyAverage: null }
      expect(await engine.generate('feedback', snapshot)).toBe('오늘도 잘 아꼈어요')
    } finally {
      globalThis.fetch = real
    }
  })
})

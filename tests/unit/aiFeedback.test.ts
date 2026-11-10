import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { engineFor, localEngine } from '../../src/lib/ai/engines'
import { localFeedback } from '../../src/lib/ai/localEngine'
import { askClaude, FEEDBACK_MODES, sanitizeSnapshot, systemPrompt, userPrompt, type FeedbackMode } from '../../src/lib/ai/prompts'
import { buildSnapshot, snapshotKey } from '../../src/lib/ai/snapshot'

const t = (type: Transaction['type'], amount: number, date: string, memo = '', category = '식비', time?: string): Transaction => ({
  type,
  amount,
  category,
  date,
  memo,
  ...(time ? { time } : {}),
  createdAt: '',
  updatedAt: '',
})

const today = '2026-11-10'
const month = [
  t('INCOME', 2_000_000, '2026-11-01', '월급', '월급'),
  t('EXPENSE', 90_000, '2026-11-03', '마트'),
  t('EXPENSE', 4_500, today, '스타벅스', '카페', '09:10'),
  t('EXPENSE', 32_000, today, '올리브영', '쇼핑', '18:40'),
  t('EXPENSE', 1_000, '2026-11-20', '미래 내역'),
]

describe('buildSnapshot', () => {
  it('오늘 지출과 오늘 전까지 하루 평균을 계산한다', () => {
    const s = buildSnapshot(month, today)
    expect(s.todayTotal).toBe(36_500)
    expect(s.items.map((i) => i.name)).toEqual(['스타벅스', '올리브영'])
    expect(s.monthExpense).toBe(126_500) // 미래 날짜는 빼고
    expect(s.monthIncome).toBe(2_000_000)
    expect(s.dailyAverage).toBe(10_000) // 90,000 ÷ 9일
  })

  it('1일에는 평균이 없다', () => {
    expect(buildSnapshot([t('EXPENSE', 5000, '2026-11-01')], '2026-11-01').dailyAverage).toBeNull()
  })

  it('메모가 없으면 카테고리를 이름으로 쓴다', () => {
    expect(buildSnapshot([t('EXPENSE', 5000, today, '  ', '교통')], today).items[0].name).toBe('교통')
  })

  it('내역이 바뀌면 key도 바뀐다', () => {
    const a = snapshotKey(buildSnapshot(month, today))
    const b = snapshotKey(buildSnapshot([...month, t('EXPENSE', 1000, today, '편의점')], today))
    expect(a).not.toBe(b)
  })
})

describe('prompts', () => {
  it('모드마다 다른 말투가 시스템 프롬프트에 들어간다', () => {
    const prompts = FEEDBACK_MODES.map((m) => systemPrompt(m.id))
    expect(new Set(prompts).size).toBe(3)
    expect(systemPrompt('saver')).toContain('절약 잔소리')
    expect(systemPrompt('cheer')).toContain('무조건 칭찬')
  })

  it('사용자 메시지에 오늘 내역과 금액이 들어간다', () => {
    const p = userPrompt(buildSnapshot(month, today))
    expect(p).toContain('09:10 스타벅스 (카페) 4,500원')
    expect(p).toContain('오늘(2026-11-10) 쓴 돈: 36,500원')
    expect(p).toContain('하루 평균: 10,000원')
  })
})

describe('sanitizeSnapshot', () => {
  it('이상한 값은 거른다', () => {
    expect(sanitizeSnapshot(null)).toBeNull()
    expect(sanitizeSnapshot({ date: 'today' })).toBeNull()
    const s = sanitizeSnapshot({
      date: today,
      todayTotal: -5,
      items: Array.from({ length: 50 }, () => ({ name: 'x'.repeat(100), amount: 1.6, category: 3 })),
      monthExpense: 'a',
      dailyAverage: null,
    })!
    expect(s.todayTotal).toBe(0)
    expect(s.items).toHaveLength(30)
    expect(s.items[0]).toEqual({ name: 'x'.repeat(40), category: '기타', amount: 2 })
    expect(s.monthExpense).toBe(0)
  })
})

describe('localFeedback', () => {
  const s = buildSnapshot(month, today)
  it.each(['feedback', 'saver', 'cheer'] as FeedbackMode[])('%s 모드는 빈 말이 아니다', (mode) => {
    expect(localFeedback(mode, s).length).toBeGreaterThan(10)
  })

  it('잔소리 모드는 가장 큰 지출을 짚는다', () => {
    expect(localFeedback('saver', s)).toContain('올리브영 32,000원')
  })

  it('하루 평균과 비교한다', () => {
    expect(localFeedback('feedback', s)).toContain('하루 평균보다 26,500원 더 썼어')
  })

  it('무지출이면 따로 말한다', () => {
    const empty = buildSnapshot([], today)
    expect(localFeedback('cheer', empty)).toMatch(/무지출|0원/)
  })
})

describe('engineFor', () => {
  it('키가 없으면 기본으로 돌아간다', () => {
    expect(engineFor({ engine: 'key' })).toBe(localEngine)
    expect(engineFor({ engine: 'local' })).toBe(localEngine)
    expect(engineFor({ engine: 'server' }).id).toBe('server')
    expect(engineFor({ engine: 'key', apiKey: 'sk-ant-x' }).id).toBe('key')
  })
})

describe('askClaude', () => {
  const s = buildSnapshot(month, today)
  const fake = (res: object) => {
    const create = vi.fn().mockResolvedValue(res)
    return { client: { beta: { messages: { create } } } as never, create }
  }

  it('모델, 말투, 내역을 담아 묻고 글만 돌려준다', async () => {
    const { client, create } = fake({ stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: ' 잘했어! ' }] })
    await expect(askClaude(client, 'cheer', s)).resolves.toBe('잘했어!')
    const req = create.mock.calls[0][0]
    expect(req.model).toBe('claude-opus-5-5')
    expect(req.fallbacks).toBe('default')
    expect(req.system).toContain('무조건 칭찬')
    expect(req.messages[0].content).toContain('올리브영')
  })

  it('거절되면 오류', async () => {
    const { client } = fake({ stop_reason: 'refusal', content: [] })
    await expect(askClaude(client, 'feedback', s)).rejects.toThrow('답하지 않았어요')
  })
})

describe('Gemini', () => {
  const s = buildSnapshot(month, today)
  const mockFetch = (status: number, body: object) => {
    const f = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }))
    vi.stubGlobal('fetch', f)
    return f
  }

  it('키가 있으면 Gemini로 묻고, 키를 헤더에 넣는다', async () => {
    const f = mockFetch(200, { candidates: [{ content: { parts: [{ text: '생각', thought: true }, { text: '오늘 잘 썼어! ' }] } }] })
    const engine = engineFor({ engine: 'gemini', geminiKey: 'AIza-test' })
    expect(engine.id).toBe('gemini')
    await expect(engine.generate('saver', s)).resolves.toBe('오늘 잘 썼어!')
    const [url, init] = f.mock.calls[0]
    expect(url).toContain('gemini-flash-latest:generateContent')
    expect(init.headers['x-goog-api-key']).toBe('AIza-test')
    const body = JSON.parse(init.body)
    expect(body.systemInstruction.parts[0].text).toContain('절약 잔소리')
    expect(body.contents[0].parts[0].text).toContain('올리브영')
    vi.unstubAllGlobals()
  })

  it('무료 사용량을 다 쓰면 알려 준다', async () => {
    mockFetch(429, { error: { message: 'quota' } })
    await expect(engineFor({ engine: 'gemini', geminiKey: 'k' }).generate('cheer', s)).rejects.toThrow('무료 사용량')
    vi.unstubAllGlobals()
  })

  it('키가 없으면 기본으로', () => {
    expect(engineFor({ engine: 'gemini' })).toBe(localEngine)
  })
})

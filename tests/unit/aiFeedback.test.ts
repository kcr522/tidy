import { describe, expect, it, vi } from 'vitest'
import type { Transaction } from '../../src/db/types'
import { engineFor, localEngine } from '../../src/lib/ai/engines'
import { localFeedback } from '../../src/lib/ai/localEngine'
import { FEEDBACK_MODES, sanitizeSnapshot, systemPrompt, userPrompt, type FeedbackMode } from '../../src/lib/ai/prompts'
import { buildSnapshot, snapshotKey } from '../../src/lib/ai/snapshot'

/** 내역 하나 만들기: 구분, 금액, 날짜, 메모, 카테고리, 시각 */
const row = (type: Transaction['type'], amount: number, date: string, memo = '', category = '식비', time?: string): Transaction => ({
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
  row('INCOME', 2_000_000, '2026-11-01', '월급', '월급'),
  row('EXPENSE', 90_000, '2026-11-03', '마트'),
  row('EXPENSE', 4_500, today, '스타벅스', '카페', '09:10'),
  row('EXPENSE', 32_000, today, '올리브영', '쇼핑', '18:40'),
  row('EXPENSE', 1_000, '2026-11-20', '미래 내역'),
]

describe('buildSnapshot', () => {
  it('오늘 지출 합계와 오늘 쓴 항목을 모은다', () => {
    const snapshot = buildSnapshot(month, today)

    expect(snapshot.todayTotal).toBe(36_500) // 4,500 + 32,000
    expect(snapshot.items.map((item) => item.name)).toEqual(['스타벅스', '올리브영'])
  })

  it('이번 달 지출 · 수입은 오늘 뒤의 미래 내역을 빼고 센다', () => {
    const snapshot = buildSnapshot(month, today)

    expect(snapshot.monthExpense).toBe(126_500) // 90,000 + 36,500, 미래 1,000원은 빠짐
    expect(snapshot.monthIncome).toBe(2_000_000)
  })

  it('하루 평균은 오늘 전까지의 지출을 지난 날 수로 나눈다', () => {
    const snapshot = buildSnapshot(month, today)

    expect(snapshot.dailyAverage).toBe(10_000) // 90,000 ÷ 9일 (1~9일)
  })

  it('1일에는 지난 날이 없어서 하루 평균이 없다', () => {
    const firstDay = '2026-11-01'

    const snapshot = buildSnapshot([row('EXPENSE', 5000, firstDay)], firstDay)

    expect(snapshot.dailyAverage).toBeNull()
  })

  it('메모가 공백뿐이면 카테고리를 이름으로 쓴다', () => {
    const blankMemo = '  '

    const snapshot = buildSnapshot([row('EXPENSE', 5000, today, blankMemo, '교통')], today)

    expect(snapshot.items[0].name).toBe('교통')
  })

  it('내역이 하나라도 늘면 캐시 key 도 바뀐다', () => {
    const before = snapshotKey(buildSnapshot(month, today))
    const after = snapshotKey(buildSnapshot([...month, row('EXPENSE', 1000, today, '편의점')], today))

    expect(before).not.toBe(after)
  })
})

describe('prompts', () => {
  it('모드 3가지는 시스템 프롬프트가 모두 다르다', () => {
    const prompts = FEEDBACK_MODES.map((mode) => systemPrompt(mode.id))

    expect(new Set(prompts).size).toBe(3)
  })

  it.each([
    ['saver', '절약 잔소리'],
    ['cheer', '무조건 칭찬'],
  ] as [FeedbackMode, string][])('%s 모드 시스템 프롬프트에는 "%s" 말투가 들어간다', (mode, tone) => {
    expect(systemPrompt(mode)).toContain(tone)
  })

  it('사용자 메시지에 오늘 내역 · 합계 · 하루 평균이 들어간다', () => {
    const prompt = userPrompt(buildSnapshot(month, today))

    expect(prompt).toContain('09:10 스타벅스 (카페) 4,500원')
    expect(prompt).toContain('오늘(2026-11-10) 쓴 돈: 36,500원')
    expect(prompt).toContain('하루 평균: 10,000원')
  })
})

describe('sanitizeSnapshot', () => {
  it.each([
    ['null', null],
    ['날짜가 틀린 값', { date: 'today' }],
  ])('%s 은 버린다', (_case, input) => {
    expect(sanitizeSnapshot(input)).toBeNull()
  })

  it('음수 · 글자 금액은 0, 항목은 30개 · 이름은 40자까지, 소수는 반올림한다', () => {
    const MAX_ITEMS = 30
    const MAX_NAME = 40
    const messy = {
      date: today,
      todayTotal: -5,
      items: Array.from({ length: 50 }, () => ({ name: 'x'.repeat(100), amount: 1.6, category: 3 })),
      monthExpense: 'a',
      dailyAverage: null,
    }

    const clean = sanitizeSnapshot(messy)!

    expect(clean.todayTotal).toBe(0)
    expect(clean.items).toHaveLength(MAX_ITEMS)
    expect(clean.items[0]).toEqual({ name: 'x'.repeat(MAX_NAME), category: '기타', amount: 2 })
    expect(clean.monthExpense).toBe(0)
  })
})

describe('localFeedback', () => {
  const snapshot = buildSnapshot(month, today)

  it.each(['feedback', 'saver', 'cheer'] as FeedbackMode[])('%s 모드는 10자 넘는 말을 한다', (mode) => {
    expect(localFeedback(mode, snapshot).length).toBeGreaterThan(10)
  })

  it('잔소리 모드는 오늘 가장 큰 지출을 짚는다', () => {
    expect(localFeedback('saver', snapshot)).toContain('올리브영 32,000원')
  })

  it('피드백 모드는 하루 평균보다 얼마 더 썼는지 말한다', () => {
    expect(localFeedback('feedback', snapshot)).toContain('하루 평균보다 26,500원 더 썼어') // 36,500 - 10,000
  })

  it('오늘 쓴 돈이 없으면 무지출이라고 말한다', () => {
    const noSpending = buildSnapshot([], today)

    expect(localFeedback('cheer', noSpending)).toMatch(/무지출|0원/)
  })
})

describe('engineFor', () => {
  it.each([
    ['gemini 를 골랐지만 키가 없으면 기본', 'gemini', localEngine.id],
    ['local 이면 기본', 'local', localEngine.id],
    ['tidy 면 Tidy AI 서버', 'tidy', 'tidy'],
  ] as const)('%s 엔진을 쓴다', (_case, engine, engineId) => {
    expect(engineFor({ engine }).id).toBe(engineId)
  })
})

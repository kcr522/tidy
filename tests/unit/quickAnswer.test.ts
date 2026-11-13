import { describe, expect, it } from 'vitest'
import { answerQuick, detectQuick, type QuickIntent } from '../../src/lib/assistant/quickAnswer'
import type { CalendarEvent, Recurring, SavingsPlan, Todo, Transaction } from '../../src/db/types'
import { holidaysBetween } from '../../src/lib/holidays'

const TODAY = '2026-11-13' // 금요일

describe('AI 없이 답할 질문 알아보기', () => {
  const cases: [string, QuickIntent['kind'] | null, Partial<Record<string, string>>?][] = [
    ['오늘 일정 뭐야?', 'schedule', { from: TODAY, to: TODAY }],
    ['오늘 뭐해야해?', 'schedule', { from: TODAY }],
    ['오늘 뭐하는 날이야', 'schedule', { from: TODAY }],
    ['내일 약속 있어?', 'schedule', { from: '2026-11-14' }],
    ['이번 주 할 일 알려줘', 'schedule', { from: '2026-11-09', to: '2026-11-15' }],
    ['다음 주 스케줄', 'schedule', { from: '2026-11-16', to: '2026-11-22' }],
    ['주말에 뭐 있어?', 'schedule', { from: '2026-11-14', to: '2026-11-15' }],
    ['12월 25일 무슨 날이야?', 'schedule', { from: '2026-12-25' }],
    ['이번 달 얼마 썼어?', 'spending', { from: '2026-11-01', to: '2026-11-30' }],
    ['오늘 얼마 썼어', 'spending', { from: TODAY, to: TODAY }],
    ['지난달 식비 얼마 나갔어?', 'spending', { from: '2026-10-01', to: '2026-10-31' }],
    ['이번 달 수입 얼마야?', 'spending'],
    ['예산 얼마 남았어?', 'budget'],
    ['적금 얼마 모았어?', 'savings'],
    ['만기 언제야?', 'savings'],
    ['월급날 언제야?', 'recurring'],
    ['구독 결제일 알려줘', 'recurring'],
    ['어제 일기 뭐 썼어?', 'diary', { date: '2026-11-12' }],
    // AI 에게 넘길 말
    ['내일 3시 치과', null],
    ['점심 김치찌개 9천원 썼어', null],
    ['적금 금리 높은 곳 추천해줘', null],
    ['예산 짜는 방법 알려줘', null],
    ['오늘 산책하고 기분 좋았다', null],
    ['청년도약계좌 가입 조건이 뭐야?', null],
  ]
  for (const [text, kind, fields] of cases) {
    it(`"${text}" → ${kind ?? 'AI'}`, () => {
      const q = detectQuick(text, TODAY)
      expect(q?.kind ?? null).toBe(kind)
      if (q && fields) expect(q).toMatchObject(fields)
    })
  }
})

const now = '2026-11-01T00:00:00Z'
const ev = (title: string, startDate: string, endDate = startDate, memo = ''): CalendarEvent => ({ title, startDate, endDate, memo, color: 'sky', createdAt: now, updatedAt: now })
const todo = (title: string, dueDate: string | null, done = false): Todo => ({ title, dueDate, isCompleted: done ? 1 : 0, completedAt: null, priority: 'MEDIUM', createdAt: now, updatedAt: now }) as Todo
const tx = (amount: number, category: string, date: string, type: 'EXPENSE' | 'INCOME' = 'EXPENSE'): Transaction => ({ type, amount, category, date, memo: '', createdAt: now, updatedAt: now }) as Transaction

describe('기록으로 답 만들기', () => {
  it('오늘 일정: 일정은 시간 순, 할 일, 결제일, 마감 지난 할 일', () => {
    const q = detectQuick('오늘 뭐해야해?', TODAY)!
    const text = answerQuick(
      q,
      {
        events: [ev('팀 회의', TODAY), ev('치과', TODAY, TODAY, '오후 3:00 · 강남'), ev('아침 요가', TODAY, TODAY, '오전 7:30')],
        todos: [todo('보고서 내기', TODAY), todo('끝낸 일', TODAY, true), todo('택배 반품', '2026-11-10')],
        recurring: [{ type: 'EXPENSE', amount: 17000, category: '문화/여가', memo: '넷플릭스', day: 13, startDate: '2026-01-01', lastDate: null, isActive: 1 } as Recurring],
        holidays: holidaysBetween(TODAY, TODAY),
      },
      TODAY,
    )
    expect(text).toContain('오늘 11월 13일 (금) 일정이에요')
    expect(text.indexOf('아침 요가')).toBeLessThan(text.indexOf('치과'))
    expect(text).toContain('오후 3:00 치과')
    expect(text).toContain('✅ 보고서 내기')
    expect(text).not.toContain('끝낸 일')
    expect(text).toContain('넷플릭스 나가는 날 (17,000원)')
    expect(text).toContain('마감이 지난 할 일 1개: 택배 반품')
  })

  it('공휴일과 빈 날', () => {
    const q = detectQuick('12월 25일 무슨 날이야?', TODAY)!
    expect(answerQuick(q, { events: [], todos: [], holidays: holidaysBetween('2026-12-25', '2026-12-25') }, TODAY)).toContain('🎌 성탄절')
    const empty = detectQuick('내일 일정 있어?', TODAY)!
    expect(answerQuick(empty, { events: [], todos: [], holidays: new Map() }, TODAY)).toContain('여유로운 하루')
  })

  it('지출 합계와 카테고리', () => {
    const list = [tx(9000, '식비', '2026-11-02'), tx(30000, '쇼핑', '2026-11-05'), tx(6000, '식비', TODAY), tx(2500000, '월급', '2026-11-10', 'INCOME'), tx(5000, '식비', '2026-10-31')]
    const month = answerQuick(detectQuick('이번 달 얼마 썼어?', TODAY)!, { transactions: list }, TODAY, '이번 달 얼마 썼어?')
    expect(month).toContain('이번 달(11월) 지출은 모두 45,000원이에요 (3건)')
    expect(month).toContain('쇼핑 30,000원')
    expect(month).toContain('수입은 2,500,000원')
    const food = answerQuick(detectQuick('이번 달 식비 얼마 썼어?', TODAY)!, { transactions: list }, TODAY, '이번 달 식비 얼마 썼어?')
    expect(food).toContain('식비는 15,000원이에요 (2건')
  })

  it('예산', () => {
    const none = answerQuick({ kind: 'budget' }, { budgets: [], transactions: [] }, TODAY)
    expect(none).toContain('예산을 정하지 않았어요')
    const text = answerQuick({ kind: 'budget' }, { budgets: [{ category: '', amount: 500000, updatedAt: now }], transactions: [tx(200000, '식비', '2026-11-03')] }, TODAY)
    expect(text).toContain('500,000원 중 200,000원을 썼어요 (40%). 300,000원 남았어요')
    expect(text).toContain('남은 18일 동안 하루 16,666원씩')
  })

  it('적금과 월급날', () => {
    const plan = { name: '청년적금', amount: 100000, startDate: '2026-09-13', endDate: '2027-09-13', rate: 4, interestType: 'simple', taxType: 'normal', schedule: { freq: 'monthly', day: 13 } } as SavingsPlan
    expect(answerQuick({ kind: 'savings' }, { savings: [plan] }, TODAY)).toContain('청년적금: 300,000원 모았어요 (3/12회)')
    const pay = { type: 'INCOME', amount: 2500000, category: '월급', memo: '월급', day: 25, startDate: '2026-01-01', lastDate: null, isActive: 1 } as Recurring
    expect(answerQuick({ kind: 'recurring', income: true }, { recurring: [pay] }, TODAY)).toContain('월급 2,500,000원: 11월 25일 (수), D-12')
  })

  it('일기', () => {
    const q = detectQuick('어제 일기 뭐 썼어?', TODAY)!
    expect(answerQuick(q, { diary: { date: '2026-11-12', text: '산책했다', createdAt: now, updatedAt: now } as never }, TODAY)).toContain('"산책했다"')
    expect(answerQuick(q, { diary: null }, TODAY)).toContain('쓴 일기가 없어요')
  })
})

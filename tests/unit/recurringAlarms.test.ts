import { describe, expect, it } from 'vitest'
import type { Recurring, Transaction } from '../../src/db/types'
import { alarmTimesFor, fixedSummary, missedTodayRecurring, recurringAlarmTitle, upcomingRecurringAlarms } from '../../src/lib/recurringAlarms'
import { guessRecurring } from '../../src/lib/recurringGuess'

const NO_REMIND = null
const SAME_DAY = 0
const DAY_BEFORE = 1
const NETFLIX = 13_500
const PHONE_BILL = 55_000

/** 매달 day일 넷플릭스, 미리 알림 remindDays */
function okRule(day: number, remindDays: number | null, extra: Partial<Recurring> = {}): Recurring {
  return { id: 1, type: 'EXPENSE', amount: NETFLIX, category: '구독', memo: '넷플릭스', day, startDate: '2026-01-01', lastDate: null, remindDays, isActive: 1, createdAt: '', updatedAt: '', ...extra }
}

function okTx(date: string, memo: string, amount: number, extra: Partial<Transaction> = {}): Transaction {
  return { type: 'EXPENSE', amount, category: '구독', date, memo, createdAt: '', updatedAt: '', ...extra }
}

const at = (iso: string) => new Date(iso)
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('정기 지출 미리 알림', () => {
  it('알림을 안 켠 규칙은 알림이 하나도 없다', () => {
    const rule = okRule(15, NO_REMIND)

    const times = alarmTimesFor(rule, at('2026-11-10T08:00'))

    expect(times).toEqual([])
  })

  it('매달 15일 · 하루 전이면 14일 아침 9시에 울린다', () => {
    const rule = okRule(15, DAY_BEFORE)

    const first = alarmTimesFor(rule, at('2026-11-10T08:00'))[0]

    expect(first.due).toBe('2026-11-15')
    expect(first.at.getHours()).toBe(9)
    expect(dayKey(first.at)).toBe('2026-11-14')
  })

  it.each([
    ['9시 1분 전이면 오늘 알림이 아직 남아 있고', '2026-11-15T08:59', '2026-11-15'],
    ['9시가 지나면 다음 달 것부터', '2026-11-15T09:01', '2026-12-15'],
  ])('당일 알림: %s', (_case, now, firstDue) => {
    const rule = okRule(15, SAME_DAY)

    const next = upcomingRecurringAlarms([rule], at(now))[0]

    expect(next.due).toBe(firstDue)
  })

  it('이미 가계부에 기록된 결제일은 알리지 않는다', () => {
    const rule = okRule(15, SAME_DAY, { lastDate: '2026-11-15' })

    const next = upcomingRecurringAlarms([rule], at('2026-11-15T08:00'))[0]

    expect(next.due).toBe('2026-12-15')
  })

  it('앱을 9시 넘어 열면 오늘 지난 알림을 한 번 알려 준다', () => {
    const rule = okRule(16, DAY_BEFORE)

    const missed = missedTodayRecurring([rule], at('2026-11-15T13:00'))

    expect(missed.map((m) => m.due)).toEqual(['2026-11-16'])
  })

  it('하루 전 알림 제목은 "내일 … 결제일이에요" 다', () => {
    const rule = okRule(15, DAY_BEFORE)

    expect(recurringAlarmTitle(rule)).toBe('💳 내일 넷플릭스 결제일이에요')
  })
})

describe('고정 지출 요약', () => {
  it('11/10 기준 5일 통신비는 나갔고 15일 넷플릭스만 남았다', () => {
    const rules = [okRule(15, NO_REMIND), okRule(5, NO_REMIND, { id: 2, memo: '통신비', amount: PHONE_BILL, lastDate: '2026-11-05' })]

    const summary = fixedSummary(rules, '2026-11-10')

    expect(summary.monthly).toBe(NETFLIX + PHONE_BILL)
    expect(summary.yearly).toBe((NETFLIX + PHONE_BILL) * 12)
    expect([summary.leftCount, summary.leftAmount]).toEqual([1, NETFLIX])
  })

  it('수입 · 저축 · 멈춘 것은 고정 지출 합에 넣지 않는다', () => {
    const rules = [okRule(25, NO_REMIND, { type: 'INCOME', amount: 3_000_000 }), okRule(1, NO_REMIND, { category: '저축' }), okRule(3, NO_REMIND, { isActive: 0 })]

    const summary = fixedSummary(rules, '2026-11-10')

    expect(summary.monthly).toBe(0)
  })
})

describe('매달 나가는 지출 찾기', () => {
  const TODAY = '2026-11-27'

  it('두 달 연속 같은 금액 · 비슷한 날이면 정기로 권한다', () => {
    const items = [okTx('2026-10-14', '넷플릭스', NETFLIX), okTx('2026-11-15', '넷플릭스', NETFLIX)]

    const guesses = guessRecurring(items, [], TODAY)

    expect(guesses).toMatchObject([{ memo: '넷플릭스', amount: NETFLIX, day: 15, lastDate: '2026-11-15', months: 2 }])
  })

  it.each([
    ['금액이 다르면', okTx('2026-10-15', '넷플릭스', 17_000)],
    ['날짜가 4일 넘게 다르면', okTx('2026-10-20', '넷플릭스', NETFLIX)],
  ])('%s 권하지 않는다', (_case, older) => {
    const items = [older, okTx('2026-11-15', '넷플릭스', NETFLIX)]

    expect(guessRecurring(items, [], TODAY)).toEqual([])
  })

  it.each([
    ['이미 정기 내역에 있는 곳', [{ memo: '넷플릭스' }], []],
    ['"아니에요"로 숨긴 곳', [], ['넷플릭스']],
  ])('%s은 권하지 않는다', (_case, rules, hidden) => {
    const items = [okTx('2026-10-15', '넷플릭스', NETFLIX), okTx('2026-11-15', '넷플릭스', NETFLIX)]

    expect(guessRecurring(items, rules, TODAY, hidden)).toEqual([])
  })

  it('두 달 전에 끊긴 구독은 권하지 않는다', () => {
    const items = [okTx('2026-08-15', '왓챠', NETFLIX), okTx('2026-09-15', '왓챠', NETFLIX)]

    expect(guessRecurring(items, [], TODAY)).toEqual([])
  })
})

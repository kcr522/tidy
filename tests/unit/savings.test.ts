import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { SavingsPlan } from '../../src/db/types'
import { sanitizeInput } from '../../src/lib/ai/savingsPrompt'
import { scheduledStreak } from '../../src/lib/habits'
import { depositDates, isDueOn, maturity, nextAlarm, progressOf, scheduleLabel } from '../../src/lib/savings'
import { parseSavingsText } from '../../src/lib/savingsText'
import { createHabitRepo } from '../../src/repositories/habitRepo'
import { createSavingsRepo, type SavingsInput } from '../../src/repositories/savingsRepo'

const monthly = {
  amount: 100_000,
  rate: 3.5,
  interestType: 'simple' as const,
  taxType: 'normal' as const,
  schedule: { freq: 'monthly' as const, day: 10 },
  startDate: '2026-11-10',
  endDate: '2027-11-10',
}

describe('적금 넣는 날', () => {
  it('매달 10일, 1년이면 12번 (만기일은 안 넣는다)', () => {
    const d = depositDates(monthly)
    expect(d.length).toBe(12)
    expect(d[0]).toBe('2026-11-10')
    expect(d.at(-1)).toBe('2027-10-10')
  })
  it('매달 31일은 짧은 달엔 말일', () => {
    expect(isDueOn({ freq: 'monthly', day: 31 }, '2027-02-28')).toBe(true)
    expect(isDueOn({ freq: 'monthly', day: 31 }, '2026-11-30')).toBe(true)
  })
  it('매주 월요일, 26주 적금은 26번', () => {
    const plan = { schedule: { freq: 'weekly' as const, weekday: 2 }, startDate: '2026-11-10', endDate: '2027-05-11' }
    expect(depositDates(plan).length).toBe(26)
  })
  it('이름표', () => {
    expect(scheduleLabel({ freq: 'weekly', weekday: 1 })).toBe('매주 월요일')
    expect(scheduleLabel({ freq: 'monthly', day: 31 })).toBe('매달 말일')
  })
})

describe('만기 금액', () => {
  it('월 10만원 12개월 연 3.5% 단리: 이자 22,750원, 세금 15.4%', () => {
    const m = maturity(monthly)
    expect(m.principal).toBe(1_200_000)
    // 10만 × 3.5% × (12+11+…+1)/12 = 22,750
    expect(m.interest).toBe(22_750)
    expect(m.tax).toBe(3_500)
    expect(m.netTotal).toBe(1_219_250)
    expect(m.grossTotal).toBe(1_222_750)
  })
  it('비과세면 세금 0, 세금우대는 9.5%', () => {
    expect(maturity({ ...monthly, taxType: 'free' }).netTotal).toBe(1_222_750)
    expect(maturity({ ...monthly, taxType: 'preferential' }).tax).toBe(2_160)
  })
  it('월복리는 단리보다 조금 더 받는다', () => {
    const c = maturity({ ...monthly, interestType: 'compound' })
    expect(c.interest).toBeGreaterThan(22_750)
    expect(c.interest).toBeLessThan(23_500)
  })
  it('지금까지 넣은 돈과 D-day', () => {
    const p = progressOf(monthly, '2027-01-15')
    expect(p.done).toBe(3)
    expect(p.saved).toBe(300_000)
    expect(p.next).toBe('2027-02-10')
  })
})

describe('알림 시각', () => {
  const plan = { ...monthly, alarmTime: '09:00' }
  it('오늘 넣는 날이고 시간 전이면 오늘', () => {
    expect(nextAlarm(plan, new Date(2026, 10, 10, 8, 0))).toEqual(new Date(2026, 10, 10, 9, 0))
  })
  it('시간이 지났으면 다음 달', () => {
    expect(nextAlarm(plan, new Date(2026, 10, 10, 9, 30))).toEqual(new Date(2026, 11, 10, 9, 0))
  })
  it('만기 뒤에는 없다', () => {
    expect(nextAlarm(plan, new Date(2027, 10, 11))).toBeNull()
  })
})

describe('붙여 넣은 글 읽기 (AI 없이)', () => {
  it('은행 앱 설명에서 칸을 찾는다', () => {
    const d = parseSavingsText('카카오뱅크 자유적금\n가입기간 12개월\n매월 25일 30만원 자동이체\n기본 연 3.0% + 우대 0.5% 최고 연 3.5%\n단리 · 일반과세', '2026-11-10')
    expect(d.bank).toBe('카카오뱅크')
    expect(d.rate).toBe(3.5)
    expect(d.amount).toBe(300_000)
    expect(d.freq).toBe('monthly')
    expect(d.day).toBe(25)
    expect(d.interestType).toBe('simple')
    expect(d.taxType).toBe('normal')
    expect(d.endDate).toBe('2027-11-10')
  })
  it('가입일과 만기일, 비과세, 복리', () => {
    const d = parseSavingsText('가입일 2026.03.02 만기일 2028.03.02 월 50만원 연 4.5% 월복리 비과세', '2026-11-10')
    expect(d.startDate).toBe('2026-03-02')
    expect(d.endDate).toBe('2028-03-02')
    expect(d.taxType).toBe('free')
    expect(d.interestType).toBe('compound')
    expect(d.amount).toBe(500_000)
  })
  it('서버는 이상한 요청을 거른다', () => {
    expect(sanitizeInput({ today: 'x', text: 'a' })).toBeNull()
    expect(sanitizeInput({ today: '2026-11-10' })).toBeNull()
    expect(sanitizeInput({ today: '2026-11-10', text: '월 10만원' })?.text).toBe('월 10만원')
  })
})

describe('적금 저장 + 습관 + 자동 기록', () => {
  let db: TidyDB
  afterEach(async () => db?.delete())
  const input: SavingsInput = { ...monthly, name: '청년', autoDeposit: 1, alarmOn: 1, alarmTime: '09:00', memo: '' }

  it('적금을 만들면 습관도 생기고, 자동이체는 넣는 날 가계부에 한 번만 기록된다', async () => {
    db = new TidyDB('savings-1')
    const repo = createSavingsRepo(db)
    const id = await repo.add({ ...input, startDate: '2026-09-10', endDate: '2027-09-10' })
    const plan = (await repo.get(id)) as SavingsPlan
    const habit = await db.habits.get(plan.habitId!)
    expect(habit?.title).toBe('청년 적금 넣기')
    expect(habit?.schedule).toEqual({ freq: 'monthly', day: 10 })

    expect(await repo.runDue('2026-11-10')).toBe(3)
    expect(await repo.runDue('2026-11-10')).toBe(0)
    const rows = await db.transactions.where('savingsId').equals(id).toArray()
    expect(rows.map((r) => r.date)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10'])
    expect(rows[0]).toMatchObject({ type: 'EXPENSE', category: '저축', amount: 100_000, memo: '청년 적금' })
    expect(await db.habitChecks.where('habitId').equals(plan.habitId!).count()).toBe(3)
  })

  it('직접 넣는 적금은 습관을 체크하면 기록되고, 풀면 지워진다', async () => {
    db = new TidyDB('savings-2')
    const repo = createSavingsRepo(db)
    const habits = createHabitRepo(db)
    const id = await repo.add({ ...input, autoDeposit: 0 })
    expect(await repo.runDue('2026-11-10')).toBe(0)
    const { habitId } = (await repo.get(id))!
    await habits.toggle(habitId!, '2026-11-10')
    expect(await db.transactions.where('savingsId').equals(id).count()).toBe(1)
    await habits.toggle(habitId!, '2026-11-10')
    expect(await db.transactions.where('savingsId').equals(id).count()).toBe(0)
  })

  it('적금을 지우면 습관도 지워지고 납입 내역은 남는다', async () => {
    db = new TidyDB('savings-3')
    const repo = createSavingsRepo(db)
    const id = await repo.add(input)
    await repo.runDue('2026-11-10')
    await repo.remove(id)
    expect(await db.habits.count()).toBe(0)
    expect(await db.transactions.count()).toBe(1)
  })
})

describe('적금 습관 연속 기록', () => {
  it('넣는 날만 센다', () => {
    const s = { freq: 'monthly' as const, day: 10 }
    expect(scheduledStreak(new Set(['2026-09-10', '2026-10-10']), '2026-11-05', s)).toBe(2)
    // 오늘이 넣는 날인데 아직 안 했어도 끊기지 않는다
    expect(scheduledStreak(new Set(['2026-09-10', '2026-10-10']), '2026-11-10', s)).toBe(2)
    expect(scheduledStreak(new Set(['2026-09-10']), '2026-11-05', s)).toBe(0)
  })
})

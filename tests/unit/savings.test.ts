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

const MONTHLY_AMOUNT = 100_000
const TODAY = '2026-11-10'
const AUTO_ON = 1 as const
const AUTO_OFF = 0 as const

/** 매달 10일 10만원, 1년, 연 3.5% 단리, 일반과세 — 은행 앱에서 흔한 적금 */
const okMonthly = {
  amount: MONTHLY_AMOUNT,
  rate: 3.5,
  interestType: 'simple' as const,
  taxType: 'normal' as const,
  schedule: { freq: 'monthly' as const, day: 10 },
  startDate: '2026-11-10',
  endDate: '2027-11-10',
}

describe('적금 넣는 날', () => {
  it('매달 10일 1년 적금은 12번 넣고, 만기일에는 넣지 않는다', () => {
    const dates = depositDates(okMonthly)

    expect(dates).toHaveLength(12)
    expect(dates[0]).toBe('2026-11-10')
    expect(dates.at(-1)).toBe('2027-10-10')
  })

  it.each([
    ['2월', '2027-02-28'],
    ['11월', '2026-11-30'],
  ])('매달 31일 적금은 짧은 달(%s)에는 말일 %s 에 넣는다', (_month, lastDay) => {
    expect(isDueOn({ freq: 'monthly', day: 31 }, lastDay)).toBe(true)
  })

  it('매주 월요일 26주 적금은 26번 넣는다', () => {
    const MONDAY = 2
    const plan = { schedule: { freq: 'weekly' as const, weekday: MONDAY }, startDate: '2026-11-10', endDate: '2027-05-11' }

    expect(depositDates(plan)).toHaveLength(26)
  })

  it.each([
    [{ freq: 'weekly' as const, weekday: 1 }, '매주 월요일'],
    [{ freq: 'monthly' as const, day: 31 }, '매달 말일'],
  ])('넣는 날 %j 은 "%s" 라고 보여 준다', (schedule, label) => {
    expect(scheduleLabel(schedule)).toBe(label)
  })
})

describe('만기 금액', () => {
  it('월 10만원 12개월 연 3.5% 단리면 이자 22,750원에서 세금 15.4%를 뗀다', () => {
    const result = maturity(okMonthly)

    expect(result.principal).toBe(1_200_000)
    // 10만 × 3.5% × (12+11+…+1)/12 = 22,750
    expect(result.interest).toBe(22_750)
    // 22,750 × 15.4% (일반과세), 원 단위 아래 버림
    expect(result.tax).toBe(3_500)
    expect(result.netTotal).toBe(1_219_250)
    expect(result.grossTotal).toBe(1_222_750)
  })

  it('비과세면 세금 없이 원금 + 이자를 다 받는다', () => {
    expect(maturity({ ...okMonthly, taxType: 'free' }).netTotal).toBe(1_222_750)
  })

  it('세금우대면 9.5%만 뗀다', () => {
    // 22,750 × 9.5%
    expect(maturity({ ...okMonthly, taxType: 'preferential' }).tax).toBe(2_160)
  })

  it('월복리는 같은 조건 단리보다 조금 더 받는다', () => {
    const SIMPLE_INTEREST = 22_750

    const compound = maturity({ ...okMonthly, interestType: 'compound' })

    expect(compound.interest).toBeGreaterThan(SIMPLE_INTEREST)
    expect(compound.interest).toBeLessThan(23_500)
  })

  it('중간에 보면 지금까지 넣은 횟수 · 금액과 다음 넣는 날을 알려 준다', () => {
    const progress = progressOf(okMonthly, '2027-01-15')

    expect(progress.done).toBe(3)
    expect(progress.saved).toBe(3 * MONTHLY_AMOUNT)
    expect(progress.next).toBe('2027-02-10')
  })
})

describe('적금 알림 시각', () => {
  const plan = { ...okMonthly, alarmTime: '09:00' }

  it.each([
    ['넣는 날 알림 시각 전이면 오늘 9시', new Date(2026, 10, 10, 8, 0), new Date(2026, 10, 10, 9, 0)],
    ['넣는 날 알림 시각이 지났으면 다음 달 9시', new Date(2026, 10, 10, 9, 30), new Date(2026, 11, 10, 9, 0)],
    ['만기 뒤에는 알림이 없다', new Date(2027, 10, 11), null],
  ])('%s', (_case, now, alarm) => {
    expect(nextAlarm(plan, now)).toEqual(alarm)
  })
})

describe('붙여 넣은 적금 설명 읽기 (AI 없이)', () => {
  it('은행 앱 설명에서 은행 · 금리 · 금액 · 넣는 날 · 이자 · 세금 · 만기를 찾는다', () => {
    const bankText = '카카오뱅크 자유적금\n가입기간 12개월\n매월 25일 30만원 자동이체\n기본 연 3.0% + 우대 0.5% 최고 연 3.5%\n단리 · 일반과세'

    const draft = parseSavingsText(bankText, TODAY)

    expect(draft).toMatchObject({ bank: '카카오뱅크', rate: 3.5, amount: 300_000, freq: 'monthly', day: 25, interestType: 'simple', taxType: 'normal' })
    // 가입기간 12개월 → 오늘부터 1년 뒤
    expect(draft.endDate).toBe('2027-11-10')
  })

  it('가입일 · 만기일이 적혀 있으면 그 날짜를, 비과세 · 월복리도 읽는다', () => {
    const bankText = '가입일 2026.03.02 만기일 2028.03.02 월 50만원 연 4.5% 월복리 비과세'

    const draft = parseSavingsText(bankText, TODAY)

    expect(draft).toMatchObject({ startDate: '2026-03-02', endDate: '2028-03-02', taxType: 'free', interestType: 'compound', amount: 500_000 })
  })

  it.each([
    ['오늘 날짜가 날짜 모양이 아니면', { today: 'x', text: 'a' }],
    ['글이 없으면', { today: TODAY }],
  ])('서버는 %s 요청을 거른다', (_case, body) => {
    expect(sanitizeInput(body)).toBeNull()
  })

  it('서버는 올바른 요청의 글을 그대로 넘긴다', () => {
    expect(sanitizeInput({ today: TODAY, text: '월 10만원' })?.text).toBe('월 10만원')
  })
})

describe('적금 저장 + 습관 + 가계부 자동 기록', () => {
  let db: TidyDB
  afterEach(async () => db?.delete())
  const okInput: SavingsInput = { ...okMonthly, name: '청년', autoDeposit: AUTO_ON, alarmOn: 1, alarmTime: '09:00', memo: '' }

  it('적금을 만들면 "○○ 적금 넣기" 습관이 같은 넣는 날로 생긴다', async () => {
    db = new TidyDB('savings-habit')
    const repo = createSavingsRepo(db)

    const id = await repo.add(okInput)

    const plan = (await repo.get(id)) as SavingsPlan
    const habit = await db.habits.get(plan.habitId!)
    expect(habit?.title).toBe('청년 적금 넣기')
    expect(habit?.schedule).toEqual({ freq: 'monthly', day: 10 })
  })

  it('자동이체 적금은 지난 넣는 날마다 가계부 저축 · 습관 체크를 한 번씩만 남긴다', async () => {
    db = new TidyDB('savings-1')
    const repo = createSavingsRepo(db)
    const id = await repo.add({ ...okInput, startDate: '2026-09-10', endDate: '2027-09-10' })
    const { habitId } = (await repo.get(id))!

    const firstRun = await repo.runDue(TODAY)
    const secondRun = await repo.runDue(TODAY)

    // 9 · 10 · 11월 10일 세 번
    expect([firstRun, secondRun]).toEqual([3, 0])
    const rows = await db.transactions.where('savingsId').equals(id).toArray()
    expect(rows.map((row) => row.date)).toEqual(['2026-09-10', '2026-10-10', '2026-11-10'])
    expect(rows[0]).toMatchObject({ type: 'EXPENSE', category: '저축', amount: MONTHLY_AMOUNT, memo: '청년 적금' })
    expect(await db.habitChecks.where('habitId').equals(habitId!).count()).toBe(3)
  })

  it('직접 넣는 적금은 자동으로 기록하지 않고, 습관을 체크하면 기록되고 풀면 지워진다', async () => {
    db = new TidyDB('savings-2')
    const repo = createSavingsRepo(db)
    const habits = createHabitRepo(db)
    const id = await repo.add({ ...okInput, autoDeposit: AUTO_OFF })
    const { habitId } = (await repo.get(id))!
    const countRows = () => db.transactions.where('savingsId').equals(id).count()

    expect(await repo.runDue(TODAY)).toBe(0)
    await habits.toggle(habitId!, TODAY)
    expect(await countRows()).toBe(1)
    await habits.toggle(habitId!, TODAY)
    expect(await countRows()).toBe(0)
  })

  it('자유 저축으로 적힌 돈을 적금에 넣으면 납입으로 세고 습관도 체크하며, 메모 · 결제 수단은 그대로다', async () => {
    db = new TidyDB('savings-link')
    const repo = createSavingsRepo(db)
    const id = await repo.add({ ...okInput, autoDeposit: AUTO_OFF })
    const { habitId } = (await repo.get(id))!
    const now = '2026-11-24T00:00:00.000Z'
    const txId = await db.transactions.add({ type: 'EXPENSE', amount: 200_000, category: '저축', date: '2026-11-24', memo: '김채림', account: '신한카드', createdAt: now, updatedAt: now })
    expect(await repo.depositedTotal(id)).toEqual({ count: 0, amount: 0 })

    await repo.link(txId, id)

    expect(await repo.depositedTotal(id)).toEqual({ count: 1, amount: 200_000 })
    expect(await db.habitChecks.get([habitId!, '2026-11-24'])).toBeTruthy()
    expect(await db.transactions.get(txId)).toMatchObject({ memo: '김채림', account: '신한카드', savingsId: id })
  })

  it('적금에 넣은 돈을 다시 자유 저축으로 되돌리면 납입에서 빠지고 저축 칸에 남는다', async () => {
    db = new TidyDB('savings-unlink')
    const repo = createSavingsRepo(db)
    const id = await repo.add({ ...okInput, autoDeposit: AUTO_OFF })
    const now = '2026-11-24T00:00:00.000Z'
    const txId = await db.transactions.add({ type: 'EXPENSE', amount: 200_000, category: '저축', date: '2026-11-24', memo: '', createdAt: now, updatedAt: now })
    await repo.link(txId, id)

    await repo.link(txId, null)

    expect(await repo.depositedTotal(id)).toEqual({ count: 0, amount: 0 })
    const back = await db.transactions.get(txId)
    expect(back?.savingsId).toBeUndefined()
    expect(back?.category).toBe('저축')
  })

  it('적금을 지우면 습관도 지워지지만 이미 넣은 납입 내역은 남는다', async () => {
    db = new TidyDB('savings-3')
    const repo = createSavingsRepo(db)
    const id = await repo.add(okInput)
    await repo.runDue(TODAY)

    await repo.remove(id)

    expect(await db.habits.count()).toBe(0)
    expect(await db.transactions.count()).toBe(1)
  })
})

describe('적금 습관 연속 기록', () => {
  const tenth = { freq: 'monthly' as const, day: 10 }

  it.each([
    ['9 · 10월에 넣었고 오늘이 넣는 날이 아니면', ['2026-09-10', '2026-10-10'], '2026-11-05', 2],
    // 오늘이 넣는 날인데 아직 안 했어도 끊기지 않는다
    ['9 · 10월에 넣었고 오늘이 넣는 날인데 아직 안 넣었으면', ['2026-09-10', '2026-10-10'], '2026-11-10', 2],
    ['10월을 빠뜨렸으면', ['2026-09-10'], '2026-11-05', 0],
  ])('넣는 날만 센다: %s 연속 %i번', (_case, checked, today, streak) => {
    expect(scheduledStreak(new Set(checked), today, tenth)).toBe(streak)
  })
})

describe('적금 AI 답 읽기 (Gemini)', () => {
  it('답 글에 섞인 JSON 을 꺼내고 빈 칸(null)은 뺀다', async () => {
    const { draftFromText } = await import('../../src/lib/ai/savingsPrompt')
    const answer = '```json\n{"name":"청년적금","amount":300000,"rate":4.5,"freq":"monthly","day":null}\n```'

    expect(draftFromText(answer)).toEqual({ name: '청년적금', amount: 300000, rate: 4.5, freq: 'monthly' })
  })

  it('답에 JSON 이 없으면 읽지 못했다고 알린다', async () => {
    const { draftFromText } = await import('../../src/lib/ai/savingsPrompt')

    expect(() => draftFromText('모르겠어요')).toThrow('읽지 못했어요')
  })

  it('AI 에게 보내는 글에 사용자가 붙여 넣은 글이 들어간다', async () => {
    const { savingsPrompt } = await import('../../src/lib/ai/savingsPrompt')

    expect(savingsPrompt({ today: '2026-11-13', text: '월 30만원' })).toContain('월 30만원')
  })
})

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { ddayFor, ddayLabel, dueDateIn, nextAndPrev, pendingDates } from '../../src/lib/recurring'
import { createBackupRepo, parseBackup } from '../../src/repositories/backupRepo'
import { createRecurringRepo } from '../../src/repositories/recurringRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const rule = (day: number, startDate: string, lastDate: string | null = null) => ({ day, startDate, lastDate, isActive: 1 as const })
const NEVER_RECORDED = null

describe('정기 내역 날짜 계산', () => {
  it.each([
    [2026, 2, '2026-02-28'],
    [2026, 11, '2026-11-30'],
    [2026, 12, '2026-12-31'],
  ])('31일 규칙은 %i년 %i월에 %s 이다 (짧은 달은 말일)', (year, month, date) => {
    expect(dueDateIn(year, month, 31)).toBe(date)
  })

  it.each([
    ['시작일 전 날짜(11/5)는 빼고', rule(5, '2026-11-10'), '2026-11-10', []],
    ['오늘 전날까지는 아직 아니고', rule(25, '2026-11-10'), '2026-11-24', []],
    ['딱 그날이 되면 넣고', rule(25, '2026-11-10'), '2026-11-25', ['2026-11-25']],
    ['밀린 달은 모두 넣고', rule(5, '2026-09-01'), '2026-11-10', ['2026-09-05', '2026-10-05', '2026-11-05']],
    ['이미 기록한 날까지는 빼고', rule(5, '2026-09-01', '2026-10-05'), '2026-11-10', ['2026-11-05']],
    ['멈춘 규칙은 하나도 넣지 않는다', { ...rule(5, '2026-09-01', NEVER_RECORDED), isActive: 0 as const }, '2026-11-10', []],
  ])('기록할 날짜: %s', (_case, recurring, today, dates) => {
    expect(pendingDates(recurring, today)).toEqual(dates)
  })

  it.each([
    [25, { next: '2026-11-25', prev: '2026-10-25' }],
    [5, { next: '2026-12-05', prev: '2026-11-05' }],
  ])('11/10 기준 매달 %i일의 다음 · 지난 날짜를 준다', (day, dates) => {
    expect(nextAndPrev(day, '2026-11-10')).toEqual(dates)
  })

  it('11/10 기준 25일은 15일 남았고, 지난 25일부터 31일 중 16일이 지나 52% 다', () => {
    const dday = ddayFor(25, '2026-11-10')

    expect(dday.daysLeft).toBe(15)
    expect(ddayLabel(dday.daysLeft)).toBe('D-15')
    expect(dday.progress).toBe(52) // 16 ÷ 31
  })

  it('오늘이 그날이면 0일 남았고 막대는 100% 이며 D-DAY 로 보여 준다', () => {
    expect(ddayFor(10, '2026-11-10')).toEqual({ date: '2026-11-10', daysLeft: 0, progress: 100 })
    expect(ddayLabel(0)).toBe('D-DAY')
  })
})

describe('recurringRepo', () => {
  const netflix = { type: 'EXPENSE' as const, amount: 17000, category: '문화/여가', memo: '넷플릭스', account: '신한카드', day: 5, startDate: '2026-10-01' }
  const salary = { type: 'INCOME' as const, amount: 2500000, category: '월급', memo: '월급', day: 25, startDate: '2026-11-10' }

  it('밀린 정기 내역을 결제 수단 · 규칙 id 와 함께 한 번만 기록한다', async () => {
    db = new TidyDB('rec-1')
    const repo = createRecurringRepo(db)
    const id = await repo.add(netflix)
    await repo.add(salary)

    expect(await repo.runDue('2026-11-10')).toBe(2)
    expect(await repo.runDue('2026-11-10')).toBe(0)

    const rows = await db.transactions.toArray()
    expect(rows.map((row) => row.date)).toEqual(['2026-10-05', '2026-11-05'])
    expect(rows[0]).toMatchObject({ memo: '넷플릭스', account: '신한카드', recurringId: id })
  })

  it('멈춘 규칙은 기록하지 않고, 규칙을 지워도 기록된 내역은 남는다', async () => {
    db = new TidyDB('rec-1b')
    const repo = createRecurringRepo(db)
    const id = await repo.add(netflix)
    await repo.add(salary)
    await repo.runDue('2026-11-25') // 넷플릭스 2번 + 월급 1번

    await repo.setActive(id, false)
    expect(await repo.runDue('2026-12-31')).toBe(1) // 월급만

    await repo.remove(id)
    expect(await db.transactions.count()).toBe(4)
  })

  const changingSalary = { type: 'INCOME' as const, amount: 0, askAmount: 1 as const, category: '월급', memo: '월급', account: '토스뱅크', day: 10, startDate: '2026-10-01' }
  const SKIP = null

  it('금액이 일정하지 않은 월급은 자동으로 적지 않고 밀린 날마다 물어본다', async () => {
    db = new TidyDB('rec-3')
    const repo = createRecurringRepo(db)
    await repo.add(changingSalary)

    expect(await repo.runDue('2026-11-14')).toBe(0)
    expect((await repo.dueAsks('2026-11-14')).map((ask) => ask.date)).toEqual(['2026-10-10', '2026-11-10'])
  })

  it('물어본 날에 안 받음이면 적지 않고, 금액을 넣으면 한 번만 적는다', async () => {
    db = new TidyDB('rec-3b')
    const repo = createRecurringRepo(db)
    const id = await repo.add(changingSalary)

    expect(await repo.recordAsked(id, '2026-10-10', SKIP)).toBe(false)
    expect(await repo.recordAsked(id, '2026-11-10', 2310000)).toBe(true)
    expect(await repo.recordAsked(id, '2026-11-10', 2310000)).toBe(false)

    expect(await repo.dueAsks('2026-11-14')).toEqual([])
    const rows = await db.transactions.toArray()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'INCOME', amount: 2310000, date: '2026-11-10', memo: '월급', account: '토스뱅크', recurringId: id })
  })

  it('다음 달 그날이 되면 다시 물어보고, 정해진 금액으로 바꾸면 그다음부터 자동으로 적는다', async () => {
    db = new TidyDB('rec-3c')
    const repo = createRecurringRepo(db)
    const id = await repo.add({ ...changingSalary, startDate: '2026-12-01' })
    expect((await repo.dueAsks('2026-12-10')).map((ask) => ask.date)).toEqual(['2026-12-10'])

    await repo.update(id, { type: 'INCOME', amount: 2500000, askAmount: 0, category: '월급', memo: '월급', day: 10, startDate: '2026-12-01' })

    expect(await repo.dueAsks('2026-12-10')).toEqual([])
    expect(await repo.runDue('2026-12-10')).toBe(1)
  })

  it('정기 내역 규칙은 백업에 들어간다', async () => {
    db = new TidyDB('rec-2')
    await createRecurringRepo(db).add({ type: 'EXPENSE', amount: 55000, category: '주거/통신', memo: 'SKT', day: 20, startDate: '2026-11-10' })

    const backup = await createBackupRepo(db, '0.1.0').exportAll()

    expect(backup.recurring).toHaveLength(1)
  })

  it('정기 내역이 없던 예전(스키마 1) 백업도 읽고, 가져오면 규칙은 0개다', async () => {
    db = new TidyDB('rec-2b')
    await createRecurringRepo(db).add({ type: 'EXPENSE', amount: 55000, category: '주거/통신', memo: 'SKT', day: 20, startDate: '2026-11-10' })
    const oldBackup = JSON.stringify({ app: 'tidy', appVersion: '0.1.0', schemaVersion: 1, exportedAt: '', transactions: [], todos: [], bookmarks: [] })

    await createBackupRepo(db).importAll(oldBackup)

    expect(parseBackup(oldBackup, 2).recurring).toBeUndefined()
    expect(await db.recurring.count()).toBe(0)
  })
})

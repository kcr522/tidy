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

describe('정기 내역 날짜 계산', () => {
  it('31일 규칙은 짧은 달엔 말일', () => {
    expect(dueDateIn(2026, 2, 31)).toBe('2026-02-28')
    expect(dueDateIn(2026, 11, 31)).toBe('2026-11-30')
    expect(dueDateIn(2026, 12, 31)).toBe('2026-12-31')
  })

  it('시작일 이후, 오늘까지, 아직 안 한 날짜만', () => {
    expect(pendingDates(rule(5, '2026-11-10'), '2026-11-10')).toEqual([])
    expect(pendingDates(rule(25, '2026-11-10'), '2026-11-24')).toEqual([])
    expect(pendingDates(rule(25, '2026-11-10'), '2026-11-25')).toEqual(['2026-11-25'])
    expect(pendingDates(rule(5, '2026-09-01'), '2026-11-10')).toEqual(['2026-09-05', '2026-10-05', '2026-11-05'])
    expect(pendingDates(rule(5, '2026-09-01', '2026-10-05'), '2026-11-10')).toEqual(['2026-11-05'])
    expect(pendingDates({ ...rule(5, '2026-09-01'), isActive: 0 }, '2026-11-10')).toEqual([])
  })

  it('D-day와 막대', () => {
    expect(nextAndPrev(25, '2026-11-10')).toEqual({ next: '2026-11-25', prev: '2026-10-25' })
    expect(nextAndPrev(5, '2026-11-10')).toEqual({ next: '2026-12-05', prev: '2026-11-05' })
    const d = ddayFor(25, '2026-11-10')
    expect(d.daysLeft).toBe(15)
    expect(ddayLabel(d.daysLeft)).toBe('D-15')
    expect(d.progress).toBe(52) // 16일 지남 / 31일
    expect(ddayFor(10, '2026-11-10')).toEqual({ date: '2026-11-10', daysLeft: 0, progress: 100 })
    expect(ddayLabel(0)).toBe('D-DAY')
  })
})

describe('recurringRepo', () => {
  it('밀린 정기 내역을 한 번만 기록한다', async () => {
    db = new TidyDB('rec-1')
    const repo = createRecurringRepo(db)
    const id = await repo.add({ type: 'EXPENSE', amount: 17000, category: '문화/여가', memo: '넷플릭스', account: '신한카드', day: 5, startDate: '2026-10-01' })
    await repo.add({ type: 'INCOME', amount: 2500000, category: '월급', memo: '월급', day: 25, startDate: '2026-11-10' })
    expect(await repo.runDue('2026-11-10')).toBe(2)
    expect(await repo.runDue('2026-11-10')).toBe(0)
    const tx = await db.transactions.toArray()
    expect(tx.map((t) => t.date)).toEqual(['2026-10-05', '2026-11-05'])
    expect(tx[0]).toMatchObject({ memo: '넷플릭스', account: '신한카드', recurringId: id })
    expect(await repo.runDue('2026-11-25')).toBe(1)
    // 멈추면 기록하지 않고, 규칙을 지워도 기록된 내역은 남는다
    await repo.setActive(id, false)
    expect(await repo.runDue('2026-12-31')).toBe(1)
    await repo.remove(id)
    expect(await db.transactions.count()).toBe(4)
  })

  it('백업에 규칙이 들어가고, 예전(스키마 1) 백업도 읽는다', async () => {
    db = new TidyDB('rec-2')
    await createRecurringRepo(db).add({ type: 'EXPENSE', amount: 55000, category: '주거/통신', memo: 'SKT', day: 20, startDate: '2026-11-10' })
    const backup = await createBackupRepo(db, '0.1.0').exportAll()
    expect(backup.recurring).toHaveLength(1)
    const old = JSON.stringify({ app: 'tidy', appVersion: '0.1.0', schemaVersion: 1, exportedAt: '', transactions: [], todos: [], bookmarks: [] })
    expect(parseBackup(old, 2).recurring).toBeUndefined()
    await createBackupRepo(db).importAll(old)
    expect(await db.recurring.count()).toBe(0)
  })
})

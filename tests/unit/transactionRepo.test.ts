import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createTransactionRepo, monthRange } from '../../src/repositories/transactionRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const base = { type: 'EXPENSE' as const, amount: 15000, category: '식비', memo: '점심' }

describe('monthRange', () => {
  it('해당 달 1일부터 다음 달 1일 전까지', () => {
    expect(monthRange(2026, 11)).toEqual(['2026-11-01', '2026-12-01'])
    expect(monthRange(2026, 12)).toEqual(['2026-12-01', '2027-01-01'])
  })
})

describe('transactionRepo', () => {
  it('추가, 수정, 삭제한다 (US1 시나리오 1, 4, 5)', async () => {
    db = new TidyDB('repo-test-1')
    const repo = createTransactionRepo(db)
    const id = await repo.add({ ...base, date: '2026-11-10' })
    expect((await repo.get(id))?.amount).toBe(15000)

    await repo.update(id, { ...base, date: '2026-11-10', amount: 12000 })
    const updated = await repo.get(id)
    expect(updated?.amount).toBe(12000)
    expect(updated?.createdAt).toBeDefined()

    await repo.remove(id)
    expect(await repo.get(id)).toBeUndefined()
  })

  it('선택한 달 내역만 최신 날짜 순으로 가져온다 (US1 시나리오 6)', async () => {
    db = new TidyDB('repo-test-2')
    const repo = createTransactionRepo(db)
    await repo.add({ ...base, date: '2026-10-31' })
    await repo.add({ ...base, date: '2026-11-01' })
    await repo.add({ ...base, date: '2026-11-30' })
    await repo.add({ ...base, date: '2026-12-01' })

    const nov = await repo.listByMonth(2026, 11)
    expect(nov.map((t) => t.date)).toEqual(['2026-11-30', '2026-11-01'])
    const oct = await repo.listByMonth(2026, 10)
    expect(oct.map((t) => t.date)).toEqual(['2026-10-31'])
  })
})

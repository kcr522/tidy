import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createTransactionRepo, monthRange } from '../../src/repositories/transactionRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

/** 정상 점심 지출 15,000원 */
const okLunch = { type: 'EXPENSE' as const, amount: 15_000, category: '식비', memo: '점심', date: '2026-11-10' }

describe('달 범위 (monthRange)', () => {
  it.each([
    [2026, 11, ['2026-11-01', '2026-12-01']],
    // 12월은 다음 해 1월 1일 전까지
    [2026, 12, ['2026-12-01', '2027-01-01']],
  ])('%i년 %i월은 1일부터 다음 달 1일 전까지 %j', (year, month, range) => {
    expect(monthRange(year, month)).toEqual(range)
  })
})

describe('transactionRepo', () => {
  it('내역을 더하면 그대로 읽을 수 있다 (US1 시나리오 1)', async () => {
    db = new TidyDB('repo-test-add')
    const repo = createTransactionRepo(db)

    const id = await repo.add(okLunch)

    expect((await repo.get(id))?.amount).toBe(okLunch.amount)
  })

  it('금액을 고치면 바뀌고 만든 시각은 남는다 (US1 시나리오 4)', async () => {
    db = new TidyDB('repo-test-1')
    const repo = createTransactionRepo(db)
    const id = await repo.add(okLunch)

    await repo.update(id, { ...okLunch, amount: 12_000 })

    const updated = await repo.get(id)
    expect(updated?.amount).toBe(12_000)
    expect(updated?.createdAt).toBeDefined()
  })

  it('지우면 없어진다 (US1 시나리오 5)', async () => {
    db = new TidyDB('repo-test-remove')
    const repo = createTransactionRepo(db)
    const id = await repo.add(okLunch)

    await repo.remove(id)

    expect(await repo.get(id)).toBeUndefined()
  })

  it('선택한 달의 첫날 · 말일 내역만 늦은 날짜 순으로 가져오고, 앞뒤 달 경계 날은 뺀다 (US1 시나리오 6)', async () => {
    db = new TidyDB('repo-test-2')
    const repo = createTransactionRepo(db)
    for (const date of ['2026-10-31', '2026-11-01', '2026-11-30', '2026-12-01']) await repo.add({ ...okLunch, date })

    const november = await repo.listByMonth(2026, 11)
    const october = await repo.listByMonth(2026, 10)

    expect(november.map((row) => row.date)).toEqual(['2026-11-30', '2026-11-01'])
    expect(october.map((row) => row.date)).toEqual(['2026-10-31'])
  })
})

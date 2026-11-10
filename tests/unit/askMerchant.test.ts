import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createMerchantAliasRepo } from '../../src/repositories/merchantAliasRepo'
import { createTransactionRepo } from '../../src/repositories/transactionRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const base = { type: 'EXPENSE' as const, amount: 12000, category: '쇼핑', date: '2026-11-10' }

describe('모르는 결제처 알려 주기', () => {
  it('기억하면 같은 이름의 예전 내역과 앞으로의 내역도 그 가게로', async () => {
    db = new TidyDB('ask-1')
    const repo = createTransactionRepo(db)
    const a = await repo.add({ ...base, memo: 'KCP*결제' })
    const b = await repo.add({ ...base, memo: 'KCP * 결제', date: '2026-11-03' })
    const other = await repo.add({ ...base, memo: 'NICE페이먼츠' })
    expect(await repo.resolveMerchant(a, '동네 꽃집', true)).toBe(2)
    expect(await repo.get(a)).toMatchObject({ memo: '동네 꽃집', originalMemo: 'KCP*결제' })
    expect((await repo.get(b))?.memo).toBe('동네 꽃집')
    expect((await repo.get(other))?.memo).toBe('NICE페이먼츠')
    const c = await repo.add({ ...base, memo: 'kcp*결제' })
    expect(await repo.get(c)).toMatchObject({ memo: '동네 꽃집', originalMemo: 'kcp*결제' })
    expect((await createMerchantAliasRepo(db).list()).map((x) => x.name)).toEqual(['동네 꽃집'])
  })

  it('기억하지 않으면 이 내역만', async () => {
    db = new TidyDB('ask-2')
    const repo = createTransactionRepo(db)
    const a = await repo.add({ ...base, memo: '토스페이먼츠' })
    const b = await repo.add({ ...base, memo: '토스페이먼츠' })
    expect(await repo.resolveMerchant(a, '무신사', false)).toBe(1)
    expect((await repo.get(b))?.memo).toBe('토스페이먼츠')
    expect(await createMerchantAliasRepo(db).list()).toEqual([])
  })

  it('백업에 알려 준 이름이 들어간다', async () => {
    db = new TidyDB('ask-3')
    const repo = createTransactionRepo(db)
    await repo.resolveMerchant(await repo.add({ ...base, memo: 'KCP*결제' }), '꽃집', true)
    const backup = await createBackupRepo(db, '0.1.0').exportAll()
    expect(backup.schemaVersion).toBe(3)
    expect(backup.merchantAliases).toHaveLength(1)
    const db2 = new TidyDB('ask-3b')
    await createBackupRepo(db2).importAll(JSON.stringify(backup))
    expect((await createMerchantAliasRepo(db2).find('KCP*결제'))?.name).toBe('꽃집')
    await db2.delete()
  })
})

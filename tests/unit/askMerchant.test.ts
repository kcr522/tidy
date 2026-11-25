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

const okExpense = { type: 'EXPENSE' as const, amount: 12000, category: '쇼핑', date: '2026-11-10' }
const REMEMBER = true
const THIS_ONLY = false

describe('모르는 결제처 알려 주기', () => {
  it('기억하면 같은 이름(띄어쓰기 달라도)의 예전 내역도 그 가게로 바뀐다', async () => {
    db = new TidyDB('ask-1')
    const repo = createTransactionRepo(db)
    const picked = await repo.add({ ...okExpense, memo: 'KCP*결제' })
    const spaced = await repo.add({ ...okExpense, memo: 'KCP * 결제', date: '2026-11-03' })
    const other = await repo.add({ ...okExpense, memo: 'NICE페이먼츠' })

    const changed = await repo.resolveMerchant(picked, '동네 꽃집', REMEMBER)

    expect(changed).toBe(2)
    expect(await repo.get(picked)).toMatchObject({ memo: '동네 꽃집', originalMemo: 'KCP*결제' })
    expect((await repo.get(spaced))?.memo).toBe('동네 꽃집')
    expect((await repo.get(other))?.memo).toBe('NICE페이먼츠')
  })

  it('기억하면 앞으로 들어오는 같은 이름(대소문자 달라도)도 그 가게로 들어간다', async () => {
    db = new TidyDB('ask-1b')
    const repo = createTransactionRepo(db)
    await repo.resolveMerchant(await repo.add({ ...okExpense, memo: 'KCP*결제' }), '동네 꽃집', REMEMBER)

    const later = await repo.add({ ...okExpense, memo: 'kcp*결제' })

    expect(await repo.get(later)).toMatchObject({ memo: '동네 꽃집', originalMemo: 'kcp*결제' })
    expect((await createMerchantAliasRepo(db).list()).map((alias) => alias.name)).toEqual(['동네 꽃집'])
  })

  it('기억하지 않으면 고른 내역 하나만 바뀌고 기억한 이름도 없다', async () => {
    db = new TidyDB('ask-2')
    const repo = createTransactionRepo(db)
    const picked = await repo.add({ ...okExpense, memo: '토스페이먼츠' })
    const same = await repo.add({ ...okExpense, memo: '토스페이먼츠' })

    const changed = await repo.resolveMerchant(picked, '무신사', THIS_ONLY)

    expect(changed).toBe(1)
    expect((await repo.get(same))?.memo).toBe('토스페이먼츠')
    expect(await createMerchantAliasRepo(db).list()).toEqual([])
  })

  it('알려 준 이름은 백업에 들어가고 다른 기기로 가져와도 남는다', async () => {
    db = new TidyDB('ask-3')
    const repo = createTransactionRepo(db)
    await repo.resolveMerchant(await repo.add({ ...okExpense, memo: 'KCP*결제' }), '꽃집', REMEMBER)
    const otherDb = new TidyDB('ask-3b')

    const backup = await createBackupRepo(db, '0.1.0').exportAll()
    await createBackupRepo(otherDb).importAll(JSON.stringify(backup))

    expect(backup.schemaVersion).toBe(db.verno)
    expect(backup.merchantAliases).toHaveLength(1)
    expect((await createMerchantAliasRepo(otherDb).find('KCP*결제'))?.name).toBe('꽃집')
    await otherDb.delete()
  })
})

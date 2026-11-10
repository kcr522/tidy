import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Transaction } from '../../src/db/types'
import { accountEmoji } from '../../src/lib/accounts'
import { formatTimeLabel } from '../../src/lib/format'
import { accountTotals, filterByAccount, NO_ACCOUNT } from '../../src/lib/summary'
import { parseBackup } from '../../src/repositories/backupRepo'
import { createTransactionRepo, sortTransactions } from '../../src/repositories/transactionRepo'

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

const tx = (over: Partial<Transaction>): Transaction => ({
  type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-10', memo: '', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', ...over,
})

describe('결제 수단과 시간 (2차)', () => {
  it('결제 수단별 합계: 지출 많은 순, 미지정은 맨 뒤', () => {
    const list = [
      tx({ account: '토스', amount: 3000 }),
      tx({ account: '신한카드', amount: 9000 }),
      tx({ account: '토스', amount: 4000 }),
      tx({ amount: 50000 }),
      tx({ account: '토스뱅크', type: 'INCOME', amount: 100000, category: '월급' }),
    ]
    const totals = accountTotals(list)
    expect(totals.map((t) => t.account)).toEqual(['신한카드', '토스', '토스뱅크', NO_ACCOUNT])
    expect(totals[1]).toEqual({ account: '토스', expense: 7000, income: 0, count: 2 })
    expect(filterByAccount(list, NO_ACCOUNT)).toHaveLength(1)
    expect(filterByAccount(list, null)).toHaveLength(5)
  })

  it('시각 표시와 정렬 (같은 날은 늦은 시각 먼저)', () => {
    expect(formatTimeLabel('00:05')).toBe('오전 12:05')
    expect(formatTimeLabel('14:30')).toBe('오후 2:30')
    const sorted = sortTransactions([tx({ memo: 'a', time: '09:00' }), tx({ memo: 'b', time: '21:10' }), tx({ memo: 'c', date: '2026-11-11' })])
    expect(sorted.map((t) => t.memo)).toEqual(['c', 'b', 'a'])
  })

  it('결제 수단 그림', () => {
    expect(accountEmoji('현금')).toBe('💵')
    expect(accountEmoji('카카오페이')).toBe('📱')
    expect(accountEmoji('신한카드')).toBe('💳')
    expect(accountEmoji('카카오뱅크')).toBe('🏦')
  })

  it('저장, 수정에서 비우기, 자주 쓴 결제 수단', async () => {
    db = new TidyDB('acc-test')
    const repo = createTransactionRepo(db)
    const base = { type: 'EXPENSE' as const, amount: 5000, category: '쇼핑', date: '2026-11-10', memo: '다이소' }
    const id = await repo.add({ ...base, time: '14:05', account: '토스', })
    await repo.add({ ...base, account: '토스' })
    await repo.add({ ...base, account: '현금', time: undefined })
    expect(await repo.get(id)).toMatchObject({ time: '14:05', account: '토스' })
    await repo.update(id, { ...base, time: undefined, account: undefined })
    const after = await repo.get(id)
    expect(after?.time).toBeUndefined()
    expect(after?.account).toBeUndefined()
    expect(await repo.usedAccounts()).toEqual(['토스', '현금'])
  })

  it('백업: 시간, 결제 수단이 있는 내역도 읽고, 이상한 값은 거부', () => {
    const file = (t: object) => JSON.stringify({ app: 'tidy', appVersion: '0.1.0', schemaVersion: 1, exportedAt: '', transactions: [t], todos: [], bookmarks: [] })
    expect(parseBackup(file(tx({ time: '10:00', account: '토스' })), 1).transactions[0].account).toBe('토스')
    expect(() => parseBackup(file({ ...tx({}), account: 3 }), 1)).toThrow('손상')
  })

  it('백업: javascript: 같은 위험한 스크랩 주소는 거부 (보안)', () => {
    const bm = (url: string) => ({ id: 1, url, title: 't', memo: '', isRead: 0, createdAt: '', updatedAt: '' })
    const file = (b: object) => JSON.stringify({ app: 'tidy', appVersion: '0.1.0', schemaVersion: 1, exportedAt: '', transactions: [], todos: [], bookmarks: [b] })
    expect(parseBackup(file(bm('https://naver.com')), 1).bookmarks).toHaveLength(1)
    expect(() => parseBackup(file(bm('javascript:alert(1)')), 1)).toThrow()
  })
})

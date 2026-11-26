import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Transaction } from '../../src/db/types'
import { accountEmoji } from '../../src/lib/accounts'
import { formatTimeLabel } from '../../src/lib/format'
import { accountTotals, filterByAccount, NO_ACCOUNT } from '../../src/lib/summary'
import { parseBackup } from '../../src/repositories/backupRepo'
import { createTransactionRepo, sortTransactions } from '../../src/repositories/transactionRepo'

const BACKUP_SCHEMA = 1
const ALL_ACCOUNTS = null

let db: TidyDB
afterEach(async () => {
  await db?.delete()
})

/** 정상 지출 내역 하나 (1,000원 식비) 에서 필요한 칸만 바꾼다 */
const okTx = (over: Partial<Transaction>): Transaction => ({
  type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-10', memo: '', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', ...over,
})

/** 내역 · 스크랩 하나씩만 든 정상 백업 파일 */
const backupFile = (parts: { transactions?: object[]; bookmarks?: object[] }) =>
  JSON.stringify({ app: 'tidy', appVersion: '0.1.0', schemaVersion: BACKUP_SCHEMA, exportedAt: '', transactions: [], todos: [], bookmarks: [], ...parts })

const okBookmark = (url: string) => ({ id: 1, url, title: '네이버', memo: '', isRead: 0, createdAt: '', updatedAt: '' })

describe('결제 수단과 시간 (2차)', () => {
  const list = [
    okTx({ account: '토스', amount: 3000 }),
    okTx({ account: '신한카드', amount: 9000 }),
    okTx({ account: '토스', amount: 4000 }),
    okTx({ amount: 50000 }),
    okTx({ account: '토스뱅크', type: 'INCOME', amount: 100000, category: '월급' }),
  ]

  it('결제 수단별 합계는 지출이 많은 순으로 놓고, 미지정은 맨 뒤에 둔다', () => {
    const totals = accountTotals(list)

    expect(totals.map((row) => row.account)).toEqual(['신한카드', '토스', '토스뱅크', NO_ACCOUNT])
    expect(totals[1]).toEqual({ account: '토스', expense: 7000, saving: 0, income: 0, count: 2 })
  })

  it('미지정을 고르면 결제 수단 없는 내역만, 전체를 고르면 모든 내역이 나온다', () => {
    const noAccount = filterByAccount(list, NO_ACCOUNT)
    const all = filterByAccount(list, ALL_ACCOUNTS)

    expect(noAccount).toHaveLength(1)
    expect(all).toHaveLength(list.length)
  })

  it.each([
    ['00:05', '오전 12:05'],
    ['14:30', '오후 2:30'],
  ])('%s 시각은 "%s" 로 보여 준다', (time, label) => {
    expect(formatTimeLabel(time)).toBe(label)
  })

  it('내역은 늦은 날짜 먼저, 같은 날은 늦은 시각 먼저 정렬한다', () => {
    const morning = okTx({ memo: '아침', time: '09:00' })
    const night = okTx({ memo: '밤', time: '21:10' })
    const nextDay = okTx({ memo: '다음 날', date: '2026-11-11' })

    const sorted = sortTransactions([morning, night, nextDay])

    expect(sorted.map((row) => row.memo)).toEqual(['다음 날', '밤', '아침'])
  })

  it.each([
    ['현금', '💵'],
    ['카카오페이', '📱'],
    ['신한카드', '💳'],
    ['카카오뱅크', '🏦'],
  ])('결제 수단 %s 에는 %s 그림을 붙인다', (account, emoji) => {
    expect(accountEmoji(account)).toBe(emoji)
  })

  it('수정에서 시간 · 결제 수단을 비우면 지워지고, 자주 쓴 결제 수단은 한 번씩만 나온다', async () => {
    db = new TidyDB('acc-test')
    const repo = createTransactionRepo(db)
    const okExpense = { type: 'EXPENSE' as const, amount: 5000, category: '쇼핑', date: '2026-11-10', memo: '다이소' }
    const id = await repo.add({ ...okExpense, time: '14:05', account: '토스' })
    await repo.add({ ...okExpense, account: '토스' })
    await repo.add({ ...okExpense, account: '현금', time: undefined })
    expect(await repo.get(id)).toMatchObject({ time: '14:05', account: '토스' })

    await repo.update(id, { ...okExpense, time: undefined, account: undefined })

    const after = await repo.get(id)
    expect(after?.time).toBeUndefined()
    expect(after?.account).toBeUndefined()
    expect(await repo.usedAccounts()).toEqual(['토스', '현금'])
  })

  it('백업에 시간 · 결제 수단이 있는 내역도 그대로 읽는다', () => {
    const file = backupFile({ transactions: [okTx({ time: '10:00', account: '토스' })] })

    const backup = parseBackup(file, BACKUP_SCHEMA)

    expect(backup.transactions[0].account).toBe('토스')
  })

  it('백업의 결제 수단이 글자가 아니면 손상된 파일로 거절한다', () => {
    const numberAccount = 3
    const file = backupFile({ transactions: [{ ...okTx({}), account: numberAccount }] })

    expect(() => parseBackup(file, BACKUP_SCHEMA)).toThrow('손상')
  })

  it('백업의 스크랩 주소가 https 면 읽는다', () => {
    const file = backupFile({ bookmarks: [okBookmark('https://naver.com')] })

    expect(parseBackup(file, BACKUP_SCHEMA).bookmarks).toHaveLength(1)
  })

  it('백업의 스크랩 주소가 javascript: 면 거절한다 (보안)', () => {
    const file = backupFile({ bookmarks: [okBookmark('javascript:alert(1)')] })

    expect(() => parseBackup(file, BACKUP_SCHEMA)).toThrow()
  })
})

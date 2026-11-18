import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { PayMethod } from '../../src/db/types'
import { refinePayments } from '../../src/lib/assistant/learn'
import { parsePayNotification } from '../../src/lib/payNotify'
import { findLast4, guessKind, methodEmoji, methodLabel, pickPayMethod } from '../../src/lib/payMethods'
import { createBackupRepo, parseBackup } from '../../src/repositories/backupRepo'
import { createPayMethodRepo } from '../../src/repositories/payMethodRepo'
import { createSavingsRepo } from '../../src/repositories/savingsRepo'

const pm = (id: number, name: string, kind: PayMethod['kind'], last4?: string): PayMethod => ({ id, name, kind, ...(last4 ? { last4 } : {}), order: id, createdAt: '', updatedAt: '' })
const mine = [pm(1, '신한 체크', 'card', '1234'), pm(2, '신한 신용', 'card', '9876'), pm(3, '국민 월급통장', 'account', '5678'), pm(4, '현대카드 M', 'card'), pm(5, '토스페이', 'pay')]

describe('끝 4자리 찾기', () => {
  it.each([
    ['[Web발신] KB국민카드1234승인 김*림 6,100원 일시불 11/17 14:35 스타벅스', '1234'],
    ['신한체크(1234) 승인 6,100원', '1234'],
    ['삼성카드 [5678] 12,000원 승인', '5678'],
    ['신한카드 (*1234) 승인 6,100원', '1234'],
    ['[KB] 11/17 13:05 110-***-123456 출금 50,000 잔액 1,200,000', '3456'],
    ['우리 출금 계좌 ****5678 30,000원', '5678'],
  ])('%s → %s', (text, want) => {
    expect(findLast4(text)).toBe(want)
  })
  it('없으면 undefined (금액 · 시각 · 날짜는 아니다)', () => {
    expect(findLast4('스타벅스에서 6,100원 결제했어요 11/17 14:35')).toBeUndefined()
    expect(findLast4('출금 50000원 잔액 1200000원')).toBeUndefined()
  })
})

describe('내 카드 · 계좌 고르기', () => {
  it('끝 4자리가 같으면 그 카드', () => {
    expect(pickPayMethod(mine, '신한카드', '9876')?.name).toBe('신한 신용')
    expect(pickPayMethod(mine, null, '5678')?.name).toBe('국민 월급통장')
  })
  it('같은 회사 같은 종류가 하나뿐이면 그것', () => {
    expect(pickPayMethod(mine, 'KB국민은행', null)?.name).toBe('국민 월급통장')
    expect(pickPayMethod(mine, '현대카드', null)?.name).toBe('현대카드 M')
    expect(pickPayMethod(mine, '토스', null)?.name).toBe('토스페이')
  })
  it('헷갈리면 (신한 카드가 둘) 고르지 않는다', () => {
    expect(pickPayMethod(mine, '신한카드', null)).toBeUndefined()
    expect(pickPayMethod(mine, '삼성카드', '0000')).toBeUndefined()
    expect(pickPayMethod([], '신한카드', '1234')).toBeUndefined()
  })
  it('국민카드 알림은 국민 계좌로 고르지 않는다 (종류가 다르다)', () => {
    expect(pickPayMethod(mine, 'KB국민카드', null)).toBeUndefined()
  })
  it('이름 · 그림', () => {
    expect(guessKind('토스뱅크')).toBe('account')
    expect(guessKind('신한카드')).toBe('card')
    expect(guessKind('현금')).toBe('cash')
    expect(methodEmoji('국민 월급통장', mine)).toBe('🏦')
    expect(methodLabel(mine[0])).toBe('신한 체크 ··1234')
  })
})

describe('결제 알림 → 내 카드 · 계좌 자동으로', () => {
  it('카드 문자의 끝 4자리로 등록한 카드를 고른다', () => {
    const g = parsePayNotification({ id: 'a', pkg: 'com.samsung.android.messaging', app: '메시지', title: '15881688', text: '[Web발신] 신한카드(9876)승인 김*림 6,100원 일시불 11/17 14:35 스타벅스강남 누적123,400원', postedAt: Date.parse('2026-11-17T14:35:00+09:00') })
    expect(g?.last4).toBe('9876')
    const [d] = refinePayments([g!], [], [], mine)
    expect(d.input.account).toBe('신한 신용')
    expect(d.learned).toContain('내 카드 · 계좌: 신한 신용 ··9876')
  })
  it('등록한 게 없으면 알림에 적힌 이름 그대로', () => {
    const [d] = refinePayments([{ type: 'EXPENSE', merchant: '스타벅스', amount: 6100, date: '2026-11-17', time: null, account: '신한카드', last4: '9876', category: '카페' }], [], [])
    expect(d.input.account).toBe('신한카드')
  })
})

describe('카드 · 계좌 저장', () => {
  let db: TidyDB
  afterEach(async () => db?.delete())

  it('등록 · 같은 이름 막기 · 끝 4자리 검사', async () => {
    db = new TidyDB('pm-1')
    const repo = createPayMethodRepo(db)
    await repo.add({ name: ' 신한  체크 ', kind: 'card', last4: '1234' })
    await expect(repo.add({ name: '신한 체크', kind: 'card' })).rejects.toThrow('이미 있는 이름')
    await expect(repo.add({ name: '국민', kind: 'account', last4: '12' })).rejects.toThrow('숫자 4개')
    await expect(repo.add({ name: '', kind: 'card' })).rejects.toThrow('이름을')
    const id = await repo.add({ name: '현금', kind: 'cash' })
    const list = await repo.list()
    expect(list.map((m) => m.name)).toEqual(['신한 체크', '현금'])
    expect('last4' in list[1]).toBe(false)
    await repo.swap(list[0].id!, id)
    expect((await repo.list()).map((m) => m.name)).toEqual(['현금', '신한 체크'])
  })

  it('이름을 바꾸면 그 이름으로 쓴 내역 · 고정 금액 · 적금도 바뀌고, 지워도 내역은 남는다', async () => {
    db = new TidyDB('pm-2')
    const repo = createPayMethodRepo(db)
    const id = await repo.add({ name: '국민', kind: 'account' })
    const now = '2026-11-17T00:00:00.000Z'
    await db.transactions.bulkAdd([
      { type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-17', memo: 'a', account: '국민', createdAt: now, updatedAt: now },
      { type: 'EXPENSE', amount: 2000, category: '식비', date: '2026-11-17', memo: 'b', account: '현금', createdAt: now, updatedAt: now },
    ])
    const savings = createSavingsRepo(db)
    const sid = await savings.add({ name: '청년', fromAccount: '국민', amount: 100_000, rate: 3, interestType: 'simple', taxType: 'normal', schedule: { freq: 'monthly', day: 10 }, startDate: '2026-11-10', endDate: '2027-11-10', autoDeposit: 1, alarmOn: 0, alarmTime: '09:00', memo: '' })
    expect(await repo.update(id, { name: '국민 월급통장', kind: 'account', last4: '5678' })).toBe(1)
    expect((await db.transactions.toArray()).map((t) => t.account)).toEqual(['국민 월급통장', '현금'])
    expect((await savings.get(sid))?.fromAccount).toBe('국민 월급통장')
    await repo.remove(id)
    expect(await db.payMethods.count()).toBe(0)
    expect(await db.transactions.filter((t) => t.account === '국민 월급통장').count()).toBe(1)
  })

  it('적금은 정해 둔 계좌에서 나간 것으로 기록된다 (없으면 적금 은행)', async () => {
    db = new TidyDB('pm-3')
    const savings = createSavingsRepo(db)
    const base = { amount: 100_000, rate: 3, interestType: 'simple' as const, taxType: 'normal' as const, schedule: { freq: 'monthly' as const, day: 10 }, startDate: '2026-11-10', endDate: '2027-11-10', autoDeposit: 1 as const, alarmOn: 0 as const, alarmTime: '09:00', memo: '' }
    await savings.add({ ...base, name: '청년', bank: '카카오뱅크', fromAccount: '국민 월급통장' })
    await savings.add({ ...base, name: '여행', bank: '카카오뱅크' })
    await savings.runDue('2026-11-10')
    const rows = await db.transactions.orderBy('id').toArray()
    expect(rows.map((r) => [r.memo, r.account])).toEqual([
      ['청년 적금', '국민 월급통장'],
      ['여행 적금', '카카오뱅크'],
    ])
  })

  it('백업에 들어가고 다시 가져올 수 있다', async () => {
    db = new TidyDB('pm-4')
    await createPayMethodRepo(db).add({ name: '신한 체크', kind: 'card', last4: '1234' })
    const backup = await createBackupRepo(db, 'test').exportAll()
    expect(backup.payMethods).toHaveLength(1)
    const text = JSON.stringify(backup)
    expect(parseBackup(text, db.verno).payMethods?.[0]).toMatchObject({ name: '신한 체크', kind: 'card', last4: '1234' })
    expect(() => parseBackup(JSON.stringify({ ...backup, payMethods: [{ ...backup.payMethods![0], kind: 'gold' }] }), db.verno)).toThrow()
    await db.payMethods.clear()
    await createBackupRepo(db, 'test').importAll(text)
    expect(await db.payMethods.count()).toBe(1)
  })
})

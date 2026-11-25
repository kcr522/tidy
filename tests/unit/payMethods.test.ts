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

const method = (id: number, name: string, kind: PayMethod['kind'], last4?: string): PayMethod => ({ id, name, kind, ...(last4 ? { last4 } : {}), order: id, createdAt: '', updatedAt: '' })
const mine = [method(1, '신한 체크', 'card', '1234'), method(2, '신한 신용', 'card', '9876'), method(3, '국민 월급통장', 'account', '5678'), method(4, '현대카드 M', 'card'), method(5, '토스페이', 'pay')]
const NO_LAST4 = null
const NO_NAME = null

describe('끝 4자리 찾기', () => {
  it.each([
    ['[Web발신] KB국민카드1234승인 김*림 6,100원 일시불 11/17 14:35 스타벅스', '1234'],
    ['신한체크(1234) 승인 6,100원', '1234'],
    ['삼성카드 [5678] 12,000원 승인', '5678'],
    ['신한카드 (*1234) 승인 6,100원', '1234'],
    ['[KB] 11/17 13:05 110-***-123456 출금 50,000 잔액 1,200,000', '3456'],
    ['우리 출금 계좌 ****5678 30,000원', '5678'],
  ])('"%s" 에서 끝 4자리 %s 를 찾는다', (text, last4) => {
    expect(findLast4(text)).toBe(last4)
  })

  it.each(['스타벅스에서 6,100원 결제했어요 11/17 14:35', '출금 50000원 잔액 1200000원'])('"%s" 에는 끝 4자리가 없다 (금액 · 시각 · 날짜는 아니다)', (text) => {
    expect(findLast4(text)).toBeUndefined()
  })
})

describe('내 카드 · 계좌 고르기', () => {
  it.each([
    ['신한카드', '9876', '신한 신용'],
    [NO_NAME, '5678', '국민 월급통장'],
  ])('알림 이름 %s · 끝 4자리 %s 이면 끝 4자리가 같은 %s 를 고른다', (name, last4, picked) => {
    expect(pickPayMethod(mine, name, last4)?.name).toBe(picked)
  })

  it.each([
    ['KB국민은행', '국민 월급통장'],
    ['현대카드', '현대카드 M'],
    ['토스', '토스페이'],
  ])('같은 회사 같은 종류가 하나뿐이면 "%s" 알림은 %s 로 고른다', (name, picked) => {
    expect(pickPayMethod(mine, name, NO_LAST4)?.name).toBe(picked)
  })

  it.each([
    ['신한 카드가 둘이라 헷갈리면', mine, '신한카드', NO_LAST4],
    ['끝 4자리가 맞는 카드가 없으면', mine, '삼성카드', '0000'],
    ['등록한 게 없으면', [], '신한카드', '1234'],
    ['국민카드 알림을 국민 계좌로 (종류가 다르다)', mine, 'KB국민카드', NO_LAST4],
  ])('%s 고르지 않는다', (_case, methods, name, last4) => {
    expect(pickPayMethod(methods, name, last4)).toBeUndefined()
  })

  it.each([
    ['토스뱅크', 'account'],
    ['신한카드', 'card'],
    ['현금', 'cash'],
  ])('이름 "%s" 로 종류 %s 를 짐작한다', (name, kind) => {
    expect(guessKind(name)).toBe(kind)
  })

  it('계좌에는 🏦 그림을, 카드 이름에는 끝 4자리를 붙여 보여 준다', () => {
    expect(methodEmoji('국민 월급통장', mine)).toBe('🏦')
    expect(methodLabel(mine[0])).toBe('신한 체크 ··1234')
  })
})

describe('결제 알림 → 내 카드 · 계좌 자동으로', () => {
  it('카드 문자의 끝 4자리로 등록한 카드를 고르고 그 이유를 보여 준다', () => {
    const smsText = '[Web발신] 신한카드(9876)승인 김*림 6,100원 일시불 11/17 14:35 스타벅스강남 누적123,400원'
    const notice = parsePayNotification({ id: 'a', pkg: 'com.samsung.android.messaging', app: '메시지', title: '15881688', text: smsText, postedAt: Date.parse('2026-11-17T14:35:00+09:00') })

    const [draft] = refinePayments([notice!], [], [], mine)

    expect(notice?.last4).toBe('9876')
    expect(draft.input.account).toBe('신한 신용')
    expect(draft.learned).toContain('내 카드 · 계좌: 신한 신용 ··9876')
  })

  it('등록한 카드 · 계좌가 없으면 알림에 적힌 이름을 그대로 쓴다', () => {
    const payment = { type: 'EXPENSE' as const, merchant: '스타벅스', amount: 6100, date: '2026-11-17', time: null, account: '신한카드', last4: '9876', category: '카페' }

    const [draft] = refinePayments([payment], [], [])

    expect(draft.input.account).toBe('신한카드')
  })
})

describe('카드 · 계좌 저장', () => {
  let db: TidyDB
  afterEach(async () => db?.delete())

  const okSaving = { amount: 100_000, rate: 3, interestType: 'simple' as const, taxType: 'normal' as const, schedule: { freq: 'monthly' as const, day: 10 }, startDate: '2026-11-10', endDate: '2027-11-10', autoDeposit: 1 as const, alarmOn: 0 as const, alarmTime: '09:00', memo: '' }

  it('이름의 겹친 공백을 하나로 줄여 저장하고, 끝 4자리가 없으면 칸을 두지 않는다', async () => {
    db = new TidyDB('pm-1')
    const repo = createPayMethodRepo(db)

    await repo.add({ name: ' 신한  체크 ', kind: 'card', last4: '1234' })
    await repo.add({ name: '현금', kind: 'cash' })

    const list = await repo.list()
    expect(list.map((item) => item.name)).toEqual(['신한 체크', '현금'])
    expect('last4' in list[1]).toBe(false)
  })

  it.each([
    ['같은 이름', { name: '신한 체크', kind: 'card' as const }, '이미 있는 이름'],
    ['끝 4자리가 2자리', { name: '국민', kind: 'account' as const, last4: '12' }, '숫자 4개'],
    ['빈 이름', { name: '', kind: 'card' as const }, '이름을'],
  ])('%s 은 저장하지 않고 이유를 알려 준다', async (_case, input, message) => {
    db = new TidyDB(`pm-bad-${Math.random()}`)
    const repo = createPayMethodRepo(db)
    await repo.add({ name: '신한 체크', kind: 'card', last4: '1234' })

    await expect(repo.add(input)).rejects.toThrow(message)
  })

  it('두 카드 · 계좌의 순서를 맞바꾼다', async () => {
    db = new TidyDB('pm-1b')
    const repo = createPayMethodRepo(db)
    const first = await repo.add({ name: '신한 체크', kind: 'card' })
    const second = await repo.add({ name: '현금', kind: 'cash' })

    await repo.swap(first, second)

    expect((await repo.list()).map((item) => item.name)).toEqual(['현금', '신한 체크'])
  })

  it('이름을 바꾸면 그 이름으로 쓴 내역 · 적금의 나가는 계좌도 바뀐다', async () => {
    db = new TidyDB('pm-2')
    const repo = createPayMethodRepo(db)
    const id = await repo.add({ name: '국민', kind: 'account' })
    const now = '2026-11-17T00:00:00.000Z'
    await db.transactions.bulkAdd([
      { type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-17', memo: 'a', account: '국민', createdAt: now, updatedAt: now },
      { type: 'EXPENSE', amount: 2000, category: '식비', date: '2026-11-17', memo: 'b', account: '현금', createdAt: now, updatedAt: now },
    ])
    const savings = createSavingsRepo(db)
    const savingId = await savings.add({ ...okSaving, name: '청년', fromAccount: '국민' })

    const changed = await repo.update(id, { name: '국민 월급통장', kind: 'account', last4: '5678' })

    expect(changed).toBe(1)
    expect((await db.transactions.toArray()).map((row) => row.account)).toEqual(['국민 월급통장', '현금'])
    expect((await savings.get(savingId))?.fromAccount).toBe('국민 월급통장')
  })

  it('카드 · 계좌를 지워도 그 이름으로 쓴 내역은 남는다', async () => {
    db = new TidyDB('pm-2b')
    const repo = createPayMethodRepo(db)
    const id = await repo.add({ name: '국민', kind: 'account' })
    await db.transactions.add({ type: 'EXPENSE', amount: 1000, category: '식비', date: '2026-11-17', memo: 'a', account: '국민', createdAt: '', updatedAt: '' })

    await repo.remove(id)

    expect(await db.payMethods.count()).toBe(0)
    expect(await db.transactions.filter((row) => row.account === '국민').count()).toBe(1)
  })

  it('적금은 정해 둔 계좌에서 나간 것으로 기록하고, 없으면 적금 은행으로 기록한다', async () => {
    db = new TidyDB('pm-3')
    const savings = createSavingsRepo(db)
    await savings.add({ ...okSaving, name: '청년', bank: '카카오뱅크', fromAccount: '국민 월급통장' })
    await savings.add({ ...okSaving, name: '여행', bank: '카카오뱅크' })

    await savings.runDue('2026-11-10')

    const rows = await db.transactions.orderBy('id').toArray()
    expect(rows.map((row) => [row.memo, row.account])).toEqual([
      ['청년 적금', '국민 월급통장'],
      ['여행 적금', '카카오뱅크'],
    ])
  })

  it('카드 · 계좌는 백업에 들어가 다시 가져올 수 있다', async () => {
    db = new TidyDB('pm-4')
    await createPayMethodRepo(db).add({ name: '신한 체크', kind: 'card', last4: '1234' })
    const backup = await createBackupRepo(db, 'test').exportAll()
    const text = JSON.stringify(backup)
    await db.payMethods.clear()

    await createBackupRepo(db, 'test').importAll(text)

    expect(backup.payMethods).toHaveLength(1)
    expect(parseBackup(text, db.verno).payMethods?.[0]).toMatchObject({ name: '신한 체크', kind: 'card', last4: '1234' })
    expect(await db.payMethods.count()).toBe(1)
  })

  it('백업의 카드 · 계좌 종류가 모르는 값이면 거절한다', async () => {
    db = new TidyDB('pm-5')
    await createPayMethodRepo(db).add({ name: '신한 체크', kind: 'card', last4: '1234' })
    const backup = await createBackupRepo(db, 'test').exportAll()
    const unknownKind = { ...backup, payMethods: [{ ...backup.payMethods![0], kind: 'gold' }] }

    expect(() => parseBackup(JSON.stringify(unknownKind), db.verno)).toThrow()
  })
})

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { MoneyCategory, Transaction } from '../../src/db/types'
import { buildCategories, categoriesFor, defaultKey, MAX_CATEGORY_NAME, resolveCategory, setCategoryRows } from '../../src/lib/categories'
import { categoryColor } from '../../src/lib/stats'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createMoneyCategoryRepo } from '../../src/repositories/moneyCategoryRepo'

const dbs: TidyDB[] = []
afterEach(async () => {
  setCategoryRows([])
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

function openDb() {
  const db = new TidyDB(`money-category-${Math.random()}`)
  dbs.push(db)
  return { db, repo: createMoneyCategoryRepo(db) }
}

const okTx = (over: Partial<Transaction> = {}): Transaction => ({ type: 'EXPENSE', amount: 6100, category: '식비', date: '2026-11-25', memo: '스타벅스', createdAt: '', updatedAt: '', ...over })
const okRow = (over: Partial<MoneyCategory> = {}): MoneyCategory => ({ key: 'EXPENSE:+cafe', type: 'EXPENSE', name: '카페', icon: 'coffee', order: 100, createdAt: '', updatedAt: '', ...over })
const cafe = { name: '카페', icon: 'coffee' }
const NONE: MoneyCategory[] = []

describe('카테고리 목록 만들기', () => {
  it('바꾼 것이 없으면 기본 카테고리 그대로', () => {
    const list = buildCategories('EXPENSE', NONE)

    expect(list.map((c) => c.name)).toEqual(['식비', '교통', '쇼핑', '문화/여가', '주거/통신', '의료/건강', '교육', '저축', '기타'])
  })

  it('만든 것은 순서대로 뒤에 붙고, 지운 기본 카테고리는 빠진다', () => {
    const hidden = okRow({ key: defaultKey('EXPENSE', '교육'), name: '교육', icon: 'book', order: 6, hidden: 1 })

    const names = buildCategories('EXPENSE', [okRow(), hidden]).map((c) => c.name)

    expect(names).not.toContain('교육')
    expect(names.at(-1)).toBe('카페')
  })

  it('기타 · 저축은 저장된 이름이 달라도 이름이 바뀌지 않는다', () => {
    const renamed = okRow({ key: defaultKey('EXPENSE', '기타'), name: '잡비', icon: 'package', order: 8 })

    const list = buildCategories('EXPENSE', [renamed])

    expect(list.find((c) => c.key === renamed.key)).toMatchObject({ name: '기타', fixed: true })
  })
})

describe('기본 이름을 지금 이름으로', () => {
  it.each([
    ['그대로 있으면 그대로', [] as MoneyCategory[], '식비'],
    ['이름을 밥값으로 바꿨으면 밥값', [okRow({ key: defaultKey('EXPENSE', '식비'), name: '밥값', icon: 'utensils', order: 0 })], '밥값'],
    ['지웠으면 기타', [okRow({ key: defaultKey('EXPENSE', '식비'), name: '식비', icon: 'utensils', order: 0, hidden: 1 })], '기타'],
  ])('식비: %s', (_, rows, expected) => {
    setCategoryRows(rows)

    const result = resolveCategory('EXPENSE', '식비')

    expect(result).toBe(expected)
  })
})

describe('카테고리 만들기', () => {
  it('새 카테고리를 만들면 지출 목록 끝에 생긴다', async () => {
    const { repo } = openDb()

    await repo.add('EXPENSE', cafe)

    const names = (await repo.items('EXPENSE')).map((c) => c.name)
    expect(names.at(-1)).toBe('카페')
  })

  it.each([
    ['딱 최대 글자', 'ㄱ'.repeat(MAX_CATEGORY_NAME), true],
    ['한 글자 넘음', 'ㄱ'.repeat(MAX_CATEGORY_NAME + 1), false],
    ['빈 이름', '   ', false],
    ['이미 있는 이름', '식비', false],
  ])('이름이 %s 이면 만들 수 있는가: $2', async (_, name, isOk) => {
    const { repo } = openDb()

    const result = repo.add('EXPENSE', { name, icon: 'coffee' })

    if (isOk) await expect(result).resolves.toBeTypeOf('string')
    else await expect(result).rejects.toThrow()
  })

  it('지운 기본 카테고리와 같은 이름으로 만들면 그 카테고리가 다시 살아난다', async () => {
    const { repo } = openDb()
    await repo.remove(defaultKey('EXPENSE', '교육'))

    const key = await repo.add('EXPENSE', { name: '교육', icon: 'school' })

    expect(key).toBe(defaultKey('EXPENSE', '교육'))
    expect((await repo.items('EXPENSE')).find((c) => c.key === key)?.icon).toBe('school')
  })
})

describe('카테고리 이름 바꾸기', () => {
  it('이름을 바꾸면 그 이름으로 쓴 내역 · 고정 금액 · 예산도 따라 바뀐다', async () => {
    const { db, repo } = openDb()
    await db.transactions.bulkAdd([okTx(), okTx({ category: '교통' })])
    await db.recurring.add({ type: 'EXPENSE', amount: 9000, category: '식비', memo: '도시락', day: 1, startDate: '2026-11-01', lastDate: null, isActive: 1, createdAt: '', updatedAt: '' })
    await db.budgets.put({ category: '식비', amount: 300000, updatedAt: '' })

    const moved = await repo.update(defaultKey('EXPENSE', '식비'), { name: '밥값', icon: 'utensils' })

    expect(moved).toBe(1)
    expect((await db.recurring.toArray())[0].category).toBe('밥값')
    expect(await db.budgets.get('밥값')).toMatchObject({ amount: 300000 })
  })

  it('수입 내역은 같은 이름이어도 지출 기타를 바꿀 때 건드리지 않는다', async () => {
    const { db, repo } = openDb()
    await db.transactions.add(okTx({ type: 'INCOME', category: '기타' }))

    await repo.update(defaultKey('EXPENSE', '기타'), { name: '잡비', icon: 'star' })

    expect((await db.transactions.toArray())[0].category).toBe('기타')
  })
})

describe('카테고리 지우기', () => {
  it('지우면 그 내역은 기타로 옮기고 예산은 지운다', async () => {
    const { db, repo } = openDb()
    await db.transactions.bulkAdd([okTx({ category: '교육' }), okTx({ category: '교육' })])
    await db.budgets.put({ category: '교육', amount: 100000, updatedAt: '' })

    const moved = await repo.remove(defaultKey('EXPENSE', '교육'))

    expect(moved).toBe(2)
    expect((await db.transactions.toArray()).map((t) => t.category)).toEqual(['기타', '기타'])
    expect(await db.budgets.get('교육')).toBeUndefined()
  })

  it.each([['기타'], ['저축']])('%s 는 지울 수 없다', async (name) => {
    const { repo } = openDb()

    const result = repo.remove(defaultKey('EXPENSE', name))

    await expect(result).rejects.toThrow('지울 수 없어요')
  })

  it('내가 만든 카테고리를 지우면 줄이 아예 없어진다', async () => {
    const { db, repo } = openDb()
    const key = await repo.add('EXPENSE', cafe)

    await repo.remove(key)

    expect(await db.moneyCategories.get(key)).toBeUndefined()
  })
})

describe('순서 · 색 · 백업', () => {
  it('위로 옮기면 바로 앞 카테고리와 자리를 바꾼다', async () => {
    const { repo } = openDb()

    await repo.swap(defaultKey('EXPENSE', '교통'), defaultKey('EXPENSE', '식비'))

    const names = (await repo.items('EXPENSE')).map((c) => c.name)
    expect(names.slice(0, 2)).toEqual(['교통', '식비'])
  })

  it('이름을 바꾼 기본 카테고리는 처음 색을 그대로 쓴다', () => {
    const before = categoryColor('식비')
    setCategoryRows([okRow({ key: defaultKey('EXPENSE', '식비'), name: '밥값', icon: 'utensils', order: 0 })])

    const after = categoryColor('밥값')

    expect(after).toBe(before)
  })

  it('백업하고 다시 넣으면 만든 카테고리도 돌아온다', async () => {
    const { db, repo } = openDb()
    await repo.add('EXPENSE', cafe)
    const text = JSON.stringify(await createBackupRepo(db, 'test').exportAll())
    const other = openDb()

    await createBackupRepo(other.db, 'test').importAll(text)

    expect((await other.repo.items('EXPENSE')).map((c) => c.name)).toContain('카페')
  })

  it('지금 목록(categoriesFor)은 저장소가 넣어 준 줄을 따른다', () => {
    setCategoryRows([okRow()])

    const names = categoriesFor('EXPENSE')

    expect(names).toContain('카페')
  })
})

import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Budget, Transaction } from '../../src/db/types'
import { budgetStatus, newAlerts } from '../../src/lib/budget'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createBudgetRepo, TOTAL } from '../../src/repositories/budgetRepo'

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

const budget = (category: string, amount: number): Budget => ({ category, amount, updatedAt: '' })
const row = (date: string, amount: number, category = '식비', type: Transaction['type'] = 'EXPENSE'): Transaction => ({ type, amount, date, category, memo: '', createdAt: '', updatedAt: '' })

const NOVEMBER = '2026-11'
const OCTOBER = '2026-10'
const TODAY = '2026-11-11'

describe('budgetStatus', () => {
  const items = [row('2026-11-01', 300000, '주거·통신'), row('2026-11-05', 120000), row('2026-11-11', 60000), row('2026-11-11', 3000000, '월급', 'INCOME'), row('2026-10-30', 99999)]

  it('그달 지출만 더해 남은 돈과 쓴 비율을 센다 (수입 · 지난달은 빼고)', () => {
    const status = budgetStatus([budget(TOTAL, 800000)], items, NOVEMBER, TODAY)

    expect(status.total).toMatchObject({ budget: 800000, spent: 480000, left: 320000, pct: 60, level: 'ok' })
  })

  it('남은 돈을 오늘 포함 남은 날 수로 나눠 하루에 쓸 돈을 센다', () => {
    const status = budgetStatus([budget(TOTAL, 800000)], items, NOVEMBER, TODAY)

    expect(status.daysLeft).toBe(20) // 11월 11일 ~ 30일
    expect(status.perDay).toBe(16000) // 320,000 ÷ 20
  })

  it('카테고리 예산은 80% 부터 조심(warn), 100% 넘으면 초과(over) 이고 많이 쓴 순으로 놓는다', () => {
    const categoryBudgets = [budget('식비', 200000), budget('쇼핑', 100000), budget('주거·통신', 250000)]

    const status = budgetStatus(categoryBudgets, items, NOVEMBER, TODAY)

    expect(status.total).toBeNull()
    expect(status.categories.map((c) => [c.category, c.pct, c.level])).toEqual([
      ['주거·통신', 120, 'over'],
      ['식비', 90, 'warn'],
      ['쇼핑', 0, 'ok'],
    ])
  })

  it('지난달을 보면 그달 지출은 세지만 하루에 쓸 돈은 없다', () => {
    const status = budgetStatus([budget(TOTAL, 100000)], items, OCTOBER, TODAY)

    expect(status.total?.spent).toBe(99999)
    expect(status.perDay).toBeNull()
  })

  it('예산을 넘으면 하루에 쓸 돈은 0 이다', () => {
    const status = budgetStatus([budget(TOTAL, 100000)], items, NOVEMBER, TODAY)

    expect(status.perDay).toBe(0)
  })
})

describe('newAlerts', () => {
  it('처음 넘긴 예산만 알리고, 이미 알린 것은 다시 알리지 않는다', () => {
    const spent = [row('2026-11-02', 420000, '쇼핑'), row('2026-11-03', 160000)]
    const status = budgetStatus([budget(TOTAL, 500000), budget('식비', 150000)], spent, NOVEMBER, TODAY)

    const first = newAlerts(status, [])
    const second = newAlerts(status, first.map((alert) => alert.key))

    expect(first.map((alert) => alert.text)).toEqual(['이번 달 예산을 넘었어요 (116%)', '식비 예산을 넘었어요 (107%)'])
    expect(second).toEqual([])
  })

  it('전체 예산의 80% 를 넘으면 쓴 비율을 알린다', () => {
    const status = budgetStatus([budget(TOTAL, 100000)], [row('2026-11-02', 85000)], NOVEMBER, TODAY)

    expect(newAlerts(status, [])).toEqual([{ key: ':80', text: '이번 달 예산의 85%를 썼어요' }])
  })
})

describe('budgetRepo + 백업', () => {
  const NO_BUDGET = 0
  const REMOVE = null

  it('예산을 정하고, 0 으로 정하면 저장하지 않는다', async () => {
    const db = new TidyDB('budget-1')
    dbs.push(db)
    const repo = createBudgetRepo(db)

    await repo.set(TOTAL, 800000)
    await repo.set('식비', 300000)
    await repo.set('쇼핑', NO_BUDGET)

    expect((await repo.list()).map((item) => [item.category, item.amount])).toEqual([
      ['', 800000],
      ['식비', 300000],
    ])
  })

  it('null 로 정하면 지우고, 예산은 백업에 들어가 다시 가져올 수 있다', async () => {
    const db = new TidyDB('budget-2')
    dbs.push(db)
    const repo = createBudgetRepo(db)
    await repo.set(TOTAL, 800000)
    await repo.set('식비', 300000)
    await repo.set('식비', REMOVE)
    const backup = createBackupRepo(db)
    const json = JSON.stringify(await backup.exportAll())

    await repo.set(TOTAL, 1)
    await backup.importAll(json)

    expect((await repo.list()).map((item) => item.amount)).toEqual([800000])
  })
})

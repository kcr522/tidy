import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import type { Budget, Transaction } from '../../src/db/types'
import { budgetStatus, newAlerts } from '../../src/lib/budget'
import { createBackupRepo } from '../../src/repositories/backupRepo'
import { createBudgetRepo, TOTAL } from '../../src/repositories/budgetRepo'

const dbs: TidyDB[] = []
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

const b = (category: string, amount: number): Budget => ({ category, amount, updatedAt: '' })
const tx = (date: string, amount: number, category = '식비', type: Transaction['type'] = 'EXPENSE'): Transaction => ({ type, amount, date, category, memo: '', createdAt: '', updatedAt: '' })

describe('budgetStatus', () => {
  const items = [tx('2026-11-01', 300000, '주거·통신'), tx('2026-11-05', 120000), tx('2026-11-11', 60000), tx('2026-11-11', 3000000, '월급', 'INCOME'), tx('2026-10-30', 99999)]

  it('그달 지출만 더하고 남은 돈과 하루에 쓸 돈을 센다', () => {
    const s = budgetStatus([b(TOTAL, 800000)], items, '2026-11', '2026-11-11')
    expect(s.total).toMatchObject({ budget: 800000, spent: 480000, left: 320000, pct: 60, level: 'ok' })
    // 11월 11일 포함 20일 남음
    expect(s.daysLeft).toBe(20)
    expect(s.perDay).toBe(16000)
  })

  it('80%부터 조심, 100% 넘으면 초과', () => {
    const s = budgetStatus([b('식비', 200000), b('쇼핑', 100000), b('주거·통신', 250000)], items, '2026-11', '2026-11-11')
    expect(s.total).toBeNull()
    expect(s.categories.map((c) => [c.category, c.pct, c.level])).toEqual([
      ['주거·통신', 120, 'over'],
      ['식비', 90, 'warn'],
      ['쇼핑', 0, 'ok'],
    ])
  })

  it('지난달을 보면 하루에 쓸 돈은 없다', () => {
    const s = budgetStatus([b(TOTAL, 100000)], items, '2026-10', '2026-11-11')
    expect(s.total?.spent).toBe(99999)
    expect(s.perDay).toBeNull()
  })

  it('예산을 넘으면 하루에 쓸 돈은 0', () => {
    expect(budgetStatus([b(TOTAL, 100000)], items, '2026-11', '2026-11-11').perDay).toBe(0)
  })
})

describe('newAlerts', () => {
  it('처음 넘긴 것만, 한 번씩', () => {
    const s = budgetStatus([b(TOTAL, 500000), b('식비', 150000)], [tx('2026-11-02', 420000, '쇼핑'), tx('2026-11-03', 160000)], '2026-11', '2026-11-11')
    const a = newAlerts(s, [])
    expect(a.map((x) => x.text)).toEqual(['이번 달 예산을 넘었어요 (116%)', '식비 예산을 넘었어요 (107%)'])
    expect(newAlerts(s, a.map((x) => x.key))).toEqual([])
  })
  it('80%', () => {
    const s = budgetStatus([b(TOTAL, 100000)], [tx('2026-11-02', 85000)], '2026-11', '2026-11-11')
    expect(newAlerts(s, [])).toEqual([{ key: ':80', text: '이번 달 예산의 85%를 썼어요' }])
  })
})

describe('budgetRepo + 백업', () => {
  it('정하고, 0이면 지우고, 백업에 들어간다', async () => {
    const db = new TidyDB('budget-1')
    dbs.push(db)
    const repo = createBudgetRepo(db)
    await repo.set(TOTAL, 800000)
    await repo.set('식비', 300000)
    await repo.set('쇼핑', 0)
    expect((await repo.list()).map((x) => [x.category, x.amount])).toEqual([
      ['', 800000],
      ['식비', 300000],
    ])
    await repo.set('식비', null)
    const backup = createBackupRepo(db)
    const json = JSON.stringify(await backup.exportAll())
    await repo.set(TOTAL, 1)
    await backup.importAll(json)
    expect((await repo.list()).map((x) => x.amount)).toEqual([800000])
  })
})

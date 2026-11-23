import type { Transaction } from '../../db/types'
import { isSpending } from '../categories'
import { MAX_ITEMS, type SpendingSnapshot } from './prompts'

/** 이번 달 내역에서 오늘 소비 요약을 만든다 (AI에 보낼 내용) */
export function buildSnapshot(monthItems: Transaction[], today: string): SpendingSnapshot {
  const expenses = monthItems.filter((t) => isSpending(t))
  const todays = expenses
    .filter((t) => t.date === today)
    .sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt.localeCompare(b.createdAt))

  const todayTotal = todays.reduce((s, t) => s + t.amount, 0)
  const monthExpense = expenses.filter((t) => t.date <= today).reduce((s, t) => s + t.amount, 0)
  const monthIncome = monthItems.filter((t) => t.type === 'INCOME' && t.date <= today).reduce((s, t) => s + t.amount, 0)

  // 오늘 전까지의 날 수 (1일이면 0)
  const daysBefore = Number(today.slice(8, 10)) - 1
  const dailyAverage = daysBefore > 0 ? Math.round((monthExpense - todayTotal) / daysBefore) : null

  return {
    date: today,
    todayTotal,
    items: todays.slice(0, MAX_ITEMS).map((t) => ({
      ...(t.time ? { time: t.time } : {}),
      name: t.memo.trim() || t.category,
      category: t.category,
      amount: t.amount,
    })),
    monthExpense,
    monthIncome,
    dailyAverage,
  }
}

/** 같은 내용이면 같은 값: 내역이 바뀌었을 때만 AI에게 다시 묻기 위해 쓴다 */
export function snapshotKey(s: SpendingSnapshot): string {
  return JSON.stringify([s.date, s.todayTotal, s.items, s.dailyAverage])
}

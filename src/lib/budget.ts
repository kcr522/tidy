import { getDaysInMonth } from 'date-fns'
import type { Budget, Transaction } from '../db/types'
import { isSpending } from './categories'
import { parseDateKey } from './date'

/** 이만큼 쓰면 "조심" 색으로 바뀌고 알려 준다 (%) */
export const WARN_PCT = 80

export type BudgetLevel = 'ok' | 'warn' | 'over'

export interface BudgetLine {
  /** '' 이면 한 달 전체 */
  category: string
  budget: number
  spent: number
  /** 남은 돈 (넘으면 음수) */
  left: number
  /** 쓴 비율, 반올림 */
  pct: number
  level: BudgetLevel
}

export interface BudgetStatus {
  total: BudgetLine | null
  /** 예산을 정한 카테고리만, 많이 쓴 비율 순 */
  categories: BudgetLine[]
  /** 이번 달이면: 남은 날 (오늘 포함) */
  daysLeft: number | null
  /** 이번 달이면: 남은 예산 ÷ 남은 날 (예산을 넘었으면 0) */
  perDay: number | null
}

const levelOf = (pct: number): BudgetLevel => (pct > 100 ? 'over' : pct >= WARN_PCT ? 'warn' : 'ok')

function line(category: string, budget: number, spent: number): BudgetLine {
  const pct = Math.round((spent / budget) * 100)
  return { category, budget, spent, left: budget - spent, pct, level: levelOf(pct) }
}

/**
 * @param items 그달 내역 (수입은 빼고 센다)
 * @param ym 보고 있는 달 YYYY-MM
 * @param today 오늘 YYYY-MM-DD (보고 있는 달이 이번 달이면 하루에 쓸 수 있는 돈을 센다)
 */
export function budgetStatus(budgets: Budget[], items: Transaction[], ym: string, today: string): BudgetStatus {
  const byCat = new Map<string, number>()
  let spent = 0
  for (const t of items) {
    if (!isSpending(t) || !t.date.startsWith(ym)) continue
    spent += t.amount
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
  }
  const totalBudget = budgets.find((b) => b.category === '')
  const total = totalBudget ? line('', totalBudget.amount, spent) : null
  const categories = budgets
    .filter((b) => b.category !== '')
    .map((b) => line(b.category, b.amount, byCat.get(b.category) ?? 0))
    .sort((a, b) => b.pct - a.pct)

  let daysLeft: number | null = null
  let perDay: number | null = null
  if (today.startsWith(ym)) {
    const d = parseDateKey(today)
    daysLeft = getDaysInMonth(d) - d.getDate() + 1
    if (total) perDay = Math.max(0, Math.floor(total.left / daysLeft))
  }
  return { total, categories, daysLeft, perDay }
}

/** 새로 알려 줄 것: 80%, 100%를 처음 넘긴 예산. 이미 알려 준 것(sent)은 뺀다 */
export function newAlerts(status: BudgetStatus, sent: string[]): { key: string; text: string }[] {
  const out: { key: string; text: string }[] = []
  for (const l of [...(status.total ? [status.total] : []), ...status.categories]) {
    const name = l.category === '' ? '이번 달 예산' : `${l.category} 예산`
    const mark = l.pct > 100 ? 100 : l.pct >= WARN_PCT ? WARN_PCT : null
    if (mark === null) continue
    const key = `${l.category}:${mark}`
    if (sent.includes(key)) continue
    out.push({ key, text: mark === 100 ? `${name}을 넘었어요 (${l.pct}%)` : `${name}의 ${l.pct}%를 썼어요` })
  }
  return out
}

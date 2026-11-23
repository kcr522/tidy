import { addMonths, format, getDaysInMonth } from 'date-fns'
import type { Bookmark, Budget, Diary, Habit, HabitCheck, Todo, Transaction } from '../db/types'
import { isSaving, isSpending } from './categories'
import { budgetStatus, type BudgetLine } from './budget'
import { parseDateKey } from './date'

export interface ReportInput {
  /** YYYY-MM */
  ym: string
  today: string
  /** 그달과 그 전달 내역 */
  transactions: Transaction[]
  todos: Todo[]
  habits: Habit[]
  checks: HabitCheck[]
  diaries: Diary[]
  bookmarks: Bookmark[]
  budgets: Budget[]
}

export interface MonthlyReport {
  ym: string
  /** "10월" */
  monthLabel: string
  /** 아직 끝나지 않은 달 */
  ongoing: boolean
  money: {
    income: number
    /** 쓴 돈 (저축은 빼고) */
    expense: number
    /** 저축으로 모은 돈 */
    saving: number
    prevExpense: number
    /** 지난달보다 몇 % 더(+) / 덜(-) 썼나. 지난달 기록이 없으면 null */
    diffPct: number | null
    top: { category: string; amount: number; pct: number }[]
    biggest: { memo: string; category: string; amount: number; date: string } | null
    /** 돈을 안 쓴 날 (지난 날만) */
    noSpendDays: number
    budget: BudgetLine | null
  }
  todos: { done: number; due: number; dueDone: number; rate: number | null }
  habits: { title: string; emoji: string; done: number; days: number }[]
  diary: { days: number; photos: number }
  scraps: { saved: number; read: number }
  /** 맨 위 한 줄 */
  headline: string
}

const pct = (a: number, b: number) => (b <= 0 ? 0 : Math.round((a / b) * 100))

export function prevMonth(ym: string): string {
  return format(addMonths(parseDateKey(`${ym}-01`), -1), 'yyyy-MM')
}

export function buildReport(i: ReportInput): MonthlyReport {
  const { ym, today } = i
  const prev = prevMonth(ym)
  const first = parseDateKey(`${ym}-01`)
  const daysInMonth = getDaysInMonth(first)
  const ongoing = today.startsWith(ym)
  const lastDay = ongoing ? Number(today.slice(8, 10)) : daysInMonth
  const inMonth = (d: string | null | undefined) => !!d && d.startsWith(ym)

  // 돈
  const tx = i.transactions.filter((t) => inMonth(t.date))
  const out = tx.filter(isSpending)
  const saving = tx.reduce((s, t) => (isSaving(t) ? s + t.amount : s), 0)
  const income = tx.reduce((s, t) => (t.type === 'INCOME' ? s + t.amount : s), 0)
  const expense = out.reduce((s, t) => s + t.amount, 0)
  const prevExpense = i.transactions.reduce((s, t) => (isSpending(t) && t.date.startsWith(prev) ? s + t.amount : s), 0)
  const byCat = new Map<string, number>()
  for (const t of out) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, amount]) => ({ category, amount, pct: pct(amount, expense) }))
  const big = out.reduce<Transaction | null>((m, t) => (!m || t.amount > m.amount ? t : m), null)
  const spentDays = new Set(out.map((t) => t.date))
  const budget = budgetStatus(i.budgets, tx, ym, today).total

  // 할 일
  const done = i.todos.filter((t) => t.isCompleted === 1 && inMonth(t.completedAt ? format(new Date(t.completedAt), 'yyyy-MM-dd') : null)).length
  const dueList = i.todos.filter((t) => inMonth(t.dueDate))
  const dueDone = dueList.filter((t) => t.isCompleted === 1).length

  // 습관: 그달 체크한 날 / 체크할 수 있던 날 (습관 만든 날부터)
  const habits = i.habits
    .map((h) => {
      const created = h.createdAt ? format(new Date(h.createdAt), 'yyyy-MM-dd') : `${ym}-01`
      const since = created.slice(0, 7) > ym ? lastDay + 1 : created.startsWith(ym) ? Number(created.slice(8, 10)) : 1
      const days = Math.max(0, lastDay - since + 1)
      const doneDays = i.checks.filter((c) => c.habitId === h.id && inMonth(c.date)).length
      return { title: h.title, emoji: h.emoji, done: Math.min(doneDays, days), days }
    })
    .filter((h) => h.days > 0)
    .sort((a, b) => pct(b.done, b.days) - pct(a.done, a.days))
    .slice(0, 3)

  const diaries = i.diaries.filter((d) => inMonth(d.date))
  const diary = { days: diaries.length, photos: diaries.reduce((s, d) => s + (d.photos?.length ?? (d.photo ? 1 : 0)), 0) }
  const saved = i.bookmarks.filter((b) => inMonth(b.createdAt.slice(0, 10)))
  const scraps = { saved: saved.length, read: saved.filter((b) => b.isRead === 1).length }

  const diffPct = prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null
  const report: MonthlyReport = {
    ym,
    monthLabel: `${Number(ym.slice(5, 7))}월`,
    ongoing,
    money: { income, expense, saving, prevExpense, diffPct, top, biggest: big ? { memo: big.memo, category: big.category, amount: big.amount, date: big.date } : null, noSpendDays: lastDay - [...spentDays].filter((d) => Number(d.slice(8, 10)) <= lastDay).length, budget },
    todos: { done, due: dueList.length, dueDone, rate: dueList.length ? pct(dueDone, dueList.length) : null },
    habits,
    diary,
    scraps,
    headline: '',
  }
  report.headline = headlineOf(report)
  return report
}

/** 맨 위 한 줄: 가장 자랑할 만한 것부터 */
export function headlineOf(r: MonthlyReport): string {
  const m = r.money
  const when = r.ongoing ? `이번 달` : r.monthLabel
  if (m.budget && m.budget.left >= 0 && !r.ongoing) return `${r.monthLabel}은 예산 안에서 잘 썼어요 🎉`
  if (m.budget && m.budget.left < 0) return `${when} 예산을 ${m.budget.pct - 100}% 넘었어요. 다음 달엔 조금만 줄여 봐요`
  if (m.diffPct !== null && m.diffPct <= -5) return `지난달보다 ${-m.diffPct}% 덜 썼어요 👏`
  if (r.todos.rate !== null && r.todos.rate >= 80) return `할 일을 ${r.todos.rate}%나 끝냈어요 💪`
  if (m.diffPct !== null && m.diffPct >= 10) return `지난달보다 ${m.diffPct}% 더 썼어요`
  if (r.diary.days >= 10) return `일기를 ${r.diary.days}일이나 썼어요 📔`
  if (m.expense === 0 && m.saving === 0 && r.todos.done === 0) return `${when} 기록이 아직 없어요`
  return `${when}도 수고했어요`
}

import { addDays, differenceInCalendarDays, format, getDaysInMonth } from 'date-fns'
import type { Bookmark, Diary, Habit, HabitCheck, Todo, Transaction } from '../db/types'
import { isSaving, isSpending } from './categories'
import { parseDateKey } from './date'
import { prevMonth } from './monthlyReport'

export interface YearInput {
  /** YYYY */
  year: string
  today: string
  /** 그해와 그 전해 내역 */
  transactions: Transaction[]
  todos: Todo[]
  habits: Habit[]
  checks: HabitCheck[]
  diaries: Diary[]
  bookmarks: Bookmark[]
}

export interface MonthBar {
  /** 1 ~ 12 */
  month: number
  expense: number
  income: number
  saving: number
  todosDone: number
  diaryDays: number
}

export interface YearlyReport {
  year: string
  /** 아직 끝나지 않은 해 */
  ongoing: boolean
  /** 그해 지난 날 수 (올해면 오늘까지) */
  days: number
  money: {
    income: number
    expense: number
    saving: number
    prevExpense: number
    /** 지난해보다 몇 % 더(+) / 덜(-) 썼나. 지난해 기록이 없으면 null */
    diffPct: number | null
    /** 한 달 평균 쓴 돈 (기록이 있는 달만) */
    monthAvg: number
    top: { category: string; amount: number; pct: number }[]
    biggest: { memo: string; category: string; amount: number; date: string } | null
    /** 가장 많이 / 적게 쓴 달 (쓴 달만) */
    maxMonth: number | null
    minMonth: number | null
    noSpendDays: number
  }
  months: MonthBar[]
  todos: { done: number; bestMonth: number | null }
  habits: { title: string; emoji: string; done: number; days: number; streak: number }[]
  diary: { days: number; photos: number; bestMonth: number | null }
  scraps: { saved: number; read: number }
  /** 날마다 남긴 기록 수 (일기 · 가계부 · 끝낸 할 일 · 습관 체크), 키 YYYY-MM-DD */
  activity: Record<string, number>
  /** 뭐라도 기록한 날 */
  activeDays: number
  /** 맨 위 한 줄 */
  headline: string
}

const pct = (a: number, b: number) => (b <= 0 ? 0 : Math.round((a / b) * 100))
const dayOf = (iso: string | null | undefined) => (iso ? format(new Date(iso), 'yyyy-MM-dd') : null)

/** 처음 열면: 1월에는 지난해, 그 뒤로는 올해 */
export function defaultReportYear(today: string): string {
  const y = Number(today.slice(0, 4))
  return String(today.slice(5, 7) === '01' ? y - 1 : y)
}

/** 날짜 목록에서 가장 길게 이어진 날 수 */
export function longestStreak(dates: string[]): number {
  const sorted = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev: string | null = null
  for (const d of sorted) {
    run = prev && format(addDays(parseDateKey(prev), 1), 'yyyy-MM-dd') === d ? run + 1 : 1
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** 가장 큰 값의 달 (값이 모두 0이면 null) */
function bestOf(months: MonthBar[], key: keyof MonthBar, pick: 'max' | 'min' = 'max'): number | null {
  const has = months.filter((m) => m[key] > 0)
  if (!has.length) return null
  return has.reduce((a, b) => (pick === 'max' ? (b[key] > a[key] ? b : a) : b[key] < a[key] ? b : a)).month
}

export function buildYearReport(i: YearInput): YearlyReport {
  const { year, today } = i
  const prevYear = String(Number(year) - 1)
  const ongoing = today.startsWith(year)
  const lastKey = ongoing ? today : `${year}-12-31`
  const days = differenceInCalendarDays(parseDateKey(lastKey), parseDateKey(`${year}-01-01`)) + 1
  const inYear = (d: string | null | undefined) => !!d && d.startsWith(year) && d <= lastKey
  const monthOf = (d: string) => Number(d.slice(5, 7))
  const months: MonthBar[] = Array.from({ length: 12 }, (_, n) => ({ month: n + 1, expense: 0, income: 0, saving: 0, todosDone: 0, diaryDays: 0 }))
  const activity: Record<string, number> = {}
  const mark = (d: string) => (activity[d] = (activity[d] ?? 0) + 1)

  // 돈
  const tx = i.transactions.filter((t) => inYear(t.date))
  const out = tx.filter(isSpending)
  for (const t of tx) {
    const m = months[monthOf(t.date) - 1]
    if (isSpending(t)) m.expense += t.amount
    else if (isSaving(t)) m.saving += t.amount
    else if (t.type === 'INCOME') m.income += t.amount
    mark(t.date)
  }
  const expense = months.reduce((s, m) => s + m.expense, 0)
  const income = months.reduce((s, m) => s + m.income, 0)
  const saving = months.reduce((s, m) => s + m.saving, 0)
  const prevExpense = i.transactions.reduce((s, t) => (isSpending(t) && t.date.startsWith(prevYear) ? s + t.amount : s), 0)
  const byCat = new Map<string, number>()
  for (const t of out) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount)
  const top = [...byCat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([category, amount]) => ({ category, amount, pct: pct(amount, expense) }))
  const big = out.reduce<Transaction | null>((m, t) => (!m || t.amount > m.amount ? t : m), null)
  const spentMonths = months.filter((m) => m.expense > 0).length

  // 할 일
  for (const t of i.todos) {
    const d = t.isCompleted === 1 ? dayOf(t.completedAt) : null
    if (d && inYear(d)) {
      months[monthOf(d) - 1].todosDone++
      mark(d)
    }
  }
  const done = months.reduce((s, m) => s + m.todosDone, 0)

  // 습관: 만든 날부터 그해 끝(올해면 오늘)까지 중 한 날, 가장 길게 이어서 한 날
  const yearChecks = i.checks.filter((c) => inYear(c.date))
  for (const c of yearChecks) mark(c.date)
  const habits = i.habits
    .map((h) => {
      const created = dayOf(h.createdAt) ?? `${year}-01-01`
      const since = created > `${year}-01-01` ? created : `${year}-01-01`
      const total = since > lastKey ? 0 : differenceInCalendarDays(parseDateKey(lastKey), parseDateKey(since)) + 1
      const dates = yearChecks.filter((c) => c.habitId === h.id).map((c) => c.date)
      return { title: h.title, emoji: h.emoji, done: Math.min(new Set(dates).size, total), days: total, streak: longestStreak(dates) }
    })
    .filter((h) => h.days > 0)
    .sort((a, b) => b.done - a.done)
    .slice(0, 5)

  // 일기
  const diaries = i.diaries.filter((d) => inYear(d.date))
  for (const d of diaries) {
    months[monthOf(d.date) - 1].diaryDays++
    mark(d.date)
  }
  const photos = diaries.reduce((s, d) => s + (d.photos?.length ?? (d.photo ? 1 : 0)), 0)

  const saved = i.bookmarks.filter((b) => inYear(b.createdAt.slice(0, 10)))
  const spentDays = new Set(out.map((t) => t.date))
  const diffPct = prevExpense > 0 && !ongoing ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null

  const report: YearlyReport = {
    year,
    ongoing,
    days,
    money: {
      income,
      expense,
      saving,
      prevExpense,
      diffPct,
      monthAvg: spentMonths ? Math.round(expense / spentMonths) : 0,
      top,
      biggest: big ? { memo: big.memo, category: big.category, amount: big.amount, date: big.date } : null,
      maxMonth: bestOf(months, 'expense'),
      // 아직 진행 중인 달은 덜 쓴 게 당연하니 빼고 고른다
      minMonth: spentMonths > 1 ? bestOf(ongoing ? months.filter((m) => m.month !== Number(today.slice(5, 7))) : months, 'expense', 'min') : null,
      noSpendDays: days - spentDays.size,
    },
    months,
    todos: { done, bestMonth: bestOf(months, 'todosDone') },
    habits,
    diary: { days: diaries.length, photos, bestMonth: bestOf(months, 'diaryDays') },
    scraps: { saved: saved.length, read: saved.filter((b) => b.isRead === 1).length },
    activity,
    activeDays: Object.keys(activity).length,
    headline: '',
  }
  report.headline = yearHeadline(report)
  return report
}

/** 맨 위 한 줄: 가장 자랑할 만한 것부터 */
export function yearHeadline(r: YearlyReport): string {
  const when = r.ongoing ? '올해' : `${r.year}년`
  if (r.activeDays === 0) return `${when} 기록이 아직 없어요`
  if (r.money.diffPct !== null && r.money.diffPct <= -5) return `${r.year}년은 지난해보다 ${-r.money.diffPct}% 덜 썼어요 👏`
  const best = r.habits.find((h) => h.streak >= 30)
  if (best) return `${best.title}, ${best.streak}일 연속으로 해냈어요 🔥`
  if (r.activeDays >= r.days * 0.5) return `${when} ${r.days}일 중 ${r.activeDays}일을 기록했어요 ✨`
  if (r.todos.done >= 100) return `할 일을 ${r.todos.done}개나 끝냈어요 💪`
  if (r.diary.days >= 50) return `일기를 ${r.diary.days}일이나 썼어요 📔`
  return `${when}도 수고했어요`
}

/** 달력 한 줄 = 한 달: [달][날] → 진하기 0 ~ 3 (없는 날은 -1) */
export function activityRows(year: string, activity: Record<string, number>): number[][] {
  // 진하기 0 ~ 3: 그해 가장 많이 기록한 날을 3으로 맞춘다
  const max = Math.max(1, ...Object.values(activity))
  const level = (n: number) => (n ? Math.max(1, Math.ceil((n / max) * 3)) : 0)
  return Array.from({ length: 12 }, (_, m) => {
    const n = getDaysInMonth(parseDateKey(`${year}-${String(m + 1).padStart(2, '0')}-01`))
    return Array.from({ length: 31 }, (_, d) => (d < n ? level(activity[`${year}-${String(m + 1).padStart(2, '0')}-${String(d + 1).padStart(2, '0')}`] ?? 0) : -1))
  })
}

/** 대시보드에 한 장만: 12월 15일 ~ 1월 15일에는 1년 돌아보기, 그 밖의 매달 1~7일에는 지난달 돌아보기 */
export function teaserOf(today: string): { to: string; title: string; desc: string; year: boolean } | null {
  const y = Number(today.slice(0, 4))
  const m = Number(today.slice(5, 7))
  const d = Number(today.slice(8, 10))
  const year = m === 12 && d >= 15 ? y : m === 1 && d <= 15 ? y - 1 : null
  if (year) return { to: `/report?y=${year}`, title: `${year}년 돌아보기`, desc: '1년 동안 쓴 돈, 끝낸 할 일, 습관, 일기를 한 장으로', year: true }
  if (d > 7) return null
  const ym = prevMonth(today.slice(0, 7))
  return { to: `/report?m=${ym}`, title: `${Number(ym.slice(5, 7))}월 돌아보기`, desc: '지난달 쓴 돈, 끝낸 할 일, 습관을 정리했어요', year: false }
}

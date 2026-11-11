import { useLiveQuery } from 'dexie-react-hooks'
import { addMonths, format } from 'date-fns'
import { BookHeart, Bookmark, CheckCircle2, ChevronLeft, ChevronRight, Flame, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import BudgetBar from '../components/budget/BudgetBar'
import PageHeader from '../components/common/PageHeader'
import { db } from '../db/database'
import { useToday } from '../hooks/useToday'
import { categoryEmoji } from '../lib/categories'
import { parseDateKey } from '../lib/date'
import { formatDateLabel, formatWon } from '../lib/format'
import { buildReport, prevMonth } from '../lib/monthlyReport'
import { budgetRepo } from '../repositories/budgetRepo'
import { habitRepo } from '../repositories/habitRepo'
import { todoRepo } from '../repositories/todoRepo'

/** 처음 열면: 1~7일에는 지난달, 그 뒤로는 이번 달 */
export function defaultReportMonth(today: string): string {
  return Number(today.slice(8, 10)) <= 7 ? prevMonth(today.slice(0, 7)) : today.slice(0, 7)
}

/** 월간 리포트: 한 달 동안 쓴 돈, 끝낸 할 일, 습관, 일기, 스크랩을 한 장으로 */
export default function ReportPage() {
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const m = params.get('m')
  const ym = m && /^\d{4}-\d{2}$/.test(m) ? m : defaultReportMonth(today)
  const move = (n: number) => setParams({ m: format(addMonths(parseDateKey(`${ym}-01`), n), 'yyyy-MM') }, { replace: true })
  const isFuture = ym >= today.slice(0, 7)

  const data = useLiveQuery(async () => {
    const from = `${prevMonth(ym)}-01`
    const to = `${format(addMonths(parseDateKey(`${ym}-01`), 1), 'yyyy-MM')}-01`
    const [transactions, todos, habits, checks, diaries, bookmarks, budgets] = await Promise.all([
      db.transactions.where('date').between(from, to, true, false).toArray(),
      todoRepo.listAll(),
      habitRepo.list(),
      habitRepo.allChecks(),
      db.diaries.where('date').startsWith(ym).toArray(),
      db.bookmarks.toArray(),
      budgetRepo.list(),
    ])
    return { transactions, todos, habits, checks, diaries, bookmarks, budgets }
  }, [ym])
  const r = data ? buildReport({ ym, today, ...data }) : null

  return (
    <>
      <PageHeader title="월간 리포트" />
      <div className="mb-4 flex items-center justify-center gap-2">
        <button type="button" onClick={() => move(-1)} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 달">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="min-w-28 text-center text-lg font-extrabold">{`${ym.slice(0, 4)}년 ${Number(ym.slice(5, 7))}월`}</h2>
        <button type="button" onClick={() => move(1)} disabled={isFuture} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="다음 달">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {r && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <section className="bg-grad on-grad rounded-3xl p-5 shadow-float md:col-span-2">
            <p className="text-sm opacity-85">{r.ongoing ? `${r.monthLabel} (아직 진행 중)` : `${r.monthLabel} 한 줄 정리`}</p>
            <p className="mt-1 text-xl leading-snug font-extrabold break-keep">{r.headline}</p>
          </section>

          <Card icon={<Wallet className="size-5" aria-hidden />} title="돈">
            <div className="grid grid-cols-2 gap-2">
              <Num label="쓴 돈" value={formatWon(r.money.expense)} className="text-expense" />
              <Num label="들어온 돈" value={formatWon(r.money.income)} className="text-income" />
            </div>
            {r.money.diffPct !== null && (
              <p className="mt-2 text-sm text-slate-600">
                지난달({formatWon(r.money.prevExpense)})보다 <b className={r.money.diffPct > 0 ? 'text-expense' : 'text-income'}>{Math.abs(r.money.diffPct)}% {r.money.diffPct > 0 ? '더' : '덜'}</b> 썼어요
              </p>
            )}
            {r.money.budget && (
              <div className="mt-3">
                <BudgetBar line={r.money.budget} label="예산" compact />
              </div>
            )}
            {r.money.top.length > 0 && (
              <>
                <h4 className="mt-4 mb-2 text-sm font-bold text-slate-700">많이 쓴 곳</h4>
                <ol className="space-y-2">
                  {r.money.top.map((t, n) => (
                    <li key={t.category} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-center font-extrabold text-slate-400">{n + 1}</span>
                      <span aria-hidden>{categoryEmoji(t.category)}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{t.category}</span>
                      <span className="text-xs text-slate-400">{t.pct}%</span>
                      <span className="font-bold text-slate-900 tabular-nums">{formatWon(t.amount)}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {r.money.biggest && (
              <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                가장 큰 지출: <b className="text-slate-900">{r.money.biggest.memo || r.money.biggest.category}</b> {formatWon(r.money.biggest.amount)}{' '}
                <span className="text-xs text-slate-400">{formatDateLabel(r.money.biggest.date)}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-slate-600">
              돈을 안 쓴 날 <b className="text-slate-900">{r.money.noSpendDays}일</b>
            </p>
          </Card>

          <Card icon={<CheckCircle2 className="size-5" aria-hidden />} title="할 일">
            <div className="grid grid-cols-2 gap-2">
              <Num label="끝낸 할 일" value={`${r.todos.done}개`} />
              <Num label="마감 지킨 비율" value={r.todos.rate === null ? '-' : `${r.todos.rate}%`} />
            </div>
            {r.todos.due > 0 && (
              <p className="mt-2 text-sm text-slate-600">
                마감이 {r.monthLabel}이던 {r.todos.due}개 중 {r.todos.dueDone}개를 끝냈어요
              </p>
            )}
          </Card>

          {r.habits.length > 0 && (
            <Card icon={<Flame className="size-5" aria-hidden />} title="습관">
              <ul className="space-y-2.5">
                {r.habits.map((h) => {
                  const p = h.days ? Math.round((h.done / h.days) * 100) : 0
                  return (
                    <li key={h.title}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-semibold text-slate-800">
                          {h.emoji} {h.title}
                        </span>
                        <span className="text-slate-500">
                          {h.done}/{h.days}일
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div className="bg-grad h-full rounded-full" style={{ width: `${p}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Card>
          )}

          <Card icon={<BookHeart className="size-5" aria-hidden />} title="일기와 스크랩">
            <div className="grid grid-cols-3 gap-2">
              <Num label="일기 쓴 날" value={`${r.diary.days}일`} />
              <Num label="사진" value={`${r.diary.photos}장`} />
              <Num label="스크랩" value={`${r.scraps.saved}개`} icon={<Bookmark className="size-3" aria-hidden />} />
            </div>
            {r.scraps.saved > 0 && <p className="mt-2 text-sm text-slate-600">저장한 스크랩 중 {r.scraps.read}개를 읽었어요</p>}
          </Card>
        </div>
      )}
    </>
  )
}

function Card({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="card p-5">
      <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
        <span className="text-brand-600">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function Num({ label, value, className = 'text-slate-900', icon }: { label: string; value: string; className?: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs text-slate-500">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 truncate font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  )
}

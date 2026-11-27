import { useLiveQuery } from 'dexie-react-hooks'
import { BookHeart, Bookmark, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Flame, PiggyBank, Wallet } from 'lucide-react'
import { db } from '../../db/database'
import { formatDateLabel, formatWon } from '../../lib/format'
import { activityRows, buildYearReport, type MonthBar } from '../../lib/yearlyReport'
import { habitRepo } from '../../repositories/habitRepo'
import { todoRepo } from '../../repositories/todoRepo'
import { CategoryIcon } from '../common/MoneyIcon'
import { Card, Num } from './ReportParts'

/** 연간 리포트: 1년 동안 쓴 돈 · 모은 돈, 할 일, 습관, 일기를 한 장으로 (AI 없이 이 기기 기록만) */
export default function YearReport({ year, today, onYear }: { year: string; today: string; onYear: (y: string) => void }) {
  const isLatest = year >= today.slice(0, 4)
  const data = useLiveQuery(async () => {
    const [transactions, todos, habits, checks, diaries, bookmarks] = await Promise.all([
      db.transactions.where('date').between(`${Number(year) - 1}-01-01`, `${Number(year) + 1}-01-01`, true, false).toArray(),
      todoRepo.listAll(),
      habitRepo.list(),
      habitRepo.allChecks(),
      db.diaries.where('date').startsWith(year).toArray(),
      db.bookmarks.toArray(),
    ])
    return { transactions, todos, habits, checks, diaries, bookmarks }
  }, [year])
  const r = data ? buildYearReport({ year, today, ...data }) : null

  return (
    <>
      <div className="mb-4 flex items-center justify-center gap-2">
        <button type="button" onClick={() => onYear(String(Number(year) - 1))} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100" aria-label="이전 해">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <h2 className="min-w-28 text-center text-lg font-extrabold">{year}년</h2>
        <button type="button" onClick={() => onYear(String(Number(year) + 1))} disabled={isLatest} className="tap rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label="다음 해">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {r && (
        <div className="grid items-start gap-4 md:grid-cols-2">
          <section className="bg-grad on-grad rounded-3xl p-5 shadow-float md:col-span-2">
            <p className="text-sm opacity-85">{r.ongoing ? `${r.year}년 (아직 진행 중)` : `${r.year}년 한 줄 정리`}</p>
            <p className="mt-1 text-xl leading-snug font-extrabold break-keep">{r.headline}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Big label="기록한 날" value={`${r.activeDays}일`} />
              <Big label="끝낸 할 일" value={`${r.todos.done}개`} />
              <Big label="일기" value={`${r.diary.days}일`} />
            </div>
          </section>

          <Card icon={<CalendarDays className="size-5" aria-hidden />} title="1년 기록 잔디" className="md:col-span-2">
            <Grass year={r.year} activity={r.activity} />
            <p className="mt-2 text-xs text-slate-500">
              일기 · 가계부 · 끝낸 할 일 · 습관 체크를 남긴 날일수록 진해요. {r.days}일 중 <b className="text-slate-800">{r.activeDays}일</b>
            </p>
          </Card>

          <Card icon={<Wallet className="size-5" aria-hidden />} title="돈">
            <div className="grid grid-cols-2 gap-2">
              <Num label="쓴 돈" value={formatWon(r.money.expense)} className="text-expense" />
              <Num label="들어온 돈" value={formatWon(r.money.income)} className="text-income" />
            </div>
            {r.money.saving > 0 && (
              <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                <PiggyBank className="-mt-0.5 inline size-[1.1em] align-middle" aria-hidden /> 1년 동안 저축으로 <b className="text-saving">{formatWon(r.money.saving)}</b> 모았어요
              </p>
            )}
            {r.money.diffPct !== null && (
              <p className="mt-2 text-sm text-slate-600">
                지난해({formatWon(r.money.prevExpense)})보다 <b className={r.money.diffPct > 0 ? 'text-expense' : 'text-income'}>{Math.abs(r.money.diffPct)}% {r.money.diffPct > 0 ? '더' : '덜'}</b> 썼어요
              </p>
            )}
            {r.money.expense > 0 && (
              <>
                <h4 className="mt-4 mb-2 flex items-baseline justify-between text-sm font-bold text-slate-700">
                  달마다 쓴 돈 <span className="text-xs font-medium text-slate-400">한 달 평균 {formatWon(r.money.monthAvg)}</span>
                </h4>
                <Bars months={r.months} pick={(m) => m.expense} color="var(--color-expense)" format={formatWon} />
                <p className="mt-2 text-sm text-slate-600">
                  가장 많이 쓴 달은 <b className="text-slate-900">{r.money.maxMonth}월</b>
                  {r.money.minMonth && (
                    <>
                      , 가장 아낀 달은 <b className="text-slate-900">{r.money.minMonth}월</b>
                    </>
                  )}
                  이에요
                </p>
              </>
            )}
            {r.money.top.length > 0 && (
              <>
                <h4 className="mt-4 mb-2 text-sm font-bold text-slate-700">1년 동안 많이 쓴 곳</h4>
                <ol className="space-y-2">
                  {r.money.top.map((t, n) => (
                    <li key={t.category} className="flex items-center gap-2 text-sm">
                      <span className="w-4 text-center font-extrabold text-slate-400">{n + 1}</span>
                      <CategoryIcon category={t.category} className="size-4 shrink-0 text-slate-500" />
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
                올해 가장 큰 지출: <b className="text-slate-900">{r.money.biggest.memo || r.money.biggest.category}</b> {formatWon(r.money.biggest.amount)}{' '}
                <span className="text-xs text-slate-400">{formatDateLabel(r.money.biggest.date)}</span>
              </p>
            )}
            <p className="mt-2 text-sm text-slate-600">
              돈을 안 쓴 날 <b className="text-slate-900">{r.money.noSpendDays}일</b>
            </p>
          </Card>

          <div className="grid gap-4">
            <Card icon={<CheckCircle2 className="size-5" aria-hidden />} title="할 일">
              <Bars months={r.months} pick={(m) => m.todosDone} color="var(--color-brand-500)" format={(n) => `${n}개`} />
              <p className="mt-2 text-sm text-slate-600">
                1년 동안 <b className="text-slate-900">{r.todos.done}개</b>를 끝냈어요
                {r.todos.bestMonth && (
                  <>
                    . 가장 바빴던 달은 <b className="text-slate-900">{r.todos.bestMonth}월</b>
                  </>
                )}
              </p>
            </Card>

            {r.habits.length > 0 && (
              <Card icon={<Flame className="size-5" aria-hidden />} title="습관">
                <ul className="space-y-2.5">
                  {r.habits.map((h) => {
                    const p = h.days ? Math.round((h.done / h.days) * 100) : 0
                    return (
                      <li key={h.title}>
                        <div className="mb-1 flex justify-between gap-2 text-sm">
                          <span className="min-w-0 truncate font-semibold text-slate-800">
                            {h.emoji} {h.title}
                          </span>
                          <span className="shrink-0 text-slate-500">
                            {h.done}일 · 최장 <b className="text-slate-800">{h.streak}일</b> 연속
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
              {r.diary.bestMonth && (
                <p className="mt-2 text-sm text-slate-600">
                  일기를 가장 많이 쓴 달은 <b className="text-slate-900">{r.diary.bestMonth}월</b>이에요
                </p>
              )}
              {r.scraps.saved > 0 && <p className="mt-1 text-sm text-slate-600">저장한 스크랩 중 {r.scraps.read}개를 읽었어요</p>}
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function Big({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-2">
      <p className="text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-xs opacity-85">{label}</p>
    </div>
  )
}

/** 12달 막대 (가장 큰 달만 진하게) */
function Bars({ months, pick, color, format }: { months: MonthBar[]; pick: (m: MonthBar) => number; color: string; format: (n: number) => string }) {
  const max = Math.max(1, ...months.map(pick))
  return (
    <div className="flex h-24 items-end gap-1" role="img" aria-label={months.map((m) => `${m.month}월 ${format(pick(m))}`).join(', ')}>
      {months.map((m) => {
        const v = pick(m)
        return (
          <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <div className="w-full rounded-t-md" style={{ height: `${v ? Math.max(4, (v / max) * 100) : 2}%`, background: v ? color : 'var(--color-slate-200)', opacity: v === max ? 1 : 0.45 }} />
            <span className="text-[10px] text-slate-400 tabular-nums">{m.month}</span>
          </div>
        )
      })}
    </div>
  )
}

const LEVEL = ['var(--color-slate-100)', 'color-mix(in srgb, var(--color-brand-500) 30%, transparent)', 'color-mix(in srgb, var(--color-brand-500) 60%, transparent)', 'var(--color-brand-600)']

/** 한 줄 = 한 달, 한 칸 = 하루 */
function Grass({ year, activity }: { year: string; activity: Record<string, number> }) {
  const rows = activityRows(year, activity)
  return (
    <div className="max-w-2xl space-y-[3px]">
      {rows.map((days, m) => (
        <div key={m} className="flex items-center gap-1.5">
          <span className="w-6 shrink-0 text-right text-[10px] text-slate-400 tabular-nums">{m + 1}월</span>
          <div className="grid flex-1 grid-cols-[repeat(31,minmax(0,1fr))] gap-[2px]">
            {days.map((n, d) => (
              <span key={d} className="aspect-square rounded-[2px]" style={{ background: n < 0 ? 'transparent' : LEVEL[Math.min(n, 3)] }} title={n >= 0 ? `${m + 1}월 ${d + 1}일 · ${n}개` : undefined} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

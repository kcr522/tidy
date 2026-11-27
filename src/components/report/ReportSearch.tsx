import { useLiveQuery } from 'dexie-react-hooks'
import { Search, X } from 'lucide-react'
import { db } from '../../db/database'
import { isSpending } from '../../lib/categories'
import { formatWon } from '../../lib/format'
import { searchSpending } from '../../lib/yearlyReport'
import { CategoryIcon } from '../common/MoneyIcon'
import { Bars } from './ReportParts'

/** 리포트 검색: "여가"처럼 치면 보고 있는 달 · 해에 그 카테고리(또는 메모)로 쓴 돈 */
export default function ReportSearch({ query, onQuery, year, ym }: { query: string; onQuery: (q: string) => void; year: string; ym: string | null }) {
  const tx = useLiveQuery(() => db.transactions.where('date').between(`${year}-01-01`, `${Number(year) + 1}-01-01`, true, false).toArray(), [year])
  const categories = tx ? [...new Set(tx.filter(isSpending).map((t) => t.category))] : []
  const r = tx ? searchSpending(tx, query, year, ym) : null
  const monthNo = ym ? Number(ym.slice(5, 7)) : undefined
  const label = r?.categories.length ? r.categories.join(', ') : `'${query.trim()}'`

  return (
    <div className="mb-4">
      <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 shadow-card focus-within:border-brand-500">
        <Search className="size-[18px] shrink-0 text-slate-400" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          list="report-search-categories"
          placeholder="카테고리나 메모로 찾기 (예: 여가, 카페)"
          aria-label="리포트에서 찾기"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-slate-400 [&::-webkit-search-cancel-button]:hidden [&::-webkit-calendar-picker-indicator]:hidden!"
        />
        {query && (
          <button type="button" onClick={() => onQuery('')} className="tap rounded-full p-1 text-slate-400" aria-label="검색어 지우기">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </label>
      <datalist id="report-search-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {r && (
        <section className="card mt-3 p-5" aria-live="polite">
          <h3 className="mb-3 flex items-center gap-2 font-extrabold break-keep text-slate-900">
            {r.categories.length === 1 ? <CategoryIcon category={r.categories[0]} className="size-5 shrink-0 text-brand-600" /> : <Search className="size-5 shrink-0 text-brand-600" aria-hidden />}
            {label}에 쓴 돈
          </h3>
          {r.year.count === 0 ? (
            <p className="text-sm text-slate-500">{year}년에는 찾는 지출이 없어요. 카테고리 이름이나 메모 글자를 바꿔 보세요.</p>
          ) : (
            <>
              <div className={`grid gap-2 ${r.month ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {r.month && <Amount label={`${monthNo}월`} amount={r.month.amount} count={r.month.count} />}
                <Amount label={`${year}년 전체`} amount={r.year.amount} count={r.year.count} />
              </div>
              <div className="mt-4">
                <Bars values={r.months} color="var(--color-expense)" format={formatWon} mark={monthNo} />
              </div>
              <p className="mt-2 text-sm text-slate-600">
                쓴 달 평균 <b className="text-slate-900">{formatWon(Math.round(r.year.amount / r.months.filter((n) => n > 0).length))}</b>
              </p>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function Amount({ label, amount, count }: { label: string; amount: number; count: number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-0.5 truncate font-bold text-expense tabular-nums">{formatWon(amount)}</p>
      <p className="text-xs text-slate-400">{count}건</p>
    </div>
  )
}

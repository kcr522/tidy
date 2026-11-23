import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { Transaction } from '../../../db/types'
import { isSaving } from '../../../lib/categories'
import { formatWon } from '../../../lib/format'
import {
  categoryColor,
  categoryShares,
  inPeriod,
  percentOf,
  periodLabel,
  periodOf,
  REMAIN_COLOR,
  shiftPeriod,
  topIncomeSources,
  totalsByPeriod,
  type PeriodUnit,
} from '../../../lib/stats'
import { BarChart, DonutChart, Segmented, ShareRow } from './charts'
import { CategoryIcon } from '../../common/MoneyIcon'

const UNITS = [
  ['month', '이번 달'],
  ['year', '올해'],
] as const
const INCOME_COLOR = '#3182f6'
const EXPENSE_COLOR = '#f04452'
const SAVING_COLOR = '#0b97a5'

/** 통계: 수입 중 몇 %를 어디에 썼는지, 수입은 어디서 왔는지 */
export default function StatsPanel({ items, today }: { items: Transaction[]; today: string }) {
  const [unit, setUnit] = useState<PeriodUnit>('month')
  const [offset, setOffset] = useState(0)
  const period = useMemo(() => shiftPeriod(periodOf(unit, today), offset), [unit, today, offset])

  const inP = useMemo(() => items.filter((t) => inPeriod(t, period)), [items, period])
  const spend = useMemo(() => categoryShares(inP, 'EXPENSE'), [inP])
  const earn = useMemo(() => categoryShares(inP, 'INCOME'), [inP])
  const sources = useMemo(() => topIncomeSources(inP), [inP])
  const trend = useMemo(() => totalsByPeriod(items, period, 6), [items, period])

  const income = earn.reduce((s, x) => s + x.amount, 0)
  const expense = spend.reduce((s, x) => s + x.amount, 0)
  // 저축은 쓴 돈이 아니라 따로 모은 돈 (사용자 요청 2026-11-23)
  const saving = useMemo(() => inP.reduce((s, t) => (isSaving(t) ? s + t.amount : s), 0), [inP])
  const remain = income - expense - saving
  const usedPct = percentOf(expense, income)
  // 수입이 있으면 수입을 100%로, 없으면 지출 합계를 100%로
  const base = income > 0 ? Math.max(income, expense + saving) : expense + saving

  const tabLabel = offset === 0 ? (unit === 'month' ? '이번 달' : '올해') : periodLabel(period)

  return (
    <div className="space-y-5">
      <Segmented
        value={unit}
        options={UNITS}
        onChange={(u) => {
          setUnit(u)
          setOffset(0)
        }}
        label="기간"
      />
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => setOffset(offset - 1)} className="tap rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label="이전">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <span className="min-w-28 text-center text-base font-extrabold">{periodLabel(period)}</span>
        <button
          type="button"
          onClick={() => setOffset(offset + 1)}
          disabled={offset >= 0}
          className="tap rounded-full p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30"
          aria-label="다음"
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {/* 1. 가진 돈(수입) 중 얼마나, 어디에 썼나 */}
      <section className="rounded-3xl bg-slate-50 p-4">
        <h3 className="text-base font-extrabold">가진 돈 중 얼마나 썼나요?</h3>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          {income > 0 ? (
            <>
              {tabLabel} 수입 <b className="text-slate-900">{formatWon(income)}</b> 중{' '}
              <b className="text-expense">{usedPct}%</b>를 썼어요.{' '}
              {saving > 0 && <>저축으로 <b className="text-saving">{formatWon(saving)}</b> 모았고, </>}
              {remain >= 0 ? `${formatWon(remain)} 남았어요.` : `${formatWon(-remain)} 더 썼어요.`}
            </>
          ) : expense + saving > 0 ? (
            `${tabLabel}에는 수입 기록이 없어서, 쓴 돈${saving > 0 ? '과 저축' : ''} ${formatWon(expense + saving)}을 100%로 보여 드려요.`
          ) : (
            `${tabLabel}에는 아직 기록이 없어요.`
          )}
        </p>
        {base > 0 && (
          <>
            <DonutChart
              segments={[
                ...spend.map((s) => ({ key: s.category, label: s.category, value: s.amount, color: categoryColor(s.category) })),
                ...(saving > 0 ? [{ key: '__saving', label: '저축', value: saving, color: SAVING_COLOR }] : []),
                ...(income > 0 && remain > 0 ? [{ key: '__remain', label: '남은 돈', value: remain, color: REMAIN_COLOR }] : []),
              ]}
              total={base}
              centerTitle={income > 0 ? '쓴 비율' : '쓴 돈'}
              centerValue={income > 0 ? `${usedPct}%` : formatWon(expense)}
              ariaLabel="수입 대비 카테고리별 지출 원형 그래프"
            />
            <ul className="mt-3 divide-y divide-slate-200/70">
              {spend.map((s) => (
                <li key={s.category}>
                  <ShareRow
                    color={categoryColor(s.category)}
                    label={
                      <>
                        <CategoryIcon category={s.category} /> {s.category}
                      </>
                    }
                    amount={s.amount}
                    percent={income > 0 ? percentOf(s.amount, income) : s.percent}
                  />
                </li>
              ))}
              {saving > 0 && (
                <li>
                  <ShareRow color={SAVING_COLOR} label="저축 (지출 아님)" amount={saving} percent={percentOf(saving, income > 0 ? income : expense + saving)} />
                </li>
              )}
              {income > 0 && remain > 0 && (
                <li>
                  <ShareRow color="#d1d6db" label="💚 남은 돈" amount={remain} percent={percentOf(remain, income)} />
                </li>
              )}
            </ul>
            <p className="mt-1 text-right text-[11px] text-slate-400">{income > 0 ? '% = 수입 대비' : saving > 0 ? '% = 지출 + 저축 대비' : '% = 지출 대비'}</p>
          </>
        )}
      </section>

      {/* 2. 수입은 어디서 */}
      <section className="rounded-3xl bg-slate-50 p-4">
        <h3 className="text-base font-extrabold">수입은 어디서 왔나요?</h3>
        {income === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">{tabLabel}에는 수입 기록이 없어요</p>
        ) : (
          <>
            <p className="mt-1 mb-4 text-sm text-slate-600">
              <b className="text-slate-900">
                <CategoryIcon category={earn[0].category} /> {earn[0].category}
              </b>
              에서 가장 많이 벌었어요 ({earn[0].percent}%)
            </p>
            <DonutChart
              segments={earn.map((s) => ({ key: s.category, label: s.category, value: s.amount, color: categoryColor(s.category) }))}
              centerTitle="총 수입"
              centerValue={formatWon(income)}
              ariaLabel="수입 종류별 원형 그래프"
            />
            <ul className="mt-3 divide-y divide-slate-200/70">
              {earn.map((s) => (
                <li key={s.category}>
                  <ShareRow
                    color={categoryColor(s.category)}
                    label={
                      <>
                        <CategoryIcon category={s.category} /> {s.category}
                      </>
                    }
                    sub={`${s.count}건`}
                    amount={s.amount}
                    percent={s.percent}
                  />
                </li>
              ))}
            </ul>
            {sources.length > 1 && (
              <>
                <h4 className="mt-4 mb-1 text-sm font-bold text-slate-700">많이 들어온 곳</h4>
                <ol className="space-y-1.5">
                  {sources.map((s, i) => (
                    <li key={s.name} className="flex items-center gap-2 text-sm">
                      <span className="flex size-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-slate-500">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-700">{s.name}</span>
                      <span className="font-semibold text-income">+{formatWon(s.amount)}</span>
                      <span className="w-12 text-right text-xs font-semibold text-slate-500">{s.percent}%</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </>
        )}
      </section>

      {/* 3. 수입과 지출 흐름 */}
      <section className="rounded-3xl bg-slate-50 p-4">
        <h3 className="mb-3 text-base font-extrabold">수입 · 지출 · 저축 흐름</h3>
        <BarChart
          data={trend.map((r) => ({ key: r.period.start, label: periodLabel(r.period, true), values: [r.income, r.expense, r.saving] }))}
          colors={[INCOME_COLOR, EXPENSE_COLOR, SAVING_COLOR]}
          names={['수입', '지출', '저축']}
          selected={period.start}
          onSelect={(k) => setOffset(offset - trend.findIndex((r) => r.period.start === period.start) + trend.findIndex((r) => r.period.start === k))}
          ariaLabel="최근 6개 기간 수입, 지출, 저축 막대 그래프"
        />
      </section>
    </div>
  )
}

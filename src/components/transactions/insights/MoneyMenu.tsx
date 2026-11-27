import { useLiveQuery } from 'dexie-react-hooks'
import { BarChart3, CalendarCheck, Tags, CreditCard, ChevronLeft, ChevronRight, PieChart, Repeat, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { budgetStatus } from '../../../lib/budget'
import { isSpending } from '../../../lib/categories'
import { formatWon } from '../../../lib/format'
import { budgetRepo } from '../../../repositories/budgetRepo'
import BudgetPanel from '../../budget/BudgetPanel'
import { categoryShares, inPeriod, percentOf, periodOf } from '../../../lib/stats'
import { recurringRepo } from '../../../repositories/recurringRepo'
import { transactionRepo } from '../../../repositories/transactionRepo'
import Modal from '../../common/Modal'
import RecurringManager from '../RecurringManager'
import PayMethodManager from '../../payMethods/PayMethodManager'
import CategoryManager from '../../categories/CategoryManager'
import { payMethodRepo } from '../../../repositories/payMethodRepo'
import { accountTotals, NO_ACCOUNT } from '../../../lib/summary'
import ChartPanel from './ChartPanel'
import StatsPanel from './StatsPanel'

export type MenuView = 'menu' | 'chart' | 'stats' | 'fixed' | 'budget' | 'methods' | 'categories'

const TITLE: Record<MenuView, string> = { menu: '가계부 메뉴', chart: '차트', stats: '통계', fixed: '고정 금액', budget: '예산', methods: '카드 · 계좌', categories: '카테고리' }

/** ≡ 버튼을 누르면 열리는 창: 차트 / 통계 / 고정 금액. 열 때만 그린다 (닫으면 처음 메뉴로) */
export default function MoneyMenu({ onClose, today, initialView = 'menu' }: { onClose: () => void; today: string; initialView?: MenuView }) {
  const [view, setView] = useState<MenuView>(initialView)
  const budgets = useLiveQuery(() => budgetRepo.list(), [])
  const navigate = useNavigate()
  const items = useLiveQuery(() => transactionRepo.listAll(), [])
  const rules = useLiveQuery(() => recurringRepo.list(), [])
  const methods = useLiveQuery(() => payMethodRepo.list(), [])

  const month = periodOf('month', today)
  const inMonth = (items ?? []).filter((t) => inPeriod(t, month))
  const top = categoryShares(inMonth, 'EXPENSE')[0]
  const income = inMonth.reduce((s, t) => (t.type === 'INCOME' ? s + t.amount : s), 0)
  const expense = inMonth.reduce((s, t) => (isSpending(t) ? s + t.amount : s), 0)
  const active = (rules ?? []).filter((r) => r.isActive === 1)
  const fixedOut = active.reduce((s, r) => (isSpending(r) ? s + r.amount : s), 0)
  const topMethod = accountTotals(inMonth.filter(isSpending)).find((a) => a.account !== NO_ACCOUNT)
  const budget = budgets ? budgetStatus(budgets, inMonth, today.slice(0, 7), today).total : null

  return (
    <Modal open title={TITLE[view]} onClose={onClose}>
      {view !== 'menu' && (
        <button
          type="button"
          onClick={() => setView('menu')}
          className="-mt-2 mb-3 flex items-center gap-0.5 text-sm font-semibold text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft className="size-4" aria-hidden />
          메뉴
        </button>
      )}

      {view === 'menu' && (
        <ul className="space-y-2.5">
          <MenuItem
            icon={<Target className="size-5" aria-hidden />}
            title="예산"
            desc="한 달에 얼마까지 쓸지, 카테고리별로도"
            hint={budget ? (budget.left >= 0 ? `이번 달 ${budget.pct}% 썼어요 · ${formatWon(budget.left)} 남음` : `이번 달 예산을 ${formatWon(-budget.left)} 넘었어요`) : undefined}
            onClick={() => setView('budget')}
          />
          <MenuItem
            icon={<BarChart3 className="size-5" aria-hidden />}
            title="차트"
            desc="카테고리별, 주별·월별·연별로 얼마 썼는지"
            hint={top ? `이번 달 ${top.category}에 가장 많이 (${formatWon(top.amount)})` : undefined}
            onClick={() => setView('chart')}
          />
          <MenuItem
            icon={<PieChart className="size-5" aria-hidden />}
            title="통계"
            desc="가진 돈 중 몇 %를 어디에 썼는지, 수입은 어디서"
            hint={income > 0 ? `이번 달 수입의 ${percentOf(expense, income)}%를 썼어요` : undefined}
            onClick={() => setView('stats')}
          />
          <MenuItem
            icon={<CreditCard className="size-5" aria-hidden />}
            title="카드 · 계좌"
            desc="내 카드 · 계좌를 등록하고, 어디서 얼마 썼는지"
            hint={topMethod ? `이번 달 ${topMethod.account}에서 가장 많이 (${formatWon(topMethod.expense)})` : methods && methods.length > 0 ? `${methods.length}개 등록됨` : undefined}
            onClick={() => setView('methods')}
          />
          <MenuItem
            icon={<Tags className="size-5" aria-hidden />}
            title="카테고리"
            desc="식비, 교통처럼 나누는 칸을 직접 만들고 지우기"
            onClick={() => setView('categories')}
          />
          <MenuItem
            icon={<Repeat className="size-5" aria-hidden />}
            title="고정 금액"
            desc="월급, 월세, 구독료처럼 매달 나가고 들어오는 돈 · 결제 전 알림"
            hint={active.length > 0 ? `${active.length}개 · 매달 고정 지출 ${formatWon(fixedOut)} · 1년 ${formatWon(fixedOut * 12)}` : undefined}
            onClick={() => setView('fixed')}
          />
          <MenuItem
            icon={<CalendarCheck className="size-5" aria-hidden />}
            title="월간 리포트"
            desc="한 달 동안 쓴 돈, 끝낸 할 일, 습관, 일기를 한 장으로"
            onClick={() => {
              onClose()
              navigate('/report')
            }}
          />
        </ul>
      )}

      {view === 'chart' && items && <ChartPanel items={items} today={today} />}
      {view === 'stats' && items && <StatsPanel items={items} today={today} />}
      {view === 'fixed' && <RecurringManager today={today} />}
      {view === 'budget' && <BudgetPanel today={today} />}
      {view === 'methods' && <PayMethodManager today={today} />}
      {view === 'categories' && <CategoryManager />}
    </Modal>
  )
}

function MenuItem({ icon, title, desc, hint, onClick }: { icon: React.ReactNode; title: string; desc: string; hint?: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3.5 rounded-3xl bg-slate-50 p-4 text-left hover:bg-slate-100 active:scale-[0.99]">
        <span className="bg-grad on-grad flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-float">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-extrabold text-slate-900">{title}</span>
          <span className="block text-[13px] text-slate-500">{desc}</span>
          {hint && <span className="mt-1 block text-xs font-semibold text-brand-600">{hint}</span>}
        </span>
        <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
      </button>
    </li>
  )
}

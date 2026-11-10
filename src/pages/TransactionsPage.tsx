import { useLiveQuery } from 'dexie-react-hooks'
import { CalendarDays, Camera, List, Menu, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import MealCapture from '../components/transactions/MealCapture'
import MoneyCalendar from '../components/transactions/MoneyCalendar'
import MonthSummary from '../components/transactions/MonthSummary'
import TransactionDetail from '../components/transactions/TransactionDetail'
import TransactionForm from '../components/transactions/TransactionForm'
import TransactionList from '../components/transactions/TransactionList'
import MoneyMenu from '../components/transactions/insights/MoneyMenu'
import type { Transaction } from '../db/types'
import { useToday } from '../hooks/useToday'
import { categoryEmoji } from '../lib/categories'
import { accountEmoji } from '../lib/accounts'
import { dayTitle } from '../lib/calendar'
import { formatWon } from '../lib/format'
import { accountTotals, categoriesUsed, filterByAccount, filterByCategory, monthSummary } from '../lib/summary'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

type Editor = { mode: 'add'; date?: string } | { mode: 'view'; item: Transaction } | { mode: 'edit'; item: Transaction } | null
type FilterBy = 'category' | 'account'
type View = 'list' | 'calendar'
const VIEW_KEY = 'tidy:money-view'

function loadView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'list'
  } catch {
    return 'list'
  }
}

/** 가계부 화면 (spec US1) */
export default function TransactionsPage() {
  // 이번 달: 자정이나 월이 바뀌면 다시 계산된다
  const today = useToday()
  const [thisYear, thisMonthNum] = today.split('-').map(Number)
  const thisMonth = useMemo(() => ({ year: thisYear, month: thisMonthNum }), [thisYear, thisMonthNum])
  const [ym, setYm] = useState(thisMonth)
  const [category, setCategory] = useState<string | null>(null)
  const [filterBy, setFilterBy] = useState<FilterBy>('category')
  const [account, setAccount] = useState<string | null>(null)
  const [editor, setEditor] = useState<Editor>(null)
  const [showMenu, setShowMenu] = useState(false)
  const [showMeal, setShowMeal] = useState(false)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [view, setViewState] = useState<View>(loadView)
  const [selected, setSelected] = useState(today)
  const toast = useToast()

  function setView(v: View) {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* 저장 못 해도 화면은 바뀐다 */
    }
  }

  const items = useLiveQuery(() => transactionRepo.listByMonth(ym.year, ym.month), [ym.year, ym.month])
  const used = useMemo(() => categoriesUsed(items ?? []), [items])
  const accounts = useMemo(() => accountTotals(items ?? []), [items])
  const filtered = useMemo(
    () => (items ? (filterBy === 'category' ? filterByCategory(items, category) : filterByAccount(items, account)) : undefined),
    [items, filterBy, category, account],
  )
  const filterName = filterBy === 'category' ? category : account

  function changeFilterBy(next: FilterBy) {
    setFilterBy(next)
    setCategory(null)
    setAccount(null)
  }
  // 필터를 고르면 위쪽 합계도 그 카테고리 기준 (US6 시나리오 2)
  const summary = useMemo(() => monthSummary(filtered ?? []), [filtered])
  const chips = category !== null && !used.includes(category) ? [...used, category] : used

  const moveMonth = (delta: number) => {
    const d = new Date(ym.year, ym.month - 1 + delta, 1)
    const next = { year: d.getFullYear(), month: d.getMonth() + 1 }
    setYm(next)
    // 달력에서 고른 날도 그 달로 (이번 달이면 오늘, 아니면 1일)
    const key = `${next.year}-${String(next.month).padStart(2, '0')}`
    setSelected(today.startsWith(key) ? today : `${key}-01`)
  }
  const monthKey = `${ym.year}-${String(ym.month).padStart(2, '0')}`
  const dayItems = useMemo(() => (filtered ?? []).filter((t) => t.date === selected), [filtered, selected])
  const isThisMonth = ym.year === thisMonth.year && ym.month === thisMonth.month

  async function saveMeal(input: TransactionInput) {
    try {
      await transactionRepo.add(input)
      toast('음식 사진으로 기록했어요')
      setShowMeal(false)
      const [y, m] = input.date.split('-').map(Number)
      if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m })
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function save(input: TransactionInput) {
    try {
      if (editor?.mode === 'edit' && editor.item.id != null) {
        await transactionRepo.update(editor.item.id, input)
        toast('수정했어요')
      } else {
        await transactionRepo.add(input)
        toast('저장했어요')
      }
      setEditor(null)
      // 다른 달 날짜로 저장했으면 그 달로 이동해서 보여 준다
      const [y, m] = input.date.split('-').map(Number)
      if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m })
    } catch {
      // 입력 내용은 그대로 둔다 (Edge Cases: 저장 실패)
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function resolve(item: Transaction, name: string, remember: boolean) {
    if (item.id == null) return
    try {
      const n = await transactionRepo.resolveMerchant(item.id, name, remember)
      toast(n > 1 ? `같은 이름의 내역 ${n}개를 '${name}'(으)로 바꿨어요` : `'${name}'(으)로 바꿨어요`)
      setEditor(null)
    } catch {
      toast('바꾸지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await transactionRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setEditor(null)
  }

  return (
    <>
      <PageHeader
        title="가계부"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" className="px-3.5" onClick={() => setShowMenu(true)} aria-label="차트, 통계, 고정 금액 메뉴" title="메뉴">
              <Menu className="size-5" aria-hidden />
            </Button>
            <Button variant="secondary" className="px-3.5" onClick={() => setShowMeal(true)} aria-label="음식 사진으로 기록" title="음식 사진으로 기록">
              <Camera className="size-5" aria-hidden />
            </Button>
            <Button onClick={() => setEditor({ mode: 'add' })}>+ 내역 추가</Button>
          </div>
        }
      />

      <MonthSummary
        year={ym.year}
        month={ym.month}
        summary={summary}
        onPrev={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
        onToday={
          isThisMonth
            ? undefined
            : () => {
                setYm(thisMonth)
                setSelected(today)
              }
        }
      />

      <div className="mb-4 flex justify-end">
        <div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1" role="radiogroup" aria-label="보기 방식">
          {(
            [
              ['list', '목록', List],
              ['calendar', '달력', CalendarDays],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={view === key}
              onClick={() => setView(key)}
              className={`flex min-h-10 items-center gap-1 rounded-xl px-3 text-sm font-semibold ${view === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

      {items !== undefined && items.length > 0 && (
        <div className="mb-4 space-y-2.5">
          <div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1 md:max-w-xs" role="radiogroup" aria-label="모아 보기 기준">
            {(
              [
                ['category', '카테고리별'],
                ['account', '결제 수단별'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={filterBy === key}
                onClick={() => changeFilterBy(key)}
                className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${filterBy === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0"
            role="group"
            aria-label={filterBy === 'category' ? '카테고리 필터' : '결제 수단 필터'}
          >
            {filterBy === 'category'
              ? [null, ...chips].map((c) => (
                  <Chip key={c ?? 'all'} active={category === c} onClick={() => setCategory(c)}>
                    {c === null ? '전체' : `${categoryEmoji(c)} ${c}`}
                  </Chip>
                ))
              : [null, ...accounts].map((a) => (
                  <Chip key={a?.account ?? 'all'} active={account === (a?.account ?? null)} onClick={() => setAccount(a?.account ?? null)}>
                    {a === null ? (
                      '전체'
                    ) : (
                      <>
                        {accountEmoji(a.account)} {a.account}
                        <span className="ml-1.5 font-bold opacity-80">{a.expense > 0 ? `-${formatWon(a.expense)}` : `+${formatWon(a.income)}`}</span>
                      </>
                    )}
                  </Chip>
                ))}
          </div>
        </div>
      )}

      {view === 'calendar' && items !== undefined && (
        <>
          <MoneyCalendar
            month={monthKey}
            today={today}
            selected={selected}
            items={filtered ?? []}
            onSelect={setSelected}
            onAdd={(d) => {
              setSelected(d)
              setEditor({ mode: 'add', date: d })
            }}
          />
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[17px] font-bold">{dayTitle(selected)}</h2>
            <button
              type="button"
              onClick={() => setEditor({ mode: 'add', date: selected })}
              className="flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700"
            >
              <Plus className="size-4" strokeWidth={3} aria-hidden /> 이날 추가
            </button>
          </div>
          {dayItems.length === 0 ? (
            <p className="card mb-4 px-4 py-6 text-center text-sm text-slate-500">이날은 기록이 없어요</p>
          ) : (
            <div className="mb-4">
              <TransactionList items={dayItems} onSelect={(item) => setEditor({ mode: 'view', item })} />
            </div>
          )}
        </>
      )}

      {view === 'calendar' || items === undefined || filtered === undefined ? null : items.length === 0 ? (
        <EmptyState
          icon="💳"
          title="첫 내역을 기록해 보세요"
          description="이 달에는 아직 기록이 없어요."
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 내역 추가</Button>}
        />
      ) : (
        filtered.length === 0 ? (
          <EmptyState
            icon="🔍"
            title={`이 달에는 ${filterName} 내역이 없어요`}
            action={
              <Button variant="secondary" onClick={() => changeFilterBy(filterBy)}>
                전체 보기
              </Button>
            }
          />
        ) : (
          <TransactionList items={filtered} onSelect={(item) => setEditor({ mode: 'view', item })} />
        )
      )}

      <Modal
        open={editor !== null}
        title={editor?.mode === 'view' ? '내역 자세히' : editor?.mode === 'edit' ? '내역 수정' : '내역 추가'}
        onClose={() => setEditor(null)}
      >
        {editor?.mode === 'view' && (
          <TransactionDetail
            item={editor.item}
            onEdit={() => setEditor({ mode: 'edit', item: editor.item })}
            onDelete={() => setDeleting(editor.item)}
            onResolve={(name, remember) => resolve(editor.item, name, remember)}
          />
        )}
        {editor && editor.mode !== 'view' && (
          <TransactionForm
            key={editor.mode === 'edit' ? editor.item.id : 'new'}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            defaultDate={editor.mode === 'add' ? editor.date : undefined}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <Modal open={showMeal} title="음식 사진으로 기록" onClose={() => setShowMeal(false)}>
        {showMeal && <MealCapture onSave={saveMeal} />}
      </Modal>

      {showMenu && <MoneyMenu onClose={() => setShowMenu(false)} today={today} />}

      <ConfirmDialog
        open={deleting !== null}
        title="내역 삭제"
        message="이 내역을 삭제할까요? 삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors ${
        active ? 'bg-grad on-grad shadow-float' : 'bg-white text-slate-600 shadow-card hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  )
}

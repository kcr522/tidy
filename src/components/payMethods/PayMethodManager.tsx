import { useLiveQuery } from 'dexie-react-hooks'
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PayMethod } from '../../db/types'
import { formatWon } from '../../lib/format'
import { groupMethods, methodEmoji, methodLabel, PAY_KIND_EMOJI, PAY_KIND_LABEL } from '../../lib/payMethods'
import { inPeriod, periodOf } from '../../lib/stats'
import { accountTotals, NO_ACCOUNT, type AccountTotal } from '../../lib/summary'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { savingsRepo } from '../../repositories/savingsRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../common/Toast'
import PayMethodEditor from './PayMethodEditor'

type Editing = { kind: 'new'; name?: string } | { kind: 'edit'; method: PayMethod } | null

/** 가계부 메뉴 → 카드 · 계좌: 내 카드 · 계좌를 등록하고, 이번 달 어디서 얼마 썼는지 본다 */
export default function PayMethodManager({ today }: { today: string }) {
  const methods = useLiveQuery(() => payMethodRepo.list(), [])
  const items = useLiveQuery(() => transactionRepo.listAll(), [])
  const plans = useLiveQuery(() => savingsRepo.list(), [])
  const [editing, setEditing] = useState<Editing>(null)
  const [removing, setRemoving] = useState<PayMethod | null>(null)
  const toast = useToast()

  if (!methods || !items) return null
  const month = periodOf('month', today)
  const totals = new Map(accountTotals(items.filter((t) => inPeriod(t, month))).map((a) => [a.account, a]))
  const registered = new Set(methods.map((m) => m.name))
  // 기록에는 있는데 아직 등록 안 한 이름 (많이 쓴 순)
  const unregistered = accountTotals(items).filter((a) => a.account !== NO_ACCOUNT && !registered.has(a.account))
  const savingsFrom = (name: string) => (plans ?? []).filter((p) => (p.fromAccount || p.bank) === name)

  const saved = (name: string, renamed: number) => {
    setEditing(null)
    toast(renamed > 0 ? `${name}(으)로 바꿨어요 · 내역 ${renamed}개도 같이 바꿨어요` : `${name} 저장했어요`)
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 break-keep">
        어떤 카드 · 계좌로 썼는지 나눠서 볼 수 있어요. 끝 4자리를 적어 두면 결제 알림이 어느 카드 · 계좌인지 알아서 골라요.
      </p>

      {groupMethods(methods).map((g) => (
        <section key={g.kind}>
          <h3 className="mb-1.5 px-1 text-xs font-bold text-slate-400">
            {PAY_KIND_EMOJI[g.kind]} {PAY_KIND_LABEL[g.kind]}
          </h3>
          <ul className="space-y-2">
            {g.items.map((m, i) =>
              editing?.kind === 'edit' && editing.method.id === m.id ? (
                <li key={m.id}>
                  <PayMethodEditor initial={m} onCancel={() => setEditing(null)} onSaved={saved} />
                </li>
              ) : (
                <MethodRow
                  key={m.id}
                  method={m}
                  total={totals.get(m.name)}
                  savings={savingsFrom(m.name).map((p) => p.name)}
                  first={i === 0}
                  last={i === g.items.length - 1}
                  onEdit={() => setEditing({ kind: 'edit', method: m })}
                  onMove={(dir) => payMethodRepo.swap(m.id!, g.items[i + dir].id!)}
                  onRemove={() => setRemoving(m)}
                />
              ),
            )}
          </ul>
        </section>
      ))}

      {editing?.kind === 'new' ? (
        <PayMethodEditor name={editing.name} onCancel={() => setEditing(null)} onSaved={saved} />
      ) : (
        <button
          type="button"
          onClick={() => setEditing({ kind: 'new' })}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-slate-300 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          <Plus className="size-4" aria-hidden /> 카드 · 계좌 등록
        </button>
      )}

      {unregistered.length > 0 && (
        <section>
          <h3 className="mb-1.5 px-1 text-xs font-bold text-slate-400">기록에만 있는 이름 · 등록하면 종류와 끝 4자리를 정할 수 있어요</h3>
          <ul className="space-y-1.5">
            {unregistered.slice(0, 8).map((a) => (
              <li key={a.account} className="flex items-center gap-3 rounded-2xl bg-slate-50 px-3.5 py-2.5">
                <span className="text-lg" aria-hidden>
                  {methodEmoji(a.account)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-700">{a.account}</span>
                  <span className="block text-xs text-slate-400">지금까지 {a.count}건</span>
                </span>
                <button type="button" onClick={() => setEditing({ kind: 'new', name: a.account })} className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700">
                  등록
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="카드 · 계좌 지우기"
        message={`${removing?.name ?? ''}을(를) 목록에서 지울까요? 이 이름으로 적은 내역은 그대로 남아요.`}
        confirmLabel="지우기"
        danger
        onConfirm={async () => {
          if (removing?.id != null) await payMethodRepo.remove(removing.id)
          setRemoving(null)
        }}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}

interface RowProps {
  method: PayMethod
  total?: AccountTotal
  savings: string[]
  first: boolean
  last: boolean
  onEdit: () => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}

function MethodRow({ method: m, total, savings, first, last, onEdit, onMove, onRemove }: RowProps) {
  const iconBtn = 'flex size-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-30'
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-slate-50 py-3 pr-2 pl-3.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-white text-xl shadow-card" aria-hidden>
        {PAY_KIND_EMOJI[m.kind]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-slate-800">{methodLabel(m)}</span>
        <span className="block text-xs text-slate-500">
          {total ? (
            <>
              이번 달 {total.expense > 0 && <b className="font-bold text-slate-700">-{formatWon(total.expense)}</b>}
              {total.income > 0 && <b className="ml-1 font-bold text-income">+{formatWon(total.income)}</b>} · {total.count}건
            </>
          ) : (
            '이번 달 기록 없음'
          )}
        </span>
        {savings.length > 0 && <span className="block text-xs font-semibold text-brand-600 break-keep">🐷 {savings.join(', ')} 납입이 여기서 나가요</span>}
      </span>
      <span className="flex shrink-0 items-center">
        <button type="button" className={iconBtn} disabled={first} onClick={() => onMove(-1)} aria-label={`${m.name} 위로`}>
          <ChevronUp className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} disabled={last} onClick={() => onMove(1)} aria-label={`${m.name} 아래로`}>
          <ChevronDown className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onEdit} aria-label={`${m.name} 고치기`}>
          <Pencil className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconBtn} onClick={onRemove} aria-label={`${m.name} 지우기`}>
          <Trash2 className="size-4" aria-hidden />
        </button>
      </span>
    </li>
  )
}

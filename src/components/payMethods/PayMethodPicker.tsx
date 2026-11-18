import { useLiveQuery } from 'dexie-react-hooks'
import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { ACCOUNT_PRESETS, MAX_ACCOUNT_LENGTH } from '../../lib/accounts'
import { methodEmoji, methodLabel, PAY_KIND_EMOJI, PAY_KIND_LABEL, groupMethods } from '../../lib/payMethods'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import { inputClass } from '../common/formStyles'
import PayMethodEditor from './PayMethodEditor'

interface Props {
  value: string
  onChange: (name: string) => void
  /** 칸 위 이름 */
  label?: string
}

/**
 * 어떤 카드 · 계좌로 썼는지 고르는 칸.
 * 등록한 카드 · 계좌를 종류별(카드 · 계좌 · 간편결제 · 현금)로 보여 주고, 여기서 바로 등록하거나 이름을 직접 쓸 수도 있다
 */
export default function PayMethodPicker({ value, onChange, label = '카드 · 계좌 (선택)' }: Props) {
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const used = useLiveQuery(() => transactionRepo.usedAccounts(), []) ?? []
  const [adding, setAdding] = useState(false)
  const [typing, setTyping] = useState(false)

  const groups = groupMethods(methods)
  const registered = new Set(methods.map((m) => m.name))
  // 등록 안 한 이름: 전에 쓴 것 (없으면 자주 쓰는 것 몇 개)
  const others = [...new Set([...used, ...(methods.length === 0 ? ['현금', '토스', '카카오페이'] : [])])].filter((a) => !registered.has(a)).slice(0, methods.length > 0 ? 4 : 6)
  if (value && !registered.has(value) && !others.includes(value)) others.unshift(value)

  const pick = (name: string) => onChange(value === name ? '' : name)

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <button type="button" onClick={() => setTyping((t) => !t)} className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
          <Pencil className="size-3.5" aria-hidden /> {typing ? '고르기' : '직접 쓰기'}
        </button>
      </div>

      {typing ? (
        <>
          <input
            value={value}
            list="tidy-accounts"
            maxLength={MAX_ACCOUNT_LENGTH}
            placeholder="예: 신한카드"
            onChange={(e) => onChange(e.target.value)}
            className={inputClass(false)}
            aria-label="결제 수단"
          />
          <datalist id="tidy-accounts">
            {[...new Set([...methods.map((m) => m.name), ...used, ...ACCOUNT_PRESETS])].map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </>
      ) : (
        <div className="space-y-2" role="group" aria-label="카드 · 계좌 고르기">
          {groups.map((g) => (
            <div key={g.kind} className="flex flex-wrap items-center gap-1.5">
              <span className="w-[4.5rem] shrink-0 text-[11px] font-bold text-slate-400">
                {PAY_KIND_EMOJI[g.kind]} {PAY_KIND_LABEL[g.kind]}
              </span>
              {g.items.map((m) => (
                <PickChip key={m.id} active={value === m.name} onClick={() => pick(m.name)}>
                  {methodLabel(m)}
                </PickChip>
              ))}
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-1.5">
            {groups.length > 0 && others.length > 0 && <span className="w-[4.5rem] shrink-0 text-[11px] font-bold text-slate-400">👛 그 밖에</span>}
            {others.map((a) => (
              <PickChip key={a} active={value === a} onClick={() => pick(a)}>
                {methodEmoji(a)} {a}
              </PickChip>
            ))}
            {!adding && (
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50"
              >
                <Plus className="size-3.5" aria-hidden /> 카드 · 계좌 등록
              </button>
            )}
          </div>
          {adding && (
            <PayMethodEditor
              name={value && !registered.has(value) ? value : undefined}
              onCancel={() => setAdding(false)}
              onSaved={(name) => {
                setAdding(false)
                onChange(name)
              }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function PickChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${active ? 'bg-grad on-grad' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  )
}

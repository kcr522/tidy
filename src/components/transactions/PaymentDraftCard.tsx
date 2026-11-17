import { Check, HelpCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import type { TransactionType } from '../../db/types'
import type { PaymentDraft } from '../../lib/assistant/learn'
import { categoriesFor, categoryEmoji } from '../../lib/categories'
import { formatDateLabel, formatNumber, formatTimeLabel, formatWon } from '../../lib/format'
import { isUnclearMerchant, matchMerchant } from '../../lib/merchants'
import { inputClass } from '../common/formStyles'
import MerchantAvatar from './MerchantAvatar'

/** 확인하고 저장할 결제 내역 한 줄 (은행·카드 캡처, 결제 알림에서 같이 쓴다) */
export interface DraftRow extends PaymentDraft {
  key: number
  checked: boolean
  /** "KCP*결제"처럼 모르는 가게일 때 사용자가 알려 준 이름 */
  realName: string
}

export type DraftPatch<R extends DraftRow = DraftRow> = Partial<R> | ((r: R) => Partial<R>)

/** 체크해서 고르고, 금액·카테고리·수입/지출·모르는 가게 이름을 고칠 수 있는 카드. note: 카드 아래 작은 글 (원래 알림 글 등) */
export default function PaymentDraftCard({ row, onChange, note }: { row: DraftRow; onChange: (p: DraftPatch) => void; note?: ReactNode }) {
  const { input } = row
  const brand = matchMerchant(row.realName || input.memo) ?? matchMerchant(row.display)
  const unclear = !row.realName && isUnclearMerchant(input.memo) && row.display === input.memo
  const setInput = (patch: Partial<typeof input>) => onChange((r) => ({ input: { ...r.input, ...patch } }))
  const setType = (type: TransactionType) => setInput({ type, category: categoriesFor(type).includes(input.category) ? input.category : '기타' })

  return (
    <li className={`rounded-2xl p-3 ring-1 transition ${row.checked ? 'bg-white ring-slate-200' : 'bg-slate-50 opacity-60 ring-transparent'}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={row.checked}
          aria-label={`${row.display} 저장`}
          onClick={() => onChange({ checked: !row.checked })}
          className={`flex size-6 shrink-0 items-center justify-center rounded-full ${row.checked ? 'bg-grad on-grad' : 'border-2 border-slate-300 bg-white'}`}
        >
          {row.checked && <Check className="size-3.5" strokeWidth={3.5} aria-hidden />}
        </button>
        <MerchantAvatar brand={brand?.brand ?? null} category={input.category} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-slate-800">{row.realName || brand?.display || row.display}</p>
          <p className="truncate text-xs text-slate-400">
            {formatDateLabel(input.date)}
            {input.time && <> · {formatTimeLabel(input.time)}</>}
            {input.account && <> · {input.account}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setType(input.type === 'EXPENSE' ? 'INCOME' : 'EXPENSE')}
          className={`shrink-0 text-[15px] font-bold ${input.type === 'INCOME' ? 'text-income' : 'text-slate-900'}`}
          title="눌러서 수입/지출 바꾸기"
        >
          {input.type === 'INCOME' ? '+' : '-'}
          {formatWon(input.amount)}
        </button>
      </div>

      {note}
      {row.duplicate && <p className="mt-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">이미 있는 내역일 수 있어요. 같으면 체크하지 마세요.</p>}
      {row.learned.length > 0 && <p className="mt-2 text-xs text-brand-600">{row.learned.join(' · ')}</p>}

      {row.checked && (
        <div className="mt-2.5 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={formatNumber(input.amount)}
            inputMode="numeric"
            aria-label="금액"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, '').slice(0, 9))
              if (n > 0) setInput({ amount: n })
            }}
            className={`${inputClass(false)} min-h-10 text-right text-sm`}
          />
          <select value={input.category} onChange={(e) => setInput({ category: e.target.value })} aria-label="카테고리" className={`${inputClass(false)} min-h-10 w-auto text-sm`}>
            {categoriesFor(input.type).map((c) => (
              <option key={c} value={c}>
                {categoryEmoji(c)} {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {row.checked && (unclear || row.realName) && (
        <div className="mt-2.5 rounded-xl bg-amber-50 p-2.5 ring-1 ring-amber-200">
          <p className="flex items-center gap-1 text-xs font-bold text-amber-900">
            <HelpCircle className="size-3.5" aria-hidden /> &lsquo;{input.memo}&rsquo;은(는) 어디서 결제했나요?
          </p>
          <input
            value={row.realName}
            onChange={(e) => onChange({ realName: e.target.value.slice(0, 50) })}
            placeholder="예: 무신사 (모르면 비워 두세요)"
            aria-label={`${input.memo} 실제 가게 이름`}
            className={`${inputClass(false)} mt-1.5 min-h-10 bg-white text-sm`}
          />
          <p className="mt-1 text-[11px] text-amber-800/80">알려 주면 다음에도 이 이름이 찍히면 그 가게로 보여 줘요.</p>
        </div>
      )}
    </li>
  )
}

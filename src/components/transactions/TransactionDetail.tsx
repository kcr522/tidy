import { CalendarDays, Clock, HelpCircle, Pencil, Receipt, Repeat, StickyNote, Store, Tag, Trash2, Wallet } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Transaction } from '../../db/types'
import { useLiveQuery } from 'dexie-react-hooks'
import { methodLabel, PAY_KIND_LABEL } from '../../lib/payMethods'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { CategoryIcon, MethodIcon } from '../common/MoneyIcon'
import { formatDateLabel, formatTimeLabel, formatWon } from '../../lib/format'
import { isUnclearMerchant, matchMerchant } from '../../lib/merchants'
import { inputClass } from '../common/formStyles'
import Button from '../common/Button'
import MerchantAvatar from './MerchantAvatar'

/** 내역 자세히 보기: 언제, 몇 시에, 어디서, 무엇으로 썼는지 */
interface Props {
  item: Transaction
  onEdit: () => void
  onDelete: () => void
  /** 모르는 결제처에 실제 가게를 알려 준다 */
  onResolve: (name: string, remember: boolean) => void
}

export default function TransactionDetail({ item, onEdit, onDelete, onResolve }: Props) {
  const m = matchMerchant(item.memo)
  const unclear = !item.originalMemo && isUnclearMerchant(item.memo)
  const income = item.type === 'INCOME'
  const methods = useLiveQuery(() => payMethodRepo.list(), []) ?? []
  const mine = item.account ? methods.find((x) => x.name === item.account) : undefined
  return (
    <div>
      <div className="flex flex-col items-center pt-1 pb-5 text-center">
        <MerchantAvatar brand={m?.brand ?? null} category={item.category} size={60} />
        <p className="mt-3 text-[15px] font-semibold text-slate-600">{m ? m.display : item.memo || item.category}</p>
        {item.note && <p className="mt-0.5 text-[13px] text-slate-500">{item.note}</p>}
        <p className={`mt-1 text-[30px] font-extrabold tracking-tight ${income ? 'text-income' : 'text-slate-900'}`}>
          {income ? '+' : '-'}
          {formatWon(item.amount)}
        </p>
      </div>

      {unclear && <AskMerchant original={item.memo} onResolve={onResolve} />}

      <dl className="divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4">
        <Row icon={<CalendarDays />} label="날짜" value={formatDateLabel(item.date)} />
        <Row icon={<Clock />} label="시간" value={item.time ? formatTimeLabel(item.time) : '기록 안 함'} muted={!item.time} />
        <Row icon={<Tag />} label="카테고리" value={
            <>
              <CategoryIcon category={item.category} /> {item.category}
            </>
          } />
        <Row
          icon={<Wallet />}
          label="카드 · 계좌"
          value={
            item.account ? (
              <>
                <MethodIcon name={item.account} methods={methods} /> {mine ? `${methodLabel(mine)} (${PAY_KIND_LABEL[mine.kind]})` : item.account}
              </>
            ) : (
              '기록 안 함'
            )
          }
          muted={!item.account}
        />
        {item.recurringId != null && <Row icon={<Repeat />} label="정기 내역" value="매달 자동으로 기록돼요" />}
        {item.memo && <Row icon={<Store />} label="가게 · 소비처" value={item.memo} />}
        {item.note && <Row icon={<StickyNote />} label="메모" value={item.note} />}
        {item.originalMemo && <Row icon={<Receipt />} label="찍힌 이름" value={item.originalMemo} muted />}
        <Row icon={<Clock />} label="기록한 때" value={new Date(item.createdAt).toLocaleString('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })} muted />
      </dl>

      <div className="mt-5 flex gap-2">
        <Button variant="secondary" className="text-expense" onClick={onDelete} aria-label="이 내역 삭제">
          <Trash2 className="size-4" aria-hidden /> 삭제
        </Button>
        <Button className="flex-1" onClick={onEdit}>
          <Pencil className="size-4" aria-hidden /> 수정
        </Button>
      </div>
    </div>
  )
}

function Row({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-3 text-[15px]">
      <span className="text-slate-400 [&>svg]:size-[18px]" aria-hidden>
        {icon}
      </span>
      <dt className="w-20 shrink-0 text-slate-500">{label}</dt>
      <dd className={`min-w-0 flex-1 text-right break-words ${muted ? 'text-slate-400' : 'font-semibold text-slate-800'}`}>{value}</dd>
    </div>
  )
}

/** "KCP*결제"처럼 어디서 썼는지 모를 때 물어본다 */
function AskMerchant({ original, onResolve }: { original: string; onResolve: (name: string, remember: boolean) => void }) {
  const [name, setName] = useState('')
  const [remember, setRemember] = useState(true)
  const hint = matchMerchant(name)

  function submit(e: FormEvent) {
    e.preventDefault()
    const v = name.trim().slice(0, 50)
    if (v) onResolve(v, remember)
  }

  return (
    <form onSubmit={submit} className="mb-4 rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
      <p className="flex items-center gap-1.5 text-[15px] font-bold text-amber-900">
        <HelpCircle className="size-[18px]" aria-hidden /> 어디서 결제했나요?
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-800/90">
        <b>{original}</b>은(는) 결제 대행사 이름이라 실제 가게를 알 수 없어요. 알려 주시면 그 이름으로 보여 드릴게요.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 무신사, 동네 꽃집"
          aria-label="실제 가게 이름"
          className={`${inputClass(false)} min-h-11 bg-white`}
        />
        <Button type="submit" className="min-h-11 shrink-0 px-4" disabled={!name.trim()}>
          알려 주기
        </Button>
      </div>
      {hint && <p className="mt-1.5 text-xs text-amber-800/80">목록에는 {hint.display} 로고와 함께 보여요</p>}
      <label className="mt-2.5 flex items-center gap-2 text-[13px] text-amber-900">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-amber-600" />
        다음에도 &lsquo;{original}&rsquo;(으)로 찍히면 이 가게로 보기
      </label>
    </form>
  )
}

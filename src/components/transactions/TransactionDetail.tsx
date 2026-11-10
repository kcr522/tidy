import { CalendarDays, Clock, Pencil, StickyNote, Tag, Trash2, Wallet } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Transaction } from '../../db/types'
import { accountEmoji } from '../../lib/accounts'
import { categoryEmoji } from '../../lib/categories'
import { formatDateLabel, formatTimeLabel, formatWon } from '../../lib/format'
import { matchMerchant } from '../../lib/merchants'
import Button from '../common/Button'
import MerchantAvatar from './MerchantAvatar'

/** 내역 자세히 보기: 언제, 몇 시에, 어디서, 무엇으로 썼는지 */
export default function TransactionDetail({ item, onEdit, onDelete }: { item: Transaction; onEdit: () => void; onDelete: () => void }) {
  const m = matchMerchant(item.memo)
  const income = item.type === 'INCOME'
  return (
    <div>
      <div className="flex flex-col items-center pt-1 pb-5 text-center">
        <MerchantAvatar brand={m?.brand ?? null} category={item.category} size={60} />
        <p className="mt-3 text-[15px] font-semibold text-slate-600">{m ? m.display : item.memo || item.category}</p>
        <p className={`mt-1 text-[30px] font-extrabold tracking-tight ${income ? 'text-income' : 'text-slate-900'}`}>
          {income ? '+' : '-'}
          {formatWon(item.amount)}
        </p>
      </div>

      <dl className="divide-y divide-slate-100 rounded-2xl bg-slate-50 px-4">
        <Row icon={<CalendarDays />} label="날짜" value={formatDateLabel(item.date)} />
        <Row icon={<Clock />} label="시간" value={item.time ? formatTimeLabel(item.time) : '기록 안 함'} muted={!item.time} />
        <Row icon={<Tag />} label="카테고리" value={`${categoryEmoji(item.category)} ${item.category}`} />
        <Row
          icon={<Wallet />}
          label="결제 수단"
          value={item.account ? `${accountEmoji(item.account)} ${item.account}` : '기록 안 함'}
          muted={!item.account}
        />
        {item.memo && <Row icon={<StickyNote />} label={m ? '가게 이름' : '메모'} value={item.memo} />}
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

function Row({ icon, label, value, muted = false }: { icon: ReactNode; label: string; value: string; muted?: boolean }) {
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

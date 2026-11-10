import type { Bookmark } from '../../db/types'
import { domainOf } from '../../lib/validate'
import DashboardCard, { CardEmpty } from './DashboardCard'

const MAX_ITEMS = 3

interface UnreadScrapCardProps {
  /** 안 읽은 스크랩, 최근 순 */
  unread: Bookmark[]
  /** 스크랩 id → 할 일 id */
  linked: Map<number, number>
  onAdd: () => void
  onOpen: (b: Bookmark) => void
  onConvert: (b: Bookmark) => void
  onViewTodo: () => void
}

/** 스크랩 카드: "읽지 않은 스크랩 (개수)", 최근 3개, [할 일로 전환] (FR-053) */
export default function UnreadScrapCard({ unread, linked, onAdd, onOpen, onConvert, onViewTodo }: UnreadScrapCardProps) {
  return (
    <DashboardCard to="/scraps" icon="🔖" title={`읽지 않은 스크랩 (${unread.length})`} addLabel="링크 저장" onAdd={onAdd}>
      {unread.length === 0 ? (
        <CardEmpty>안 읽은 스크랩이 없어요. 나중에 볼 링크를 + 로 저장해 보세요.</CardEmpty>
      ) : (
        <ul className="space-y-2">
          {unread.slice(0, MAX_ITEMS).map((b) => {
            const converted = b.id != null && linked.has(b.id)
            return (
              <li key={b.id} className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                <button type="button" onClick={() => onOpen(b)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-slate-800 hover:text-brand-700">{b.title}</p>
                  <p className="truncate text-xs text-slate-400">{domainOf(b.url)}</p>
                </button>
                {converted ? (
                  <button type="button" onClick={onViewTodo} className="tap shrink-0 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                    ✓ 할 일 보기
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onConvert(b)}
                    className="tap shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
                  >
                    할 일로 전환
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {unread.length > MAX_ITEMS && <p className="mt-2 text-center text-xs text-slate-400">외 {unread.length - MAX_ITEMS}개 더 있어요</p>}
    </DashboardCard>
  )
}

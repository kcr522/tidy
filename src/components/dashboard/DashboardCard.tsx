import { ChevronRight, Plus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface DashboardCardProps {
  to: string
  icon: LucideIcon
  title: ReactNode
  /** 빠른 추가(+) 버튼 이름, 예: "지출 추가" (FR-055) */
  addLabel: string
  onAdd: () => void
  /** 그라데이션 카드 (흰 글자) */
  vivid?: boolean
  children: ReactNode
}

/** 대시보드 카드 틀: 제목을 누르면 해당 화면으로 (FR-054), 오른쪽에 빠른 추가 (FR-055) */
export default function DashboardCard({ to, icon: Icon, title, addLabel, onAdd, vivid = false, children }: DashboardCardProps) {
  return (
    <section className={`flex flex-col rounded-3xl p-5 ${vivid ? 'bg-insta text-white shadow-float' : 'card'}`}>
      <div className="mb-4 flex items-center gap-2.5">
        <Link to={to} className="group flex min-w-0 flex-1 items-center gap-2.5 font-bold">
          <span className={`flex size-9 shrink-0 items-center justify-center rounded-2xl ${vivid ? 'bg-white/20' : 'bg-insta text-white'}`}>
            <Icon className="size-[18px]" strokeWidth={2.3} aria-hidden />
          </span>
          <span className="truncate text-[17px]">{title}</span>
          <ChevronRight className={`size-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${vivid ? 'text-white/70' : 'text-slate-400'}`} aria-hidden />
        </Link>
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          className={`tap flex size-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
            vivid ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-brand-50 text-brand-600 hover:bg-brand-100'
          }`}
        >
          <Plus className="size-5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>
      {children}
    </section>
  )
}

/** 카드 안의 빈 상태 안내 */
export function CardEmpty({ children, vivid = false }: { children: ReactNode; vivid?: boolean }) {
  return (
    <p
      className={`flex flex-1 items-center justify-center rounded-2xl px-4 py-6 text-center text-sm break-keep ${
        vivid ? 'bg-white/15 text-white/90' : 'bg-slate-50 text-slate-500'
      }`}
    >
      {children}
    </p>
  )
}

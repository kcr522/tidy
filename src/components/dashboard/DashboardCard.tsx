import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

interface DashboardCardProps {
  to: string
  icon: string
  title: ReactNode
  /** 빠른 추가(+) 버튼 이름, 예: "지출 추가" (FR-055) */
  addLabel: string
  onAdd: () => void
  children: ReactNode
}

/** 대시보드 카드 틀: 제목을 누르면 해당 화면으로 (FR-054), 오른쪽에 빠른 추가 (FR-055) */
export default function DashboardCard({ to, icon, title, addLabel, onAdd, children }: DashboardCardProps) {
  return (
    <section className="flex flex-col rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <div className="mb-3 flex items-center gap-2">
        <Link to={to} className="flex min-w-0 flex-1 items-center gap-2 font-semibold hover:text-brand-700">
          <span aria-hidden>{icon}</span>
          <span className="truncate">{title}</span>
          <span className="text-slate-400" aria-hidden>
            ›
          </span>
        </Link>
        <button
          type="button"
          onClick={onAdd}
          aria-label={addLabel}
          title={addLabel}
          className="tap flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700 hover:bg-brand-100"
        >
          +
        </button>
      </div>
      {children}
    </section>
  )
}

/** 카드 안의 빈 상태 안내 */
export function CardEmpty({ children }: { children: ReactNode }) {
  return <p className="flex flex-1 items-center justify-center rounded-xl bg-slate-50 px-4 py-6 text-center text-sm break-keep text-slate-500">{children}</p>
}

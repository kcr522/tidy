import { ChevronRight, Plus, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { themeFor } from '../layout/theme'

interface DashboardCardProps {
  to: string
  icon: LucideIcon
  title: ReactNode
  /** 빠른 추가(+) 버튼 이름, 예: "지출 추가" (FR-055) */
  addLabel: string
  onAdd: () => void
  /** true: 카드 전체가 그라데이션 / false: 제목 줄만 그라데이션 */
  vivid?: boolean
  children: ReactNode
}

/**
 * 대시보드 카드 틀: 제목을 누르면 해당 화면으로 (FR-054), 오른쪽에 빠른 추가 (FR-055)
 * 카드마다 그 구역의 그라데이션 색을 쓴다 (가계부: 하늘, 할 일: 민트, 스크랩: 핑크)
 */
export default function DashboardCard({ to, icon: Icon, title, addLabel, onAdd, vivid = false, children }: DashboardCardProps) {
  const header = (
    <div className="on-grad flex items-center gap-2.5">
      <Link to={to} className="group flex min-w-0 flex-1 items-center gap-2.5 font-bold">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-white/25">
          <Icon className="size-[18px]" strokeWidth={2.3} aria-hidden />
        </span>
        <span className="truncate text-[17px]">{title}</span>
        <ChevronRight className="size-4 shrink-0 text-white/80 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
      <button
        type="button"
        onClick={onAdd}
        aria-label={addLabel}
        title={addLabel}
        className="tap flex size-9 shrink-0 items-center justify-center rounded-full bg-white/25 text-white transition hover:bg-white/35 active:scale-95"
      >
        <Plus className="size-5" strokeWidth={2.6} aria-hidden />
      </button>
    </div>
  )

  if (vivid) {
    return (
      <section className={`${themeFor(to)} bg-grad on-grad flex flex-col rounded-3xl p-5 shadow-float`}>
        <div className="mb-4">{header}</div>
        {children}
      </section>
    )
  }
  return (
    <section className={`${themeFor(to)} card flex flex-col overflow-hidden`}>
      <div className="bg-grad px-5 py-4">{header}</div>
      <div className="flex flex-1 flex-col p-5 pt-4">{children}</div>
    </section>
  )
}

/** 카드 안의 빈 상태 안내 */
export function CardEmpty({ children, vivid = false }: { children: ReactNode; vivid?: boolean }) {
  return (
    <p
      className={`flex flex-1 items-center justify-center rounded-2xl px-4 py-6 text-center text-sm break-keep ${
        vivid ? 'bg-white/20 text-white' : 'bg-grad-soft text-slate-600'
      }`}
    >
      {children}
    </p>
  )
}

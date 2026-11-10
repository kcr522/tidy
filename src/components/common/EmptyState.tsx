import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: string
  title: string
  description?: string
  action?: ReactNode
}

/** 목록이 비었을 때 안내 (spec FR-008) */
export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center card px-6 py-14 text-center">
      <span className="mb-3 text-4xl" aria-hidden>
        {icon}
      </span>
      <p className="font-semibold text-slate-800">{title}</p>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

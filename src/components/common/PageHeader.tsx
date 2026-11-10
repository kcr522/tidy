import type { ReactNode } from 'react'

/** 페이지 제목 줄 */
export default function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-[26px] font-extrabold tracking-tight">{title}</h1>
      {action}
    </div>
  )
}

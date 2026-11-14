import type { ReactNode } from 'react'

/** 페이지 제목 줄 */
export default function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    // 좁은 창(분할 화면)에서는 버튼 줄이 제목 아래로 내려간다
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
      <h1 className="shrink-0 text-[26px] font-extrabold tracking-tight whitespace-nowrap">{title}</h1>
      {action}
    </div>
  )
}

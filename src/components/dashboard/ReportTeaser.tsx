import { CalendarCheck, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { prevMonth } from '../../lib/monthlyReport'

/** 매달 1~7일: 지난달 리포트 보러 가기 */
export default function ReportTeaser({ today }: { today: string }) {
  if (Number(today.slice(8, 10)) > 7) return null
  const ym = prevMonth(today.slice(0, 7))
  return (
    <Link to={`/report?m=${ym}`} className="card tap mb-4 flex items-center gap-3 p-4">
      <span className="bg-grad on-grad flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-float">
        <CalendarCheck className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-slate-900">{Number(ym.slice(5, 7))}월 돌아보기</span>
        <span className="block text-[13px] text-slate-500">지난달 쓴 돈, 끝낸 할 일, 습관을 정리했어요</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
    </Link>
  )
}

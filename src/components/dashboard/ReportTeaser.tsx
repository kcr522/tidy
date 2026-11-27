import { CalendarCheck, ChevronRight, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { teaserOf } from '../../lib/yearlyReport'

export default function ReportTeaser({ today }: { today: string }) {
  const t = teaserOf(today)
  if (!t) return null
  const icon: ReactNode = t.year ? <Sparkles className="size-5" aria-hidden /> : <CalendarCheck className="size-5" aria-hidden />
  return (
    <Link to={t.to} className="card tap mb-4 flex items-center gap-3 p-4">
      <span className="bg-grad on-grad flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-float">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-slate-900">{t.title}</span>
        <span className="block text-[13px] text-slate-500">{t.desc}</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-slate-300" aria-hidden />
    </Link>
  )
}

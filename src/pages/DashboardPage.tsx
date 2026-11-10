import { Link } from 'react-router-dom'
import PageHeader from '../components/common/PageHeader'
import { formatDateLabel } from '../lib/format'
import { todayKey } from '../lib/date'

/** 대시보드 — Day 5에 실제 데이터 연결 (spec US4) */
export default function DashboardPage() {
  return (
    <>
      <PageHeader title="대시보드" action={<span className="text-sm text-slate-500">{formatDateLabel(todayKey())}</span>} />
      {/* 폰: 세로 3단, 컴퓨터: 가로 3칸 */}
      <div className="grid gap-4 md:grid-cols-3">
        <DashboardCard to="/money" icon="💳" title="이번 달 가계부" hint="Day 2에 가계부를 만들면 여기에 이번 달 수입, 지출, 사용률이 보여요." />
        <DashboardCard to="/todos" icon="✅" title="오늘 할 일" hint="Day 3에 할 일을 만들면 여기에 오늘 할 일과 진행률이 보여요." />
        <DashboardCard to="/scraps" icon="🔖" title="읽지 않은 스크랩" hint="Day 4에 스크랩을 만들면 여기에 안 읽은 링크가 보여요." />
      </div>
    </>
  )
}

function DashboardCard({ to, icon, title, hint }: { to: string; icon: string; title: string; hint: string }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <Link to={to} className="mb-3 flex items-center gap-2 font-semibold hover:text-brand-700">
        <span aria-hidden>{icon}</span>
        {title}
        <span className="ml-auto text-slate-400" aria-hidden>
          ›
        </span>
      </Link>
      <p className="text-sm text-slate-500">{hint}</p>
    </section>
  )
}

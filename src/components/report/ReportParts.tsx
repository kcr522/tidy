import type { ReactNode } from 'react'

export function Card({ icon, title, children, className = '' }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 font-extrabold text-slate-900">
        <span className="text-brand-600">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function Num({ label, value, className = 'text-slate-900', icon }: { label: string; value: string; className?: string; icon?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-slate-50 px-3 py-2.5">
      <p className="flex items-center gap-1 text-xs text-slate-500">
        {icon}
        {label}
      </p>
      <p className={`mt-0.5 truncate font-bold tabular-nums ${className}`}>{value}</p>
    </div>
  )
}

/** 월간 | 연간 고르기 */
export function ReportKindSwitch({ kind, onChange }: { kind: 'month' | 'year'; onChange: (k: 'month' | 'year') => void }) {
  return (
    <div className="mb-3 flex justify-center">
      <div className="flex gap-1 rounded-2xl bg-slate-200/70 p-1" role="radiogroup" aria-label="리포트 기간">
        {(
          [
            ['month', '월간'],
            ['year', '연간'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={kind === key}
            onClick={() => onChange(key)}
            className={`flex min-h-10 min-w-20 items-center justify-center rounded-xl px-4 text-sm font-semibold ${kind === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

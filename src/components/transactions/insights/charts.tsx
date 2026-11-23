import { useState, type ReactNode } from 'react'
import { formatWon } from '../../../lib/format'

export interface Segment {
  key: string
  label: string
  value: number
  color: string
}

/**
 * 원형(도넛) 그래프. 조각을 누르면 가운데에 그 조각의 이름과 %가 나온다.
 * 조각 사이에는 2px 흰 틈을 둔다.
 */
export function DonutChart({
  segments,
  total,
  centerTitle,
  centerValue,
  ariaLabel,
}: {
  segments: Segment[]
  /** 100%가 되는 값 (기본: 조각 합계) */
  total?: number
  centerTitle: string
  centerValue: string
  ariaLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const sum = total ?? segments.reduce((s, x) => s + x.value, 0)
  const size = 200
  const stroke = 28
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const visible = segments.filter((s) => s.value > 0)
  const gap = visible.length > 1 ? 2 : 0
  const starts = visible.map((_, i) => visible.slice(0, i).reduce((t, x) => t + (Math.min(x.value, sum) / sum) * c, 0))
  const act = segments.find((s) => s.key === active)

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[200px]">
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" role="img" aria-label={ariaLabel}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-slate-100)" strokeWidth={stroke} />
        {sum > 0 &&
          visible.map((s, i) => {
            const len = (Math.min(s.value, sum) / sum) * c
            const dash = Math.max(len - gap, 0.5)
            const el = (
              <circle
                key={s.key}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.key ? stroke + 6 : stroke}
                strokeDasharray={`${dash} ${c - dash}`}
                strokeDashoffset={-starts[i]}
                className="cursor-pointer transition-[stroke-width]"
                style={{ opacity: active && active !== s.key ? 0.45 : 1 }}
                onClick={() => setActive(active === s.key ? null : s.key)}
                onMouseEnter={() => setActive(s.key)}
                onMouseLeave={() => setActive(null)}
              >
                <title>{`${s.label} ${formatWon(s.value)}`}</title>
              </circle>
            )
            return el
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
        <span className="text-xs font-semibold text-slate-500">{act ? act.label : centerTitle}</span>
        <span className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900">
          {act ? `${sum > 0 ? Math.round((act.value / sum) * 1000) / 10 : 0}%` : centerValue}
        </span>
        {act && <span className="text-[11px] font-medium text-slate-500">{formatWon(act.value)}</span>}
      </div>
    </div>
  )
}

/** 색 점 + 이름 + 금액 + % + 가로 막대 한 줄 (버튼 안에도 넣을 수 있게 span으로) */
export function ShareRow({
  color,
  label,
  amount,
  percent,
  sub,
}: {
  color: string
  label: ReactNode
  amount: number
  percent: number
  sub?: string
}) {
  return (
    <span className="block py-2.5">
      <span className="flex items-center gap-2.5">
        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-slate-800">
          {label}
          {sub && <span className="ml-1.5 text-xs font-medium text-slate-400">{sub}</span>}
        </span>
        <span className="text-[15px] font-bold text-slate-900">{formatWon(amount)}</span>
        <span className="w-12 text-right text-sm font-semibold text-slate-500">{percent}%</span>
      </span>
      <span className="mt-1.5 ml-5 block h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }} />
      </span>
    </span>
  )
}

export interface BarDatum {
  key: string
  label: string
  values: number[]
}

/**
 * 세로 막대 그래프. 같은 기준선, 끝만 둥글게.
 * values가 둘이면 나란히 (예: 수입·지출). 막대를 누르면 위에 금액이 나온다.
 */
export function BarChart({
  data,
  colors,
  names,
  selected,
  onSelect,
  ariaLabel,
}: {
  data: BarDatum[]
  colors: string[]
  names: string[]
  selected?: string
  onSelect?: (key: string) => void
  ariaLabel: string
}) {
  const [hover, setHover] = useState<string | null>(null)
  const max = Math.max(1, ...data.flatMap((d) => d.values))
  const focus = hover ?? selected
  const focused = data.find((d) => d.key === focus)

  return (
    <div role="img" aria-label={ariaLabel}>
      <div className="mb-2 flex min-h-5 items-center justify-between text-xs">
        {names.length > 1 ? (
          <div className="flex gap-3">
            {names.map((n, i) => (
              <span key={n} className="flex items-center gap-1 font-semibold text-slate-500">
                <span className="size-2 rounded-full" style={{ backgroundColor: colors[i] }} aria-hidden />
                {n}
              </span>
            ))}
          </div>
        ) : (
          <span />
        )}
        {focused && (
          <span className="font-semibold text-slate-600">
            {focused.label} ·{' '}
            {focused.values.map((v, i) => (
              <span key={i} className="font-bold text-slate-900">
                {i > 0 && ' / '}
                {formatWon(v)}
              </span>
            ))}
          </span>
        )}
      </div>
      <div className="relative flex h-40 items-end gap-1.5 border-b border-slate-200">
        {data.map((d) => {
          const isSel = d.key === selected
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onSelect?.(d.key)}
              onMouseEnter={() => setHover(d.key)}
              onMouseLeave={() => setHover(null)}
              aria-label={`${d.label} ${d.values.map(formatWon).join(', ')}`}
              aria-pressed={onSelect ? isSel : undefined}
              className={`flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-lg ${isSel ? 'bg-brand-50' : ''}`}
            >
              {d.values.map((v, i) => (
                <span
                  key={i}
                  className="w-full max-w-6 rounded-t-[4px] transition-[height]"
                  style={{
                    height: `${v > 0 ? Math.max((v / max) * 100, 2) : 0}%`,
                    backgroundColor: colors[i],
                    opacity: selected && !isSel && names.length === 1 ? 0.35 : 1,
                  }}
                />
              ))}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d) => (
          <span
            key={d.key}
            className={`flex-1 truncate text-center text-[11px] ${d.key === selected ? 'font-bold text-slate-900' : 'font-medium text-slate-400'}`}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/** 탭 모양 고르기 (주별/월별/연별 등) */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
  label: string
}) {
  return (
    <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          role="radio"
          aria-checked={value === key}
          onClick={() => onChange(key)}
          className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${value === key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

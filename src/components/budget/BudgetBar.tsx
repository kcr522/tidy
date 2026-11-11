import type { BudgetLine } from '../../lib/budget'
import { formatWon } from '../../lib/format'

const BAR: Record<BudgetLine['level'], string> = { ok: 'bg-brand-500', warn: 'bg-amber-400', over: 'bg-expense' }
const TEXT: Record<BudgetLine['level'], string> = { ok: 'text-brand-600', warn: 'text-amber-600', over: 'text-expense' }

/** 예산 막대 한 줄: 이름, 쓴 돈 / 예산, 남은 돈 */
export default function BudgetBar({ line, label, perDay, compact }: { line: BudgetLine; label: string; perDay?: number | null; compact?: boolean }) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className={`truncate font-semibold text-slate-700 ${compact ? 'text-sm' : 'text-[15px]'}`}>{label}</span>
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          <b className="text-slate-800">{formatWon(line.spent)}</b> / {formatWon(line.budget)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={`${label} 사용`} aria-valuenow={line.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full transition-all ${BAR[line.level]}`} style={{ width: `${Math.min(line.pct, 100)}%` }} />
      </div>
      <p className={`mt-1 text-xs font-semibold ${TEXT[line.level]}`}>
        {line.left >= 0 ? `${line.pct}% 썼어요 · ${formatWon(line.left)} 남았어요` : `${formatWon(-line.left)} 넘었어요 (${line.pct}%)`}
        {perDay != null && line.left > 0 && <span className="font-normal text-slate-500"> · 하루 {formatWon(perDay)}씩 쓸 수 있어요</span>}
      </p>
    </div>
  )
}

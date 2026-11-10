import { Check } from 'lucide-react'
import type { CSSProperties } from 'react'

/** 말랑한 조약돌 모양 (CSS 마스크로 잘라서 안쪽을 채운다) */
const PEBBLE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M20 2C30 2 36 6 37.5 13c1 4.6 1 9.4 0 14C36 34 30 38 20 38S4 34 2.5 27c-1-4.6-1-9.4 0-14C4 6 10 2 20 2z'/%3E%3C/svg%3E\")"

const MASK: CSSProperties = {
  maskImage: PEBBLE,
  WebkitMaskImage: PEBBLE,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
}

interface DayBlobProps {
  total: number
  done: number
  /** 지난 날인데 못 끝낸 일이 남았는지 */
  overdue?: boolean
  dim?: boolean
  className?: string
}

/**
 * 할 일 캘린더의 하루 칸 모양
 * - 할 일 없음: 옅은 회색
 * - 일부 끝냄: 끝낸 만큼 아래에서부터 차오른다
 * - 다 끝냄: 가득 차고 체크 표시
 */
export default function DayBlob({ total, done, overdue = false, dim = false, className = 'size-9' }: DayBlobProps) {
  const ratio = total > 0 ? done / total : 0
  const all = total > 0 && done === total
  return (
    <span className={`relative block shrink-0 ${dim ? 'opacity-40' : ''} ${className}`} aria-hidden>
      <span className={`absolute inset-0 overflow-hidden ${overdue ? 'bg-red-50' : total > 0 ? 'bg-slate-300' : 'bg-slate-200'}`} style={MASK}>
        {ratio > 0 && <span className="bg-check absolute inset-x-0 bottom-0 transition-[height] duration-300" style={{ height: `${ratio * 100}%` }} />}
      </span>
      {all && (
        <span className="absolute inset-0 flex items-center justify-center" style={{ color: 'var(--check-on, var(--on, #fff))' }}>
          <Check className="size-[55%]" strokeWidth={3.5} />
        </span>
      )}
      {!all && total > 0 && (
        <span className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${ratio >= 0.5 ? '' : overdue ? 'text-red-500' : 'text-slate-600'}`} style={ratio >= 0.5 ? { color: 'var(--check-on, var(--on, #fff))' } : undefined}>
          {total - done}
        </span>
      )}
    </span>
  )
}

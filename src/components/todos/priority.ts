import type { Priority } from '../../db/types'

/** 중요도 표시 (FR-025): 높음 빨강, 보통 주황, 낮음 회색 */
export const PRIORITY_LABEL: Record<Priority, { label: string; text: string; dot: string }> = {
  HIGH: { label: '높음', text: 'text-red-600', dot: 'bg-red-500' },
  MEDIUM: { label: '보통', text: 'text-orange-500', dot: 'bg-orange-400' },
  LOW: { label: '낮음', text: 'text-slate-500', dot: 'bg-slate-400' },
}

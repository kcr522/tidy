import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { parseDateKey } from './date'

/** 15000 → "15,000원" */
export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 15000 → "15,000" (입력 칸 표시용) */
export function formatNumber(amount: number): string {
  return amount.toLocaleString('ko-KR')
}

/** "2026-11-10" → "11월 10일 (화)" */
export function formatDateLabel(dateKey: string): string {
  return format(parseDateKey(dateKey), 'M월 d일 (EEE)', { locale: ko })
}

/** 2026, 11 → "2026년 11월" */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`
}

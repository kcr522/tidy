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

/** "14:05" → "오후 2:05" */
export function formatTimeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h < 12 ? '오전' : '오후'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${ampm} ${h12}:${String(m).padStart(2, '0')}`
}

/** 2026, 11 → "2026년 11월" */
export function formatMonthLabel(year: number, month: number): string {
  return `${year}년 ${month}월`
}

/** 받침이 있으면 '을', 없으면 '를' (월급을, 용돈을, 보너스를) */
export function eulReul(word: string): string {
  const code = word.trim().charCodeAt(word.trim().length - 1)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 === 0 ? '를' : '을'
  return '을(를)'
}

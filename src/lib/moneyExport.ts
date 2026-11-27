import { addMonths } from 'date-fns'
import type { Transaction } from '../db/types'
import { isSaving } from './categories'
import { parseDateKey, toDateKey } from './date'

/** 엑셀로 내보낼 기간 고르기 */
export type ExportRange = 'thisMonth' | 'lastMonth' | 'thisYear' | 'all' | 'custom'

export const EXPORT_RANGES: { key: ExportRange; label: string }[] = [
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난 달' },
  { key: 'thisYear', label: '올해' },
  { key: 'all', label: '전체' },
  { key: 'custom', label: '직접 고르기' },
]

/** 시작일 ~ 끝일 (둘 다 포함, YYYY-MM-DD). 빈 글자는 끝없음 */
export interface DateSpan {
  from: string
  to: string
}

/** 고른 기간을 날짜 범위로 바꾼다. 직접 고르기는 custom 값을 그대로 쓴다 */
export function spanOf(range: ExportRange, today: string, custom: DateSpan = { from: '', to: '' }): DateSpan {
  const d = parseDateKey(today)
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
  const lastDay = (start: Date) => toDateKey(new Date(addMonths(start, 1).getTime() - 86_400_000))
  if (range === 'thisMonth') return { from: toDateKey(monthStart), to: lastDay(monthStart) }
  if (range === 'lastMonth') {
    const start = addMonths(monthStart, -1)
    return { from: toDateKey(start), to: lastDay(start) }
  }
  if (range === 'thisYear') return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` }
  if (range === 'all') return { from: '', to: '' }
  // 거꾸로 고른 경우 (끝일이 시작일보다 앞) 서로 바꿔 준다
  if (custom.from && custom.to && custom.from > custom.to) return { from: custom.to, to: custom.from }
  return custom
}

export function inSpan(t: Pick<Transaction, 'date'>, span: DateSpan): boolean {
  return (!span.from || t.date >= span.from) && (!span.to || t.date <= span.to)
}

/** 기간 안 내역을 오래된 날 → 늦은 날, 같은 날은 시각 순으로 (엑셀에서 아래로 읽기 좋게) */
export function pickForExport(list: readonly Transaction[], span: DateSpan, withSaving: boolean): Transaction[] {
  return list
    .filter((t) => inSpan(t, span) && (withSaving || !isSaving(t)))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.createdAt.localeCompare(b.createdAt))
}

export const CSV_HEADER = ['날짜', '시각', '구분', '카테고리', '내용', '결제 수단', '금액'] as const

export function kindLabel(t: Transaction): '수입' | '지출' | '저축' {
  if (isSaving(t)) return '저축'
  return t.type === 'INCOME' ? '수입' : '지출'
}

/**
 * 칸 하나를 CSV 글자로. 쉼표 · 따옴표 · 줄바꿈이 있으면 따옴표로 감싼다.
 * =, +, -, @ 로 시작하는 글자는 엑셀이 수식으로 읽지 않게 앞에 ' 를 붙인다 (숫자 칸은 그대로)
 */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value)
  let text = value
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** 엑셀이 한글을 깨지지 않게 읽도록 맨 앞에 붙이는 표시 (UTF-8 BOM) */
export const BOM = '﻿'

/** 내역을 엑셀에서 바로 열리는 CSV 글자로 (BOM + 머리줄 + 한 줄에 내역 하나, 줄 끝은 CRLF) */
export function toCsv(list: readonly Transaction[]): string {
  const rows = list.map((t) => [t.date, t.time ?? '', kindLabel(t), t.category, t.memo, t.account ?? '', t.amount])
  return BOM + [CSV_HEADER as readonly (string | number)[], ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** 파일 이름: 가계부_2026-11.csv, 가계부_2026.csv, 가계부_전체.csv, 가계부_2026-11-01_2026-11-15.csv */
export function exportFileName(range: ExportRange, span: DateSpan): string {
  if (range === 'thisMonth' || range === 'lastMonth') return `가계부_${span.from.slice(0, 7)}.csv`
  if (range === 'thisYear') return `가계부_${span.from.slice(0, 4)}.csv`
  if (!span.from && !span.to) return '가계부_전체.csv'
  return `가계부_${span.from || '처음'}_${span.to || '오늘까지'}.csv`
}

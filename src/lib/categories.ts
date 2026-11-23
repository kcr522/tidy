import type { Transaction, TransactionType } from '../db/types'

/** 기본 카테고리 (spec FR-013) */
export const EXPENSE_CATEGORIES = [
  '식비',
  '교통',
  '쇼핑',
  '문화/여가',
  '주거/통신',
  '의료/건강',
  '교육',
  '저축',
  '기타',
] as const

export const INCOME_CATEGORIES = ['월급', '용돈', '부수입', '기타'] as const

export function categoriesFor(type: TransactionType): readonly string[] {
  return type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
}

export function isValidCategory(type: TransactionType, category: string): boolean {
  return categoriesFor(type).includes(category)
}

/** 카테고리 아이콘 (목록에서 동그라미 안에 보여 준다) */
const CATEGORY_EMOJI: Record<string, string> = {
  식비: '🍚',
  교통: '🚇',
  쇼핑: '🛍️',
  '문화/여가': '🎬',
  '주거/통신': '🏠',
  '의료/건강': '💊',
  교육: '📚',
  저축: '🐷',
  월급: '💰',
  용돈: '🎁',
  부수입: '✨',
  기타: '📦',
}

export function categoryEmoji(category: string): string {
  return CATEGORY_EMOJI[category] ?? '📦'
}

// ───────────── 저축 ─────────────

/** 저축 카테고리: 지출로 세지 않고 따로 모은다 (사용자 요청 2026-11-23) */
export const SAVING_CATEGORY = '저축'

/** 저축으로 넣은 돈인가: 지출 쪽에 적었어도 카테고리가 저축이거나 적금에서 자동으로 적힌 것 */
export function isSaving(t: Pick<Transaction, 'type' | 'category'> & { savingsId?: number }): boolean {
  return t.type === 'EXPENSE' && (t.category === SAVING_CATEGORY || t.savingsId != null)
}

/** 진짜 쓴 돈인가 (저축은 빼고) */
export function isSpending(t: Pick<Transaction, 'type' | 'category'> & { savingsId?: number }): boolean {
  return t.type === 'EXPENSE' && !isSaving(t)
}

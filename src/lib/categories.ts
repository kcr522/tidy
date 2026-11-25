import type { MoneyCategory, Transaction, TransactionType } from '../db/types'

/** 처음부터 있는 기본 카테고리 (spec FR-013). 이름을 바꾸거나 지울 수 있어서 지금 목록은 categoriesFor 로 본다 */
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

/** 기본 카테고리 아이콘 이름 (MoneyIcon 의 CATEGORY_ICONS 키) */
export const DEFAULT_CATEGORY_ICON: Record<string, string> = {
  식비: 'utensils',
  교통: 'train',
  쇼핑: 'bag',
  '문화/여가': 'clapper',
  '주거/통신': 'house',
  '의료/건강': 'pill',
  교육: 'book',
  저축: 'piggy',
  월급: 'banknote',
  용돈: 'gift',
  부수입: 'sparkles',
  기타: 'package',
}

/** 저축 카테고리: 지출로 세지 않고 따로 모은다 (사용자 요청 2026-11-23) */
export const SAVING_CATEGORY = '저축'

/** 카테고리를 지우면 그 내역이 옮겨 가는 곳 (지울 수 없다) */
export const OTHER_CATEGORY = '기타'
/** 카테고리 이름 최대 글자 수 */
export const MAX_CATEGORY_NAME = 10

// ───────────── 내가 만든 · 바꾼 카테고리 (스키마 13) ─────────────

export interface CategoryItem {
  key: string
  type: TransactionType
  name: string
  icon: string
  order: number
  /** 처음부터 있던 카테고리 (이름을 바꿔도 처음 이름은 key 에 남는다) */
  builtIn: boolean
  /** 기타 · 저축: 이름을 바꾸거나 지울 수 없다 (내역을 옮겨 받는 곳 · 저축 계산에 쓴다) */
  fixed: boolean
}

const defaultsOf = (type: TransactionType): readonly string[] => (type === 'INCOME' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)

/** 기본 카테고리의 key: '구분:처음 이름' */
export const defaultKey = (type: TransactionType, name: string) => `${type}:${name}`

const isFixedName = (type: TransactionType, name: string) => name === OTHER_CATEGORY || (type === 'EXPENSE' && name === SAVING_CATEGORY)

/** 기본 카테고리 + 저장한 것(이름 · 아이콘 · 순서 바꿈, 지움, 새로 만듦)을 합친 목록 (순서대로) */
export function buildCategories(type: TransactionType, rows: readonly MoneyCategory[]): CategoryItem[] {
  const saved = new Map(rows.filter((r) => r.type === type).map((r) => [r.key, r]))
  const list: CategoryItem[] = []
  defaultsOf(type).forEach((name, i) => {
    const key = defaultKey(type, name)
    const row = saved.get(key)
    saved.delete(key)
    if (row?.hidden) return
    const fixed = isFixedName(type, name)
    list.push({ key, type, name: fixed ? name : (row?.name ?? name), icon: row?.icon ?? DEFAULT_CATEGORY_ICON[name] ?? 'package', order: row?.order ?? i, builtIn: true, fixed })
  })
  for (const row of saved.values()) {
    if (row.hidden) continue
    list.push({ key: row.key, type, name: row.name, icon: row.icon, order: row.order, builtIn: false, fixed: false })
  }
  return list.sort((a, b) => a.order - b.order || (a.key < b.key ? -1 : 1))
}

// 앱 전체가 함께 보는 지금 목록. 저장소(moneyCategoryRepo)가 DB 가 바뀔 때마다 넣어 준다
let current = { EXPENSE: buildCategories('EXPENSE', []), INCOME: buildCategories('INCOME', []) }
const listeners = new Set<() => void>()

export function setCategoryRows(next: readonly MoneyCategory[]) {
  current = { EXPENSE: buildCategories('EXPENSE', next), INCOME: buildCategories('INCOME', next) }
  listeners.forEach((l) => l())
}

export function subscribeCategories(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

/** 바뀔 때마다 새 값 (React useSyncExternalStore 용) */
export const categorySnapshot = () => current

export function categoryItems(type: TransactionType): CategoryItem[] {
  return current[type]
}

export function categoriesFor(type: TransactionType): readonly string[] {
  return current[type].map((c) => c.name)
}

export function isValidCategory(type: TransactionType, category: string): boolean {
  return categoriesFor(type).includes(category)
}

/** 이름으로 카테고리 찾기 (지출 쪽 먼저) */
export function findCategory(name: string, type?: TransactionType): CategoryItem | undefined {
  const pick = (t: TransactionType) => current[t].find((c) => c.name === name)
  return type ? pick(type) : (pick('EXPENSE') ?? pick('INCOME'))
}

/** 기본 이름(가게 목록 · AI 가 고른 '식비' 등)을 지금 쓰는 이름으로. 지웠으면 기타 */
export function resolveCategory(type: TransactionType, name: string): string {
  const list = current[type]
  if (list.some((c) => c.name === name)) return name
  const renamed = list.find((c) => c.key === defaultKey(type, name))
  return renamed?.name ?? OTHER_CATEGORY
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
  const key = findCategory(category)?.key
  const first = key ? key.slice(key.indexOf(':') + 1) : category
  return CATEGORY_EMOJI[category] ?? CATEGORY_EMOJI[first] ?? '📦'
}

// ───────────── 저축 ─────────────


/** 저축으로 넣은 돈인가: 지출 쪽에 적었어도 카테고리가 저축이거나 적금에서 자동으로 적힌 것 */
export function isSaving(t: Pick<Transaction, 'type' | 'category'> & { savingsId?: number }): boolean {
  return t.type === 'EXPENSE' && (t.category === SAVING_CATEGORY || t.savingsId != null)
}

/** 진짜 쓴 돈인가 (저축은 빼고) */
export function isSpending(t: Pick<Transaction, 'type' | 'category'> & { savingsId?: number }): boolean {
  return t.type === 'EXPENSE' && !isSaving(t)
}

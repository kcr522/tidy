// 데이터 타입 정의 — specs/001-tidy-mvp/data-model.md 기준

/** IndexedDB 인덱스에 쓰기 위해 불리언은 0/1 숫자로 저장한다. */
export type Flag = 0 | 1

export type TransactionType = 'INCOME' | 'EXPENSE'
export type Priority = 'HIGH' | 'MEDIUM' | 'LOW'

/** 가계부 내역 */
export interface Transaction {
  id?: number
  type: TransactionType
  /** 정수, 1 ~ 999,999,999 */
  amount: number
  category: string
  /** YYYY-MM-DD */
  date: string
  memo: string
  /** 쓴 시각 HH:mm (2차, 없을 수 있음) */
  time?: string
  /** 결제 수단: 계좌, 카드, 앱 이름 (2차, 없을 수 있음) */
  account?: string
  /** 정기 내역 규칙으로 자동 기록된 경우 그 규칙 id */
  recurringId?: number
  /** 사용자가 실제 가게를 알려 주기 전 원래 이름 (예: KCP*결제) */
  originalMemo?: string
  createdAt: string
  updatedAt: string
}

/** 정기 내역 규칙: 매달 같은 날 자동으로 기록한다 (2차) */
export interface Recurring {
  id?: number
  type: TransactionType
  amount: number
  category: string
  /** 목록에 보일 이름 (예: 넷플릭스, 월급) */
  memo: string
  account?: string
  /** 매달 며칠 (1~31, 그 달에 없는 날이면 말일) */
  day: number
  /** 이날부터 기록 (YYYY-MM-DD) */
  startDate: string
  /** 마지막으로 기록한 날짜 (YYYY-MM-DD) */
  lastDate: string | null
  isActive: Flag
  createdAt: string
  updatedAt: string
}

/** 알려 준 가게 이름: 카드사에 이 이름으로 찍히면 이 가게로 보여 준다 (2차) */
export interface MerchantAlias {
  /** 원래 이름을 normalizeName 한 값 */
  raw: string
  /** 원래 이름 (화면 표시용) */
  original: string
  /** 실제 가게 이름 */
  name: string
  createdAt: string
}

/** 할 일 */
export interface Todo {
  id?: number
  title: string
  isCompleted: Flag
  completedAt: string | null
  /** YYYY-MM-DD 또는 없음 */
  dueDate: string | null
  priority: Priority
  /** 스크랩에서 전환된 경우 그 스크랩의 id (1:1) */
  bookmarkId?: number
  createdAt: string
  updatedAt: string
}

/** 스크랩 */
export interface Bookmark {
  id?: number
  url: string
  title: string
  memo: string
  isRead: Flag
  createdAt: string
  updatedAt: string
}

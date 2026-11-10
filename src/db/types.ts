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
  /** 적금 납입으로 기록된 경우 그 적금 id */
  savingsId?: number
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

/** 일정 색 (캘린더 막대 색) */
export type EventColor = 'pink' | 'orange' | 'blue' | 'green' | 'purple' | 'red'

/** 캘린더 일정: 하루짜리도, 여러 날에 걸친 기간도 된다 (2차) */
export interface CalendarEvent {
  id?: number
  title: string
  /** 시작 날짜 YYYY-MM-DD */
  startDate: string
  /** 끝 날짜 YYYY-MM-DD (하루짜리면 startDate와 같다) */
  endDate: string
  color: EventColor
  memo: string
  createdAt: string
  updatedAt: string
}

/** 일기: 하루에 하나 (2차) */
export interface Diary {
  /** YYYY-MM-DD (하루 하나라서 날짜가 곧 키) */
  date: string
  text: string
  /** 사진 (작게 줄인 JPEG data URL). 없으면 캘린더에 색으로만 표시 */
  photo?: string
  /** 사진이 없을 때 캘린더에 칠할 색 (쓸 때 아무거나 하나 고른다) */
  color: string
  createdAt: string
  updatedAt: string
}

/** 습관: 매일 체크하는 반복 목표 (2차) */
export interface Habit {
  id?: number
  /** 예: 물 2L 마시기 */
  title: string
  /** 목록에 보일 이모지 하나 */
  emoji: string
  /** 목록 순서 (작을수록 위) */
  order: number
  /** 적금이 만든 습관이면 그 적금 id */
  savingsId?: number
  /** 매일이 아닌 습관(적금 넣는 날 등). 없으면 매일 */
  schedule?: Schedule
  createdAt: string
  updatedAt: string
}

/** 습관 체크: 그 습관을 그날 했다는 기록. 기록이 있으면 한 날, 없으면 안 한 날 */
export interface HabitCheck {
  habitId: number
  /** YYYY-MM-DD */
  date: string
  createdAt: string
}

/** 반복 주기: 매일 / 매주 (요일) / 매달 (날짜) */
export type Freq = 'daily' | 'weekly' | 'monthly'

export interface Schedule {
  freq: Freq
  /** freq = weekly: 0(일) ~ 6(토) */
  weekday?: number
  /** freq = monthly: 1~31 (그 달에 없는 날이면 말일) */
  day?: number
}

/** 이자 계산 방식: 단리 / 월복리 */
export type InterestType = 'simple' | 'compound'

/** 이자 세금: 일반 15.4% / 세금우대 9.5% / 비과세 0% */
export type TaxType = 'normal' | 'preferential' | 'free'

/** 적금 (2차) */
export interface SavingsPlan {
  id?: number
  /** 예: 청년도약계좌, 26주 적금 */
  name: string
  /** 은행 이름 (선택) */
  bank?: string
  /** 한 번에 넣는 돈 */
  amount: number
  /** 가입일 = 첫 납입일 (YYYY-MM-DD) */
  startDate: string
  /** 만기일 (YYYY-MM-DD). 이날 원금 + 이자를 받는다 */
  endDate: string
  /** 연 이율 % (우대금리 포함, 예: 3.5) */
  rate: number
  interestType: InterestType
  taxType: TaxType
  /** 넣는 날 */
  schedule: Schedule
  /** 1: 자동이체라 넣는 날 가계부에 자동 기록 / 0: 습관을 체크하면 기록 */
  autoDeposit: Flag
  /** 알림 켜짐 */
  alarmOn: Flag
  /** 알림 시각 HH:mm */
  alarmTime: string
  /** 같이 만든 습관 id */
  habitId?: number
  /** 마지막으로 자동 기록한 날짜 */
  lastDate: string | null
  memo: string
  createdAt: string
  updatedAt: string
}

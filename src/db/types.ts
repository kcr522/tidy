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
  /** 할 일 카테고리 (없으면 '기본'). 스키마 8부터 */
  categoryId?: number
  /** 알림 시각 HH:mm (마감일 그날 이 시각에 울린다). 없으면 알림 없음 */
  remindAt?: string
  /** 반복: 끝내면 다음 날짜로 새 할 일이 생긴다 (마감일이 있을 때만) */
  repeat?: TodoRepeat
  /** 반복 할 일을 끝내서 생긴 다음 할 일 id (완료를 되돌리면 지운다) */
  repeatNextId?: number
  createdAt: string
  updatedAt: string
}

/**
 * 할 일 반복
 * - day: 매일
 * - week: 매주 days 요일 (0 일요일 ~ 6 토요일)
 * - month: 매달 day일 (그 달에 없으면 말일)
 */
export type TodoRepeat = { every: 'day' } | { every: 'week'; days: number[] } | { every: 'month'; day: number }

/** 할 일 카테고리 색 */
export type TodoCategoryColor = 'peach' | 'sky' | 'mint' | 'lilac' | 'lemon' | 'rose'

/** 할 일 카테고리 (스키마 8부터): 할 일 캘린더 아래 묶음 */
export interface TodoCategory {
  id?: number
  name: string
  color: TodoCategoryColor
  /** 보여 줄 순서 */
  order: number
  createdAt: string
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
  /** 스크랩 카테고리 (없으면 '미분류'). 스키마 5부터 */
  categoryId?: number
  /** 어디 링크인지: instagram | naver | x | youtube | web */
  source?: string
  /** 링크 미리보기: 설명, 사이트 이름, 동영상 게시물인지 */
  description?: string
  siteName?: string
  isVideo?: Flag
  /** AI(또는 기본) 요약과 만든 때 */
  summary?: string
  summaryAt?: string
}

/** 스크랩 카테고리 (스키마 5부터) */
export interface ScrapCategory {
  id?: number
  name: string
  /** 보여 줄 순서 */
  order: number
  createdAt: string
}

/**
 * 스크랩에 붙은 사진·영상 (스키마 5부터)
 * - thumb: 링크 미리보기 썸네일 (인스타 이미지 주소는 금방 만료돼서 받아서 저장한다)
 * - capture: 사용자가 같이 저장한 캡처(사진) 또는 화면 녹화(영상)
 */
export interface ScrapMedia {
  id?: number
  bookmarkId: number
  kind: 'thumb' | 'capture'
  /** 지금 보여 줄 파일 (편집했으면 편집본) */
  blob: Blob
  /** 편집하기 전 원본. 편집한 적 없으면 없다 */
  original?: Blob
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
/** 일기 사진 한 장: 언제 찍었는지와 한 줄 메모 */
export interface DiaryPhoto {
  /** 작게 줄인 JPEG data URL */
  src: string
  /** HH:mm (찍은 시간). 모르면 없음 */
  time?: string
  note?: string
}

export interface Diary {
  /** YYYY-MM-DD (하루 하나라서 날짜가 곧 키) */
  date: string
  text: string
  /** 대표 사진 (작게 줄인 JPEG data URL, photos 의 첫 장). 없으면 캘린더에 색으로만 표시 */
  photo?: string
  /** 사진 여러 장 (최대 10장, 시간 순서). 예전 일기에는 없다 */
  photos?: DiaryPhoto[]
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

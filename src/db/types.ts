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
  /** 가게 이름 · 소비처 (예: 다이소 운남점, 쿠팡, 엄마) */
  memo: string
  /** 따로 적는 메모 (예: 점심, 친구랑 반띵). 없을 수 있음 (사용자 요청 2026-11-25) */
  note?: string
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
  /** 1이면 금액이 매달 달라서 그날마다 물어본다 (amount는 0으로 둔다) */
  askAmount?: Flag
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
  /** 메모·참고 글 (목록에서 제목 아래 작게 보인다) */
  memo?: string
  /** 참고 사진·파일 (목록에서 작은 그림으로 보인다). data URL 로 기록 안에 넣는다 */
  attachments?: Attachment[]
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

/** 한 달 예산 (스키마 9부터). 매달 똑같이 적용된다 */
export interface Budget {
  /** 지출 카테고리 이름. '' 이면 한 달 전체 예산 */
  category: string
  /** 원, 1 이상 */
  amount: number
  updatedAt: string
}

/**
 * 가계부 카테고리 (스키마 13부터, 사용자 요청 2026-11-25: 직접 만들고 지우기)
 * 기본 카테고리는 코드에 있고, 바꾼 것(이름 · 아이콘 · 순서 · 지움)과 새로 만든 것만 여기에 적는다.
 * 기본 카테고리의 key 는 '구분:처음 이름' (예: 'EXPENSE:식비') 이라서 여러 기기에서 겹쳐도 하나로 합쳐진다
 */
export interface MoneyCategory {
  key: string
  type: TransactionType
  /** 내역의 category 칸에 들어가는 이름 */
  name: string
  /** 아이콘 이름 (components/common/MoneyIcon 의 목록) */
  icon: string
  /** 보여 줄 순서 (작을수록 앞) */
  order: number
  /** 1이면 지운 기본 카테고리 */
  hidden?: Flag
  createdAt: string
  updatedAt: string
}

/** 할 일 카테고리 색 */
export type TodoCategoryColor = 'peach' | 'sky' | 'mint' | 'lilac' | 'lemon' | 'rose'

/** 결제 수단 종류: 카드 / 계좌(은행) / 간편결제 / 현금 */
export type PayMethodKind = 'card' | 'account' | 'pay' | 'cash'

/** 내 카드 · 계좌 (스키마 12부터). 내역에는 이름(Transaction.account)으로 이어진다 */
export interface PayMethod {
  id?: number
  /** 내역의 결제 수단 칸에 들어가는 이름 (예: 신한 체크, 국민 월급통장) */
  name: string
  kind: PayMethodKind
  /** 카드 번호 · 계좌 번호 끝 4자리 (알림에서 찾을 때 쓴다) */
  last4?: string
  /** 보여 줄 순서 */
  order: number
  createdAt: string
  updatedAt: string
}

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
/** 일정 색 이름 (처음 6개는 원래 있던 색) */
export type PresetEventColor =
  | 'pink' | 'orange' | 'blue' | 'green' | 'purple' | 'red'
  | 'coral' | 'yellow' | 'lime' | 'mint' | 'teal' | 'sky' | 'navy' | 'indigo' | 'lavender' | 'magenta' | 'rose' | 'brown' | 'olive' | 'gray' | 'black'
/** 일정 색: 이름이 있는 색이거나, 직접 고른 색 (#rrggbb) */
export type EventColor = PresetEventColor | `#${string}`

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
  /**
   * 구글 캘린더에서 가져온 일정이면 'google', 폰 캘린더(삼성 캘린더)에서 가져온 일정이면 'device'.
   * 둘 다 Tidy 에서 고칠 수 없고, 새로 가져올 때마다 바뀐다
   */
  source?: 'google' | 'device'
  /** 구글 캘린더를 여러 개 연결했을 때 어느 캘린더인지 (인덱스 아님). 폰 캘린더는 'd:기기:캘린더번호' */
  calId?: string
  /** 가져온 일정의 원래 id */
  uid?: string
  /** 메모에 붙인 사진·파일 (최대 10개) */
  attachments?: Attachment[]
  createdAt: string
  updatedAt: string
}

/** 일정 메모·일기에 붙인 사진이나 파일 (PDF, 문서, GIF 등) */
export interface Attachment {
  /** 파일 이름 (예: 영수증.pdf) */
  name: string
  /** MIME 종류 (예: application/pdf, image/gif) */
  type: string
  /** 바이트 수 */
  size: number
  /** 파일 내용 data URL (백업·동기화가 그대로 되게 글자로 둔다) */
  src: string
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

/** 시간별 일기의 한 칸: 그 시간(0~23시)에 있었던 일 (사용자 요청 2026-11-18) */
export interface DiaryHour {
  /** 0~23 */
  hour: number
  /** 꾸밈을 뺀 글자 (검색 · 미리보기) */
  text: string
  /** 꾸민 글 (형광펜 · 글머리 기호 · 기울임 · 글 크기 · 글 색 · 손글씨 그림). 메모와 같은 모양 (src/lib/richText.ts) */
  html?: string
  /** 글 사이 사진 · 손글씨 그림 (html 의 <img data-pic="id"> 자리) */
  pics?: MemoPic[]
}

export interface Diary {
  /** YYYY-MM-DD (하루 하나라서 날짜가 곧 키) */
  date: string
  text: string
  /** 대표 사진 (작게 줄인 JPEG data URL, photos 의 첫 장). 없으면 캘린더에 색으로만 표시 */
  photo?: string
  /** 사진 여러 장 (최대 10장, 시간 순서). 예전 일기에는 없다 */
  photos?: DiaryPhoto[]
  /** 붙인 파일 (PDF, 문서 등, 최대 10개) */
  attachments?: Attachment[]
  /** 시간별 기록 (1시간에 한 칸, 시간 순서). 예전 일기에는 없다 */
  hours?: DiaryHour[]
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
  /** 돈이 나가는 내 계좌 (선택, 내 카드 · 계좌의 이름). 납입 내역의 결제 수단 칸에 들어간다 */
  fromAccount?: string
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

/** 달력 날짜 칸에 붙이는 이모티콘 스티커 (스키마 10부터, 하루에 하나) */
export interface DaySticker {
  /** YYYY-MM-DD */
  date: string
  emoji: string
  updatedAt: string
}

/** 메모 파일집 (스키마 11부터): 비슷한 메모끼리 모아 두는 폴더. 색을 고를 수 있다 */
export interface MemoFolder {
  id?: number
  name: string
  /** #rrggbb */
  color: string
  /** 보여 줄 순서 */
  order: number
  createdAt: string
}

/** 메모에 손으로 쓴 한 장 (사용자 요청 2026-11-17) */
export interface MemoInk {
  /** 흰 바탕 PNG data URL */
  src: string
  /** AI 가 읽은 글자 (검색에 쓴다). 아직 못 읽었으면 없음, 읽었는데 글자가 없으면 빈 글자 */
  text?: string
  /** 쓴 시각 (ISO) */
  at: string
}

/** 메모 (스키마 11부터): 글 + 사진·영상·파일. 쓴 시각(createdAt)이 그대로 남아 시간순으로 보인다 */
/** 메모 글 사이에 넣은 사진 (크기 · 자르기는 html 쪽 / src 쪽에 남는다) */
export interface MemoPic {
  id: string
  /** 사진 data URL (자르면 자른 사진으로 바뀐다) */
  src: string
}

export interface Memo {
  id?: number
  title: string
  text: string
  /** 들어 있는 파일집. 없으면 파일집 밖 */
  folderId?: number
  /** 사진·영상·파일 (최대 10개) */
  attachments?: Attachment[]
  /** 손글씨 (최대 10장, 쓴 순서) */
  ink?: MemoInk[]
  /** 꾸민 글 (굵게 · 밑줄 · 형광펜 · 글머리 기호 · 글 사이 사진). 없으면 text 가 그대로 본문. text 는 이것에서 꾸밈을 뺀 글자 */
  html?: string
  /** 글 사이 사진 (html 의 <img data-pic="id"> 자리에 들어간다) */
  pics?: MemoPic[]
  /** 1이면 맨 위에 고정 */
  pinned?: 0 | 1
  /** 처음 쓴 시각 (ISO) */
  createdAt: string
  updatedAt: string
}

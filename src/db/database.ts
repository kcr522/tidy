import Dexie, { type Table } from 'dexie'
import type { Budget, DaySticker, Bookmark, CalendarEvent, Diary, Habit, HabitCheck, Memo, MemoFolder, MerchantAlias, MoneyCategory, PayMethod, Recurring, SavingsPlan, ScrapCategory, ScrapMedia, Todo, TodoCategory, Transaction } from './types'

/**
 * Tidy 로컬 DB (IndexedDB)
 * 브라우저, 폰 앱(Capacitor), 컴퓨터 PWA 모두 같은 DB를 쓴다.
 * 스키마를 바꿀 때는 version(2)를 새로 추가한다. 기존 version(1)은 지우지 않는다.
 */
export class TidyDB extends Dexie {
  transactions!: Table<Transaction, number>
  todos!: Table<Todo, number>
  bookmarks!: Table<Bookmark, number>
  recurring!: Table<Recurring, number>
  merchantAliases!: Table<MerchantAlias, string>
  scrapCategories!: Table<ScrapCategory, number>
  scrapMedia!: Table<ScrapMedia, number>
  events!: Table<CalendarEvent, number>
  diaries!: Table<Diary, string>
  habits!: Table<Habit, number>
  habitChecks!: Table<HabitCheck, [number, string]>
  savings!: Table<SavingsPlan, number>
  todoCategories!: Table<TodoCategory, number>
  budgets!: Table<Budget, string>
  stickers!: Table<DaySticker, string>
  memoFolders!: Table<MemoFolder, number>
  memos!: Table<Memo, number>
  payMethods!: Table<PayMethod, number>
  moneyCategories!: Table<MoneyCategory, string>

  constructor(name = 'tidy') {
    super(name)
    this.version(1).stores({
      transactions: '++id, date, [type+date], category',
      // &bookmarkId: 스크랩 하나당 할 일 하나 (값이 없는 할 일은 인덱스에서 빠진다)
      todos: '++id, dueDate, isCompleted, &bookmarkId',
      bookmarks: '++id, url, isRead, createdAt',
    })
    // 2차: 정기 내역 규칙 (기존 데이터는 그대로)
    this.version(2).stores({
      recurring: '++id, type, isActive',
    })
    // 2차: 사용자가 알려 준 가게 이름
    this.version(3).stores({
      merchantAliases: '&raw',
    })
    // 2차: 캘린더 일정 (여러 날에 걸친 기간 포함) + 하루 일기
    this.version(4).stores({
      events: '++id, startDate, endDate',
      diaries: '&date',
    })
    // 2차: 스크랩 카테고리, 미리보기 썸네일, 캡처 사진·영상
    // (4번은 할 일 캘린더 PR이 쓴다. 두 PR을 순서대로 합치면 4 → 5로 올라간다)
    this.version(5)
      .stores({
        bookmarks: '++id, url, isRead, createdAt, categoryId',
        scrapCategories: '++id, &name, order',
        scrapMedia: '++id, bookmarkId, [bookmarkId+kind]',
      })
      .upgrade((tx) => seedCategories(tx.table('scrapCategories')))
    this.on('populate', (tx) => seedCategories(tx.table('scrapCategories')))
    // 2차: 습관 트래커 (습관 + 날짜별 체크 기록)
    this.version(6).stores({
      habits: '++id, order',
      habitChecks: '[habitId+date], habitId, date',
    })
    // 2차: 적금 (+ 적금으로 기록된 내역을 찾기 위한 인덱스)
    this.version(7).stores({
      savings: '++id',
      transactions: '++id, date, [type+date], category, savingsId',
    })
    // 2차: 할 일 카테고리 (할 일 캘린더 아래에 묶어서 보여 준다)
    this.version(8).stores({
      todoCategories: '++id, order',
      todos: '++id, dueDate, isCompleted, &bookmarkId, categoryId',
    })
    // 2차: 한 달 예산 (전체 + 카테고리별)
    this.version(9).stores({
      budgets: '&category',
    })
    // 2차: 달력 날짜 칸 이모티콘 스티커
    this.version(10).stores({
      stickers: '&date',
    })
    // 메모 + 메모 파일집 (사용자 요청 2026-11-17)
    this.version(11).stores({
      memoFolders: '++id, order',
      memos: '++id, folderId, createdAt, updatedAt',
    })
    // 내 카드 · 계좌 (어떤 카드 · 계좌로 썼는지 구분, 사용자 요청 2026-11-17)
    this.version(12).stores({
      payMethods: '++id, order',
    })
    // 가계부 카테고리 직접 만들고 지우기 (사용자 요청 2026-11-25)
    this.version(13).stores({
      moneyCategories: '&key, type',
    })
  }
}

/** 처음 쓸 때 넣어 두는 카테고리 (이름은 나중에 바꾸거나 지울 수 있다) */
export const DEFAULT_SCRAP_CATEGORIES = ['맛집·카페', '여행', '쇼핑', '공부', '꿀팁']

export async function seedCategories(table: Table<ScrapCategory, number>) {
  if ((await table.count()) > 0) return
  const now = new Date().toISOString()
  await table.bulkAdd(DEFAULT_SCRAP_CATEGORIES.map((name, order) => ({ name, order, createdAt: now })))
}

export const db = new TidyDB()

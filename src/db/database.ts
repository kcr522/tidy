import Dexie, { type Table } from 'dexie'
import type { Bookmark, CalendarEvent, Diary, Habit, HabitCheck, MerchantAlias, Recurring, Todo, Transaction } from './types'

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
  events!: Table<CalendarEvent, number>
  diaries!: Table<Diary, string>
  habits!: Table<Habit, number>
  habitChecks!: Table<HabitCheck, [number, string]>

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
    // 2차: 습관 트래커 (습관 + 날짜별 체크 기록)
    this.version(5).stores({
      habits: '++id, order',
      habitChecks: '[habitId+date], habitId, date',
    })
  }
}

export const db = new TidyDB()

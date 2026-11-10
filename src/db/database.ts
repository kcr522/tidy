import Dexie, { type Table } from 'dexie'
import type { Bookmark, Todo, Transaction } from './types'

/**
 * Tidy 로컬 DB (IndexedDB)
 * 브라우저, 폰 앱(Capacitor), 컴퓨터 PWA 모두 같은 DB를 쓴다.
 * 스키마를 바꿀 때는 version(2)를 새로 추가한다. 기존 version(1)은 지우지 않는다.
 */
export class TidyDB extends Dexie {
  transactions!: Table<Transaction, number>
  todos!: Table<Todo, number>
  bookmarks!: Table<Bookmark, number>

  constructor(name = 'tidy') {
    super(name)
    this.version(1).stores({
      transactions: '++id, date, [type+date], category',
      // &bookmarkId: 스크랩 하나당 할 일 하나 (값이 없는 할 일은 인덱스에서 빠진다)
      todos: '++id, dueDate, isCompleted, &bookmarkId',
      bookmarks: '++id, url, isRead, createdAt',
    })
  }
}

export const db = new TidyDB()

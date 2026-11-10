import { db as defaultDb, type TidyDB } from '../db/database'
import type { Bookmark, Todo, Transaction } from '../db/types'
import { nowIso } from '../lib/date'

/** 백업 파일 형식 (FR-060). 나중 버전에서도 읽을 수 있게 앱/스키마 버전을 넣는다 */
export interface Backup {
  app: 'tidy'
  appVersion: string
  schemaVersion: number
  exportedAt: string
  transactions: Transaction[]
  todos: Todo[]
  bookmarks: Bookmark[]
}

export class InvalidBackupError extends Error {
  constructor(message = 'Tidy 백업 파일이 아니에요') {
    super(message)
    this.name = 'InvalidBackupError'
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown) => typeof v === 'string'
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isFlag = (v: unknown) => v === 0 || v === 1
const isId = (v: unknown) => v === undefined || (isNum(v) && (v as number) > 0)

function isTransaction(v: unknown): v is Transaction {
  return (
    isObj(v) && isId(v.id) && (v.type === 'INCOME' || v.type === 'EXPENSE') && isNum(v.amount) && isStr(v.category) &&
    isStr(v.date) && isStr(v.memo) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isTodo(v: unknown): v is Todo {
  return (
    isObj(v) && isId(v.id) && isStr(v.title) && isFlag(v.isCompleted) && (v.completedAt === null || isStr(v.completedAt)) &&
    (v.dueDate === null || isStr(v.dueDate)) && (v.priority === 'HIGH' || v.priority === 'MEDIUM' || v.priority === 'LOW') &&
    (v.bookmarkId === undefined || isNum(v.bookmarkId)) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isBookmark(v: unknown): v is Bookmark {
  return (
    isObj(v) && isId(v.id) && isStr(v.url) && isStr(v.title) && isStr(v.memo) && isFlag(v.isRead) && isStr(v.createdAt) &&
    isStr(v.updatedAt)
  )
}

/** JSON 문자열을 검사해서 백업으로 바꾼다. 하나라도 틀리면 InvalidBackupError (FR-061) */
export function parseBackup(text: string, currentSchema: number): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new InvalidBackupError()
  }
  if (!isObj(data) || data.app !== 'tidy' || !isNum(data.schemaVersion)) throw new InvalidBackupError()
  if ((data.schemaVersion as number) > currentSchema) {
    throw new InvalidBackupError('더 새로운 버전의 Tidy에서 만든 백업이에요. 앱을 업데이트한 뒤 가져와 주세요')
  }
  const { transactions, todos, bookmarks } = data
  if (!Array.isArray(transactions) || !Array.isArray(todos) || !Array.isArray(bookmarks)) throw new InvalidBackupError()
  if (!transactions.every(isTransaction) || !todos.every(isTodo) || !bookmarks.every(isBookmark)) {
    throw new InvalidBackupError('백업 파일 내용이 손상됐어요')
  }
  return data as unknown as Backup
}

/** 백업 파일 이름: tidy-backup-2026-11-10.json */
export function backupFileName(dateKey: string): string {
  return `tidy-backup-${dateKey}.json`
}

export function createBackupRepo(database: TidyDB = defaultDb, appVersion = __APP_VERSION__) {
  return {
    async exportAll(): Promise<Backup> {
      return database.transaction('r', database.transactions, database.todos, database.bookmarks, async () => ({
        app: 'tidy' as const,
        appVersion,
        schemaVersion: database.verno,
        exportedAt: nowIso(),
        transactions: await database.transactions.toArray(),
        todos: await database.todos.toArray(),
        bookmarks: await database.bookmarks.toArray(),
      }))
    },

    /** 기존 데이터를 백업 내용으로 덮어쓴다. 한 트랜잭션이라 중간에 실패하면 아무것도 안 바뀐다 */
    async importAll(text: string): Promise<{ transactions: number; todos: number; bookmarks: number }> {
      const backup = parseBackup(text, database.verno)
      await database.transaction('rw', database.transactions, database.todos, database.bookmarks, async () => {
        await Promise.all([database.transactions.clear(), database.todos.clear(), database.bookmarks.clear()])
        await database.transactions.bulkAdd(backup.transactions)
        await database.bookmarks.bulkAdd(backup.bookmarks)
        await database.todos.bulkAdd(backup.todos)
      })
      return { transactions: backup.transactions.length, todos: backup.todos.length, bookmarks: backup.bookmarks.length }
    },

    /** 전체 삭제 (FR-062). 확인 문구는 화면에서 검사한다 */
    async clearAll(): Promise<void> {
      await database.transaction('rw', database.transactions, database.todos, database.bookmarks, async () => {
        await Promise.all([database.transactions.clear(), database.todos.clear(), database.bookmarks.clear()])
      })
    },
  }
}

export const backupRepo = createBackupRepo()

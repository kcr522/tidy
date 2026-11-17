import { isEventColor } from '../lib/eventLayout'
import { db as defaultDb, seedCategories, type TidyDB } from '../db/database'
import type { Budget, DaySticker, Bookmark, CalendarEvent, Diary, Habit, HabitCheck, Memo, MemoFolder, MerchantAlias, Recurring, SavingsPlan, ScrapCategory, ScrapMedia, Todo, TodoCategory, Transaction } from '../db/types'
import { nowIso } from '../lib/date'
import { isTodoRepeat } from '../lib/todoRepeat'
import { isAttachmentList } from '../lib/attachments'
import { isWebUrl } from '../lib/validate'

/** 백업 파일 형식 (FR-060). 나중 버전에서도 읽을 수 있게 앱/스키마 버전을 넣는다 */
export interface Backup {
  app: 'tidy'
  appVersion: string
  schemaVersion: number
  exportedAt: string
  transactions: Transaction[]
  todos: Todo[]
  bookmarks: Bookmark[]
  /** 정기 내역 규칙 (스키마 2부터, 예전 백업에는 없다) */
  recurring?: Recurring[]
  /** 알려 준 가게 이름 (스키마 3부터) */
  merchantAliases?: MerchantAlias[]
  /** 스크랩 카테고리 (스키마 5부터) */
  scrapCategories?: ScrapCategory[]
  /** 스크랩 썸네일·캡처. 파일은 data URL 글자로 바꿔 넣는다 (스키마 5부터) */
  scrapMedia?: BackupMedia[]
  /** 캘린더 일정 (스키마 4부터) */
  events?: CalendarEvent[]
  /** 일기 (스키마 4부터) */
  diaries?: Diary[]
  /** 습관 (스키마 6부터) */
  habits?: Habit[]
  /** 습관 체크 기록 (스키마 6부터) */
  habitChecks?: HabitCheck[]
  /** 적금 (스키마 6부터) */
  savings?: SavingsPlan[]
  /** 할 일 카테고리 (스키마 8부터) */
  todoCategories?: TodoCategory[]
  /** 한 달 예산 (스키마 9부터) */
  budgets?: Budget[]
  stickers?: DaySticker[]
  /** 메모 파일집 (스키마 11부터) */
  memoFolders?: MemoFolder[]
  /** 메모 (스키마 11부터) */
  memos?: Memo[]
}

export interface BackupMedia {
  id?: number
  bookmarkId: number
  kind: 'thumb' | 'capture'
  blob: string
  original?: string
  createdAt: string
  updatedAt: string
}

export class InvalidBackupError extends Error {
  constructor(message = 'Tidy 백업 파일이 아니에요') {
    super(message)
    this.name = 'InvalidBackupError'
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (v: unknown) => typeof v === 'string'
const isOptStr = (v: unknown) => v === undefined || typeof v === 'string'
const isNum = (v: unknown) => typeof v === 'number' && Number.isFinite(v)
const isFlag = (v: unknown) => v === 0 || v === 1
const isId = (v: unknown) => v === undefined || (isNum(v) && (v as number) > 0)

function isTransaction(v: unknown): v is Transaction {
  return (
    isObj(v) && isId(v.id) && (v.type === 'INCOME' || v.type === 'EXPENSE') && isNum(v.amount) && isStr(v.category) &&
    isStr(v.date) && isStr(v.memo) && isOptStr(v.time) && isOptStr(v.account) && isId(v.recurringId) && isOptStr(v.originalMemo) && isId(v.savingsId) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isTodo(v: unknown): v is Todo {
  return (
    isObj(v) && isId(v.id) && isStr(v.title) && isFlag(v.isCompleted) && (v.completedAt === null || isStr(v.completedAt)) &&
    (v.dueDate === null || isStr(v.dueDate)) && (v.priority === 'HIGH' || v.priority === 'MEDIUM' || v.priority === 'LOW') &&
    (v.bookmarkId === undefined || isNum(v.bookmarkId)) && (v.categoryId === undefined || isNum(v.categoryId)) && isOptStr(v.remindAt) && (v.repeat === undefined || isTodoRepeat(v.repeat)) && (v.repeatNextId === undefined || isNum(v.repeatNextId)) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isBookmark(v: unknown): v is Bookmark {
  return (
    isObj(v) && isId(v.id) && isWebUrl(v.url) && isStr(v.title) && isStr(v.memo) && isFlag(v.isRead) && isStr(v.createdAt) &&
    isStr(v.updatedAt)
  )
}

function isCategory(v: unknown): v is ScrapCategory {
  return isObj(v) && isId(v.id) && isStr(v.name) && isNum(v.order) && isStr(v.createdAt)
}

function isTodoCategory(v: unknown): v is TodoCategory {
  return isObj(v) && isCategory(v) && isStr((v as unknown as Record<string, unknown>).color)
}

function isSticker(v: unknown): v is DaySticker {
  return isObj(v) && isStr(v.date) && isStr(v.emoji) && isStr(v.updatedAt)
}

function isMemoFolder(v: unknown): v is MemoFolder {
  return isObj(v) && isId(v.id) && isStr(v.name) && isStr(v.color) && isNum(v.order) && isStr(v.createdAt)
}

const isInkList = (v: unknown) =>
  v === undefined || (Array.isArray(v) && v.every((k) => isObj(k) && isDataUrl(k.src) && isOptStr(k.text) && isStr(k.at)))

const isPicList = (v: unknown) => v === undefined || (Array.isArray(v) && v.every((p) => isObj(p) && isStr(p.id) && isDataUrl(p.src)))

function isMemo(v: unknown): v is Memo {
  return (
    isObj(v) && isId(v.id) && isStr(v.title) && isStr(v.text) && isId(v.folderId) && isAttachmentList(v.attachments) && isInkList(v.ink) && isOptStr(v.html) && isPicList(v.pics) &&
    (v.pinned === undefined || isFlag(v.pinned)) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isBudget(v: unknown): v is Budget {
  return isObj(v) && isStr(v.category) && isNum(v.amount) && (v.amount as number) > 0 && isStr(v.updatedAt)
}

const isDataUrl = (v: unknown) => typeof v === 'string' && /^data:[\w/+.-]*;base64,/.test(v)

function isMedia(v: unknown): v is BackupMedia {
  return (
    isObj(v) && isId(v.id) && isNum(v.bookmarkId) && (v.kind === 'thumb' || v.kind === 'capture') && isDataUrl(v.blob) &&
    (v.original === undefined || isDataUrl(v.original)) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(s)}`
}

function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',', 2)
  const type = head.slice(5).replace(/;base64$/, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

function isRecurring(v: unknown): v is Recurring {
  return (
    isObj(v) && isId(v.id) && (v.type === 'INCOME' || v.type === 'EXPENSE') && isNum(v.amount) && isStr(v.category) &&
    isStr(v.memo) && isOptStr(v.account) && isNum(v.day) && isStr(v.startDate) && (v.lastDate === null || isStr(v.lastDate)) &&
    (v.askAmount === undefined || isFlag(v.askAmount)) && isFlag(v.isActive) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isAlias(v: unknown): v is MerchantAlias {
  return isObj(v) && isStr(v.raw) && isStr(v.original) && isStr(v.name) && isStr(v.createdAt)
}

function isEvent(v: unknown): v is CalendarEvent {
  return (
    isObj(v) && isId(v.id) && isStr(v.title) && isStr(v.startDate) && isStr(v.endDate) && isEventColor(v.color) &&
    isStr(v.memo) && (v.source === undefined || v.source === 'google' || v.source === 'device') && isOptStr(v.uid) && isAttachmentList(v.attachments) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

const isDiaryPhoto = (v: unknown) => isObj(v) && isStr(v.src) && isOptStr(v.time) && isOptStr(v.note)

function isDiary(v: unknown): v is Diary {
  return (
    isObj(v) && isStr(v.date) && isStr(v.text) && isOptStr(v.photo) && (v.photos === undefined || (Array.isArray(v.photos) && v.photos.every(isDiaryPhoto))) && isAttachmentList(v.attachments) &&
    isStr(v.color) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

const isSchedule = (v: unknown) =>
  isObj(v) && (v.freq === 'daily' || v.freq === 'weekly' || v.freq === 'monthly') && (v.weekday === undefined || isNum(v.weekday)) && (v.day === undefined || isNum(v.day))

function isHabit(v: unknown): v is Habit {
  return (
    isObj(v) && isId(v.id) && isStr(v.title) && isStr(v.emoji) && isNum(v.order) && isId(v.savingsId) &&
    (v.schedule === undefined || isSchedule(v.schedule)) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isSavings(v: unknown): v is SavingsPlan {
  return (
    isObj(v) && isId(v.id) && isStr(v.name) && isOptStr(v.bank) && isNum(v.amount) && isStr(v.startDate) && isStr(v.endDate) &&
    isNum(v.rate) && (v.interestType === 'simple' || v.interestType === 'compound') &&
    (v.taxType === 'normal' || v.taxType === 'preferential' || v.taxType === 'free') && isSchedule(v.schedule) &&
    isFlag(v.autoDeposit) && isFlag(v.alarmOn) && isStr(v.alarmTime) && isId(v.habitId) && (v.lastDate === null || isStr(v.lastDate)) &&
    isStr(v.memo) && isStr(v.createdAt) && isStr(v.updatedAt)
  )
}

function isHabitCheck(v: unknown): v is HabitCheck {
  return isObj(v) && isNum(v.habitId) && isStr(v.date) && isStr(v.createdAt)
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
  const recurring = data.recurring ?? []
  const aliases = data.merchantAliases ?? []
  const events = data.events ?? []
  const diaries = data.diaries ?? []
  const habits = data.habits ?? []
  const habitChecks = data.habitChecks ?? []
  const savings = data.savings ?? []
  const categories = data.scrapCategories ?? []
  const media = data.scrapMedia ?? []
  const todoCategories = data.todoCategories ?? []
  const budgets = data.budgets ?? []
  const stickers = data.stickers ?? []
  const memoFolders = data.memoFolders ?? []
  const memos = data.memos ?? []
  if (!Array.isArray(memoFolders) || !Array.isArray(memos)) throw new InvalidBackupError()
  if (!Array.isArray(recurring) || !Array.isArray(aliases) || !Array.isArray(categories) || !Array.isArray(media) || !Array.isArray(events) || !Array.isArray(diaries) || !Array.isArray(habits) || !Array.isArray(habitChecks) || !Array.isArray(savings) || !Array.isArray(todoCategories) || !Array.isArray(budgets) || !Array.isArray(stickers)) throw new InvalidBackupError()
  if (
    !transactions.every(isTransaction) || !todos.every(isTodo) || !bookmarks.every(isBookmark) || !recurring.every(isRecurring) || !aliases.every(isAlias) ||
    !categories.every(isCategory) || !media.every(isMedia) || !events.every(isEvent) || !diaries.every(isDiary) || !habits.every(isHabit) || !habitChecks.every(isHabitCheck) || !savings.every(isSavings) ||
    !todoCategories.every(isTodoCategory) ||
    !budgets.every(isBudget) ||
    !stickers.every(isSticker) ||
    !memoFolders.every(isMemoFolder) ||
    !memos.every(isMemo)
  ) {
    throw new InvalidBackupError('백업 파일 내용이 손상됐어요')
  }
  return data as unknown as Backup
}

/** 백업 파일 이름: tidy-backup-2026-11-10.json */
export function backupFileName(dateKey: string): string {
  return `tidy-backup-${dateKey}.json`
}

const tables = (d: TidyDB) => [d.transactions, d.todos, d.bookmarks, d.recurring, d.merchantAliases, d.events, d.diaries, d.habits, d.habitChecks, d.savings, d.scrapCategories, d.scrapMedia, d.todoCategories, d.budgets, d.stickers, d.memoFolders, d.memos]

export function createBackupRepo(database: TidyDB = defaultDb, appVersion = __APP_VERSION__) {
  return {
    async exportAll(): Promise<Backup> {
      return database.transaction('r', tables(database), async () => ({
        app: 'tidy' as const,
        appVersion,
        schemaVersion: database.verno,
        exportedAt: nowIso(),
        transactions: await database.transactions.toArray(),
        todos: await database.todos.toArray(),
        bookmarks: await database.bookmarks.toArray(),
        recurring: await database.recurring.toArray(),
        merchantAliases: await database.merchantAliases.toArray(),
        events: await database.events.toArray(),
        diaries: await database.diaries.toArray(),
        habits: await database.habits.toArray(),
        habitChecks: await database.habitChecks.toArray(),
        savings: await database.savings.toArray(),
        scrapCategories: await database.scrapCategories.toArray(),
        todoCategories: await database.todoCategories.toArray(),
        budgets: await database.budgets.toArray(),
        stickers: await database.stickers.toArray(),
        memoFolders: await database.memoFolders.toArray(),
        memos: await database.memos.toArray(),
        rawMedia: await database.scrapMedia.toArray(),
      })).then(async ({ rawMedia, ...rest }) => ({
        ...rest,
        // 파일을 글자로 바꾸는 건 트랜잭션 밖에서 (IndexedDB 트랜잭션은 다른 비동기 작업을 기다려 주지 않는다)
        scrapMedia: await Promise.all(
          rawMedia.map(async (m: ScrapMedia) => {
            const { blob, original, ...meta } = m
            return { ...meta, blob: await blobToDataUrl(blob), ...(original ? { original: await blobToDataUrl(original) } : {}) }
          }),
        ),
      }))
    },

    /** 기존 데이터를 백업 내용으로 덮어쓴다. 한 트랜잭션이라 중간에 실패하면 아무것도 안 바뀐다 */
    async importAll(text: string): Promise<{ transactions: number; todos: number; bookmarks: number }> {
      const backup = parseBackup(text, database.verno)
      const media: ScrapMedia[] = (backup.scrapMedia ?? []).map((m) => ({ ...m, blob: dataUrlToBlob(m.blob), original: m.original ? dataUrlToBlob(m.original) : undefined }))
      await database.transaction('rw', tables(database), async () => {
        await Promise.all(tables(database).map((t) => t.clear()))
        // 카테고리가 없던 예전 백업이면 기본 카테고리를 넣어 둔다
        if (backup.scrapCategories) await database.scrapCategories.bulkAdd(backup.scrapCategories)
        else await seedCategories(database.scrapCategories)
        await database.scrapMedia.bulkAdd(media)
        await database.recurring.bulkAdd(backup.recurring ?? [])
        await database.merchantAliases.bulkAdd(backup.merchantAliases ?? [])
        await database.events.bulkAdd(backup.events ?? [])
        await database.diaries.bulkAdd(backup.diaries ?? [])
        await database.habits.bulkAdd(backup.habits ?? [])
        await database.habitChecks.bulkAdd(backup.habitChecks ?? [])
        await database.savings.bulkAdd(backup.savings ?? [])
        await database.todoCategories.bulkAdd(backup.todoCategories ?? [])
        await database.budgets.bulkAdd(backup.budgets ?? [])
        await database.stickers.bulkAdd(backup.stickers ?? [])
        await database.memoFolders.bulkAdd(backup.memoFolders ?? [])
        await database.memos.bulkAdd(backup.memos ?? [])
        await database.transactions.bulkAdd(backup.transactions)
        await database.bookmarks.bulkAdd(backup.bookmarks)
        await database.todos.bulkAdd(backup.todos)
      })
      return { transactions: backup.transactions.length, todos: backup.todos.length, bookmarks: backup.bookmarks.length }
    },

    /** 전체 삭제 (FR-062). 확인 문구는 화면에서 검사한다 */
    async clearAll(): Promise<void> {
      await database.transaction('rw', tables(database), async () => {
        await Promise.all(tables(database).map((t) => t.clear()))
        await seedCategories(database.scrapCategories)
      })
    },
  }
}

export const backupRepo = createBackupRepo()

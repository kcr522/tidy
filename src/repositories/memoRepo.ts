import { db as defaultDb, type TidyDB } from '../db/database'
import type { Attachment, Memo, MemoFolder } from '../db/types'
import { cleanAttachments } from '../lib/attachments'
import { nowIso } from '../lib/date'
import { MAX_MEMO_TEXT, MAX_MEMO_TITLE, MEMO_FOLDER_COLORS, MAX_FOLDER_NAME } from '../lib/memo'

export class MemoFolderNameError extends Error {}

export interface MemoInput {
  title: string
  text: string
  folderId?: number
  attachments?: Attachment[]
}

function checkFolderName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ')
  if (!name) throw new MemoFolderNameError('이름을 입력해 주세요')
  if (name.length > MAX_FOLDER_NAME) throw new MemoFolderNameError(`${MAX_FOLDER_NAME}자까지 쓸 수 있어요`)
  return name
}

/** 메모 + 메모 파일집 (사용자 요청 2026-11-17) */
export function createMemoRepo(database: TidyDB = defaultDb) {
  function clean(input: MemoInput) {
    const out: Pick<Memo, 'title' | 'text'> & Partial<Memo> = {
      title: input.title.trim().slice(0, MAX_MEMO_TITLE),
      text: input.text.slice(0, MAX_MEMO_TEXT),
    }
    if (input.folderId) out.folderId = input.folderId
    const files = cleanAttachments(input.attachments)
    if (files.length) out.attachments = files
    return out
  }

  async function ensureUnique(name: string, exceptId?: number) {
    const all = await database.memoFolders.toArray()
    if (all.some((f) => f.name === name && f.id !== exceptId)) throw new MemoFolderNameError('이미 있는 파일집이에요')
  }

  return {
    async list(): Promise<Memo[]> {
      return database.memos.toArray()
    },

    async get(id: number): Promise<Memo | undefined> {
      return database.memos.get(id)
    },

    /** 새 메모. 쓴 시각(createdAt)은 지금으로 남는다. 새 id 를 돌려준다 */
    async add(input: MemoInput, now = nowIso()): Promise<number> {
      return database.memos.add({ ...clean(input), createdAt: now, updatedAt: now })
    },

    /** 고친다. 처음 쓴 시각과 고정은 그대로 두고, 고친 시각(updatedAt)을 돌려준다 */
    async update(id: number, input: MemoInput): Promise<string> {
      const old = await database.memos.get(id)
      if (!old) throw new Error('메모가 없어요')
      const now = nowIso()
      const next: Memo = { ...clean(input), id, createdAt: old.createdAt, updatedAt: now }
      if (old.pinned) next.pinned = old.pinned
      await database.memos.put(next)
      return now
    },

    async setPinned(id: number, pinned: boolean): Promise<void> {
      const old = await database.memos.get(id)
      if (!old) return
      const next = { ...old }
      if (pinned) next.pinned = 1
      else delete next.pinned
      await database.memos.put(next)
    },

    async move(id: number, folderId: number | undefined): Promise<void> {
      const old = await database.memos.get(id)
      if (!old) return
      const next = { ...old, updatedAt: nowIso() }
      if (folderId) next.folderId = folderId
      else delete next.folderId
      await database.memos.put(next)
    },

    async remove(id: number): Promise<void> {
      await database.memos.delete(id)
    },

    async folders(): Promise<MemoFolder[]> {
      return database.memoFolders.orderBy('order').toArray()
    },

    async addFolder(rawName: string, color?: string): Promise<number> {
      const name = checkFolderName(rawName)
      await ensureUnique(name)
      const all = await database.memoFolders.orderBy('order').toArray()
      return database.memoFolders.add({
        name,
        color: color ?? MEMO_FOLDER_COLORS[all.length % MEMO_FOLDER_COLORS.length].hex,
        order: (all[all.length - 1]?.order ?? -1) + 1,
        createdAt: nowIso(),
      })
    },

    async updateFolder(id: number, rawName: string, color: string): Promise<void> {
      const name = checkFolderName(rawName)
      await ensureUnique(name, id)
      await database.memoFolders.update(id, { name, color })
    },

    /** 파일집을 지워도 안의 메모는 지우지 않고 파일집 밖으로 꺼낸다 */
    async removeFolder(id: number): Promise<void> {
      await database.transaction('rw', database.memoFolders, database.memos, async () => {
        await database.memos
          .where('folderId')
          .equals(id)
          .modify((m) => {
            delete m.folderId
          })
        await database.memoFolders.delete(id)
      })
    },
  }
}

export const memoRepo = createMemoRepo()

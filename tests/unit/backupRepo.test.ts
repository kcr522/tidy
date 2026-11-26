import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { InvalidBackupError, backupFileName, createBackupRepo } from '../../src/repositories/backupRepo'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { createTodoRepo } from '../../src/repositories/todoRepo'
import { createTransactionRepo } from '../../src/repositories/transactionRepo'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const db = new TidyDB(name)
  dbs.push(db)
  return db
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((db) => db.delete()))
})

/** 내역 2개, 스크랩 1개, 할 일 2개(하나는 스크랩에서 만든 것)를 넣는다 */
async function seed(db: TidyDB) {
  await createTransactionRepo(db).add({ type: 'EXPENSE', amount: 9000, category: '식비', date: '2026-11-10', memo: '점심' })
  await createTransactionRepo(db).add({ type: 'INCOME', amount: 2500000, category: '월급', date: '2026-11-01', memo: '' })
  const bookmarkId = await createBookmarkRepo(db).add({ url: 'https://react.dev/', title: 'React', memo: '' })
  await createTodoRepo(db).add({ title: '장보기', dueDate: '2026-11-10', priority: 'HIGH' })
  await createTodoRepo(db).createFromBookmark(bookmarkId, null)
}

const APP_VERSION = '0.1.0'
const NEWER_SCHEMA = 99

describe('백업 (US7)', () => {
  it('파일 이름은 tidy-backup-날짜.json 이다 (시나리오 1)', () => {
    expect(backupFileName('2026-11-10')).toBe('tidy-backup-2026-11-10.json')
  })

  it('내보낸 백업에 앱 이름 · 버전 · DB 버전과 모든 내역이 들어간다', async () => {
    const source = freshDb('backup-a')
    await seed(source)

    const backup = await createBackupRepo(source, APP_VERSION).exportAll()

    expect(backup).toMatchObject({ app: 'tidy', appVersion: APP_VERSION, schemaVersion: source.verno })
    expect(backup.transactions).toHaveLength(2)
  })

  it('다른 기기에서 가져오면 원래 있던 것은 지우고 똑같이 바뀐다 (시나리오 2, SC-006)', async () => {
    const source = freshDb('backup-a2')
    await seed(source)
    const backup = await createBackupRepo(source, APP_VERSION).exportAll()
    const target = freshDb('backup-b')
    await createTodoRepo(target).add({ title: '지워질 할 일', dueDate: null, priority: 'LOW' })

    const result = await createBackupRepo(target).importAll(JSON.stringify(backup))

    expect(result).toEqual({ transactions: 2, todos: 2, bookmarks: 1 })
    const again = await createBackupRepo(target, APP_VERSION).exportAll()
    expect({ ...again, exportedAt: '' }).toEqual({ ...backup, exportedAt: '' })
    expect((await createTodoRepo(target).linkedBookmarks()).size).toBe(1) // 스크랩 ↔ 할 일 연결도 그대로인지 확인
  })

  it.each([
    ['JSON 이 아닌 글', 'hello'],
    ['빈 객체', '{}'],
    ['빈 배열', '[]'],
    ['다른 앱 백업', JSON.stringify({ app: 'other', schemaVersion: 1 })],
  ])('%s 은 Tidy 백업이 아니라고 거절하고 아무것도 바꾸지 않는다 (시나리오 3)', async (_case, file) => {
    const db = freshDb('backup-c')
    await seed(db)

    await expect(createBackupRepo(db).importAll(file)).rejects.toBeInstanceOf(InvalidBackupError)

    expect(await db.transactions.count()).toBe(2)
  })

  it('할 일 제목이 숫자로 깨진 백업은 손상됐다고 거절하고 아무것도 바꾸지 않는다', async () => {
    const db = freshDb('backup-c2')
    await seed(db)
    const repo = createBackupRepo(db)
    const broken = { ...(await repo.exportAll()), todos: [{ title: 1 }] }

    await expect(repo.importAll(JSON.stringify(broken))).rejects.toThrow('손상')

    expect(await db.todos.count()).toBe(2)
  })

  it('더 새 DB 버전의 백업은 앱을 업데이트하라고 거절한다', async () => {
    const db = freshDb('backup-c3')
    await seed(db)
    const repo = createBackupRepo(db)
    const newer = { ...(await repo.exportAll()), schemaVersion: NEWER_SCHEMA }

    await expect(repo.importAll(JSON.stringify(newer))).rejects.toThrow('새로운 버전')

    expect(await db.transactions.count()).toBe(2)
  })

  it('전체 삭제하면 내역 · 할 일 · 스크랩이 모두 0개가 된다 (시나리오 4)', async () => {
    const db = freshDb('backup-d')
    await seed(db)

    await createBackupRepo(db).clearAll()

    expect([await db.transactions.count(), await db.todos.count(), await db.bookmarks.count()]).toEqual([0, 0, 0])
  })
})

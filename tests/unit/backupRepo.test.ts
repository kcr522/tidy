import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { InvalidBackupError, backupFileName, createBackupRepo } from '../../src/repositories/backupRepo'
import { createBookmarkRepo } from '../../src/repositories/bookmarkRepo'
import { createTodoRepo } from '../../src/repositories/todoRepo'
import { createTransactionRepo } from '../../src/repositories/transactionRepo'

const dbs: TidyDB[] = []
function freshDb(name: string) {
  const d = new TidyDB(name)
  dbs.push(d)
  return d
}
afterEach(async () => {
  await Promise.all(dbs.splice(0).map((d) => d.delete()))
})

async function seed(d: TidyDB) {
  await createTransactionRepo(d).add({ type: 'EXPENSE', amount: 9000, category: '식비', date: '2026-11-10', memo: '점심' })
  await createTransactionRepo(d).add({ type: 'INCOME', amount: 2500000, category: '월급', date: '2026-11-01', memo: '' })
  const bId = await createBookmarkRepo(d).add({ url: 'https://react.dev/', title: 'React', memo: '' })
  await createTodoRepo(d).add({ title: '장보기', dueDate: '2026-11-10', priority: 'HIGH' })
  await createTodoRepo(d).createFromBookmark(bId, null)
}

describe('백업 (US7)', () => {
  it('파일 이름은 tidy-backup-날짜.json (시나리오 1)', () => {
    expect(backupFileName('2026-11-10')).toBe('tidy-backup-2026-11-10.json')
  })

  it('내보낸 것을 다른 기기에서 가져오면 그대로 (시나리오 2, SC-006)', async () => {
    const a = freshDb('backup-a')
    await seed(a)
    const backup = await createBackupRepo(a, '0.1.0').exportAll()
    expect(backup).toMatchObject({ app: 'tidy', appVersion: '0.1.0', schemaVersion: a.verno })
    expect(backup.transactions).toHaveLength(2)

    const b = freshDb('backup-b')
    await createTodoRepo(b).add({ title: '지워질 할 일', dueDate: null, priority: 'LOW' })
    const result = await createBackupRepo(b).importAll(JSON.stringify(backup))
    expect(result).toEqual({ transactions: 2, todos: 2, bookmarks: 1 })

    const again = await createBackupRepo(b, '0.1.0').exportAll()
    expect({ ...again, exportedAt: '' }).toEqual({ ...backup, exportedAt: '' })
    // 스크랩 ↔ 할 일 연결도 그대로
    const linked = await createTodoRepo(b).linkedBookmarks()
    expect(linked.size).toBe(1)
  })

  it('Tidy 백업이 아니면 아무것도 바뀌지 않는다 (시나리오 3)', async () => {
    const d = freshDb('backup-c')
    await seed(d)
    const repo = createBackupRepo(d)
    for (const bad of ['hello', '{}', '[]', JSON.stringify({ app: 'other', schemaVersion: 1 })]) {
      await expect(repo.importAll(bad)).rejects.toBeInstanceOf(InvalidBackupError)
    }
    const broken = { ...(await repo.exportAll()), todos: [{ title: 1 }] }
    await expect(repo.importAll(JSON.stringify(broken))).rejects.toThrow('손상')
    const newer = { ...(await repo.exportAll()), schemaVersion: 99 }
    await expect(repo.importAll(JSON.stringify(newer))).rejects.toThrow('새로운 버전')
    expect(await d.transactions.count()).toBe(2)
    expect(await d.todos.count()).toBe(2)
  })

  it('전체 삭제 (시나리오 4)', async () => {
    const d = freshDb('backup-d')
    await seed(d)
    await createBackupRepo(d).clearAll()
    expect([await d.transactions.count(), await d.todos.count(), await d.bookmarks.count()]).toEqual([0, 0, 0])
  })
})

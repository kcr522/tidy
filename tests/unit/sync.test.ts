import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { decodeRecord, encodeRecord, fileHashes, parseRowDocId, rowDocId } from '../../src/lib/sync/codec'
import { installSyncHooks, writeRows } from '../../src/lib/sync/engine'
import { ID_BLOCK, clearDirty, loadSync, maxSeqIn, resetSyncCache, saveSync } from '../../src/lib/sync/state'
import { savingsAlarmId } from '../../src/platform/alarms'

describe('codec', () => {
  it('문서 이름은 표와 키로 만들고 되돌릴 수 있다 (/ 가 들어간 키, 묶음 키도)', () => {
    for (const [t, k] of [['transactions', 100005], ['merchantAliases', 'KCP/다이소'], ['habitChecks', [3, '2026-11-11']]] as const) {
      const id = rowDocId(t, k)
      expect(id).not.toContain('/')
      expect(parseRowDocId(id)).toEqual({ table: t, key: k })
    }
  })

  it('큰 사진 글자와 Blob 은 파일로 빼고, 받을 때 다시 채운다', async () => {
    const photo = 'data:image/jpeg;base64,' + 'A'.repeat(5000)
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' })
    const rec = { date: '2026-11-11', text: '일기', photos: [{ src: photo, time: '09:00' }], icon: 'data:image/png;base64,AAAA', gone: undefined, media: blob }
    const enc = await encodeRecord(rec)
    expect(enc.json).not.toContain('AAAAAAAAAA')
    expect(enc.json).toContain('data:image/png;base64,AAAA') // 작은 건 그대로
    expect(enc.files.size).toBe(2)
    expect(fileHashes(enc.json).sort()).toEqual([...enc.files.keys()].sort())
    const back = decodeRecord(enc.json, enc.files) as typeof rec
    expect(back.photos[0]).toEqual({ src: photo, time: '09:00' })
    expect(back.media).toBeInstanceOf(Blob)
    expect([...new Uint8Array(await back.media.arrayBuffer())]).toEqual([1, 2, 3])
    expect('gone' in back).toBe(false)
  })

  it('못 받은 파일은 이 기기 값으로 채우고, 그것도 없으면 그 사진만 뺀다', async () => {
    const a = 'data:image/jpeg;base64,' + 'A'.repeat(3000)
    const b = 'data:image/jpeg;base64,' + 'B'.repeat(3000)
    const enc = await encodeRecord({ photos: [{ src: a }, { src: b }] })
    const none = new Map<string, string>()
    expect(decodeRecord(enc.json, none, { photos: [{ src: a }, { src: b }] })).toEqual({ photos: [{ src: a }, { src: b }] })
    expect(decodeRecord(enc.json, none)).toEqual({ photos: [{}, {}] })
  })
})

describe('기기 번호 구간', () => {
  it('이 기기 구간의 가장 큰 순번만 센다', () => {
    expect(maxSeqIn(2, [1, 5, 2 * ID_BLOCK + 7, 2 * ID_BLOCK + 3, 3 * ID_BLOCK + 9])).toBe(7)
  })
  it('적금 알림 번호는 id가 커져도 32비트 안이고 할 일 알림(100만+id)과 안 겹친다', () => {
    const big = 9_999 * ID_BLOCK + 99_999
    expect(savingsAlarmId(big, 5)).toBeLessThan(2 ** 31)
    expect(savingsAlarmId(1, 0)).toBeGreaterThan(1_000_000 + big)
  })
})

describe('동기화 훅', () => {
  let d: TidyDB
  beforeEach(async () => {
    resetSyncCache()
    d = new TidyDB('sync-test')
    installSyncHooks(d)
    await d.open() // 기본 스크랩 카테고리는 로그인 전에 들어간다
  })
  afterEach(async () => {
    saveSync(null)
    await d.delete()
  })

  it('로그인 전에는 1, 2, 3… 그대로, 적어 두지도 않는다', async () => {
    const id = await d.todos.add({ title: 'a', isCompleted: 0, completedAt: null, dueDate: null, priority: 'LOW', createdAt: '', updatedAt: '' })
    expect(id).toBe(1)
    expect(loadSync()).toBeNull()
  })

  it('로그인하면 새 기록 번호를 기기 구간에서 만들고, 바뀐 기록을 적어 둔다', async () => {
    saveSync({ uid: 'u1', device: 3, seq: 0, pulled: 0, dirty: {} })
    const id = await d.todos.add({ title: 'a', isCompleted: 0, completedAt: null, dueDate: null, priority: 'LOW', createdAt: '', updatedAt: '' })
    expect(id).toBe(3 * ID_BLOCK + 1)
    await d.todos.update(id, { title: 'b' })
    await d.diaries.put({ date: '2026-11-11', text: 'x', color: 'pink', createdAt: '', updatedAt: '' })
    await d.budgets.put({ category: '식비', amount: 1000, updatedAt: '' })
    await d.budgets.delete('식비')
    const dirty = loadSync()!.dirty
    expect(dirty[`todos|${id}`]).toBe(2)
    expect(dirty['diaries|"2026-11-11"']).toBe(1)
    expect(dirty['budgets|"식비"']).toBe(2)
    // 올리는 동안 또 바뀌면 남겨 둔다
    clearDirty({ [`todos|${id}`]: 1, 'diaries|"2026-11-11"': 1 })
    expect(Object.keys(loadSync()!.dirty).sort()).toEqual(['budgets|"식비"', `todos|${id}`])
  })

  it('다른 기기에서 받은 기록은 적어 두지 않고, 지우기도 된다', async () => {
    saveSync({ uid: 'u1', device: 1, seq: 0, pulled: 0, dirty: {} })
    const todo = { id: 2 * ID_BLOCK + 1, title: '다른 기기', isCompleted: 0, completedAt: null, dueDate: null, priority: 'LOW', createdAt: '', updatedAt: '' }
    const enc = await encodeRecord(todo)
    await writeRows([{ table: 'todos', key: todo.id, json: enc.json, device: 2, at: 1 }])
    expect(await d.todos.get(todo.id)).toEqual(todo)
    expect(loadSync()!.dirty).toEqual({})
    await writeRows([{ table: 'todos', key: todo.id, json: null, device: 2, at: 2 }])
    expect(await d.todos.get(todo.id)).toBeUndefined()
    expect(loadSync()!.dirty).toEqual({})
  })

  it('클라우드로 바꾸기: 이 기기 기록을 지우고 받은 것만 남긴다', async () => {
    await d.todos.add({ title: '이 기기', isCompleted: 0, completedAt: null, dueDate: null, priority: 'LOW', createdAt: '', updatedAt: '' })
    saveSync({ uid: 'u1', device: 1, seq: 0, pulled: 0, dirty: {} })
    const cat = { id: 7, name: '여행', order: 0, createdAt: '' }
    await writeRows([{ table: 'scrapCategories', key: 7, json: (await encodeRecord(cat)).json, device: 2, at: 1 }], true)
    expect(await d.todos.count()).toBe(0)
    expect(await d.scrapCategories.toArray()).toEqual([cat])
    expect(loadSync()!.dirty).toEqual({})
  })
})

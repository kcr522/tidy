import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { TidyDB } from '../../src/db/database'
import { decodeRecord, encodeRecord, fileHashes, parseRowDocId, rowDocId } from '../../src/lib/sync/codec'
import { installSyncHooks, writeRows } from '../../src/lib/sync/engine'
import { ID_BLOCK, clearDirty, loadSync, maxSeqIn, resetSyncCache, saveSync } from '../../src/lib/sync/state'
import { savingsAlarmId } from '../../src/platform/alarms'

const NOT_DONE = 0 as const
const NOT_SIGNED_IN = null
const REPLACE_ALL = true
/** 정상 할 일 하나 (날짜 없음, 낮은 순위) */
const okTodo = (title: string) => ({ title, isCompleted: NOT_DONE, completedAt: null, dueDate: null, priority: 'LOW' as const, createdAt: '', updatedAt: '' })
const signIn = (device: number) => saveSync({ uid: 'u1', device, seq: 0, pulled: 0, dirty: {} })

describe('codec', () => {
  it.each([
    ['숫자 키', 'transactions', 100005],
    ['/ 가 들어간 키', 'merchantAliases', 'KCP/다이소'],
    ['묶음 키', 'habitChecks', [3, '2026-11-11']],
  ] as const)('문서 이름은 표와 %s 로 / 없이 만들고 되돌릴 수 있다', (_case, table, key) => {
    const id = rowDocId(table, key)

    expect(id).not.toContain('/')
    expect(parseRowDocId(id)).toEqual({ table, key })
  })

  it('큰 사진 글자와 Blob 은 파일로 빼고, 작은 사진 글자와 빈 칸은 그대로 둔다', async () => {
    const bigPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(5000)
    const smallIcon = 'data:image/png;base64,AAAA'
    const record = { photos: [{ src: bigPhoto }], icon: smallIcon, media: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) }

    const encoded = await encodeRecord(record)

    expect(encoded.json).not.toContain('AAAAAAAAAA')
    expect(encoded.json).toContain(smallIcon)
    expect(encoded.files.size).toBe(2)
    expect(fileHashes(encoded.json).sort()).toEqual([...encoded.files.keys()].sort())
  })

  it('받을 때 뺀 파일을 다시 채우고, undefined 칸은 남기지 않는다', async () => {
    const bigPhoto = 'data:image/jpeg;base64,' + 'A'.repeat(5000)
    const record = { date: '2026-11-11', text: '일기', photos: [{ src: bigPhoto, time: '09:00' }], gone: undefined, media: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) }
    const encoded = await encodeRecord(record)

    const back = decodeRecord(encoded.json, encoded.files) as typeof record

    expect(back.photos[0]).toEqual({ src: bigPhoto, time: '09:00' })
    expect(back.media).toBeInstanceOf(Blob)
    expect([...new Uint8Array(await back.media.arrayBuffer())]).toEqual([1, 2, 3])
    expect('gone' in back).toBe(false)
  })

  it('못 받은 파일은 이 기기 값으로 채우고, 그것도 없으면 그 사진만 뺀다', async () => {
    const photoA = 'data:image/jpeg;base64,' + 'A'.repeat(3000)
    const photoB = 'data:image/jpeg;base64,' + 'B'.repeat(3000)
    const encoded = await encodeRecord({ photos: [{ src: photoA }, { src: photoB }] })
    const noFiles = new Map<string, string>()

    expect(decodeRecord(encoded.json, noFiles, { photos: [{ src: photoA }, { src: photoB }] })).toEqual({ photos: [{ src: photoA }, { src: photoB }] })
    expect(decodeRecord(encoded.json, noFiles)).toEqual({ photos: [{}, {}] })
  })
})

describe('기기 번호 구간', () => {
  it('이 기기(2번) 구간의 가장 큰 순번만 센다', () => {
    const DEVICE = 2

    expect(maxSeqIn(DEVICE, [1, 5, DEVICE * ID_BLOCK + 7, DEVICE * ID_BLOCK + 3, 3 * ID_BLOCK + 9])).toBe(7)
  })

  it('적금 알림 번호는 id 가 커져도 32비트 안이다', () => {
    const biggestId = 9_999 * ID_BLOCK + 99_999

    expect(savingsAlarmId(biggestId, 5)).toBeLessThan(2 ** 31)
  })

  it('적금 알림 번호는 할 일 알림(100만 + id)과 겹치지 않는다', () => {
    const TODO_ALARM_BASE = 1_000_000
    const biggestId = 9_999 * ID_BLOCK + 99_999

    expect(savingsAlarmId(1, 0)).toBeGreaterThan(TODO_ALARM_BASE + biggestId)
  })
})

describe('동기화 훅', () => {
  let db: TidyDB
  beforeEach(async () => {
    resetSyncCache()
    db = new TidyDB('sync-test')
    installSyncHooks(db)
    await db.open() // 기본 스크랩 카테고리는 로그인 전에 들어간다
  })
  afterEach(async () => {
    saveSync(NOT_SIGNED_IN)
    await db.delete()
  })

  it('로그인 전에는 기록 번호를 1, 2, 3… 그대로 쓰고 바뀐 것을 적어 두지도 않는다', async () => {
    const id = await db.todos.add(okTodo('a'))

    expect(id).toBe(1)
    expect(loadSync()).toBeNull()
  })

  it('로그인하면 새 기록 번호를 기기 구간(3번 기기)에서 만든다', async () => {
    const DEVICE = 3
    signIn(DEVICE)

    const id = await db.todos.add(okTodo('a'))

    expect(id).toBe(DEVICE * ID_BLOCK + 1)
  })

  it('로그인하면 더하기 · 고치기 · 지우기를 기록마다 몇 번 바뀌었는지 적어 둔다', async () => {
    signIn(3)

    const id = await db.todos.add(okTodo('a'))
    await db.todos.update(id, { title: 'b' })
    await db.diaries.put({ date: '2026-11-11', text: 'x', color: 'pink', createdAt: '', updatedAt: '' })
    await db.budgets.put({ category: '식비', amount: 1000, updatedAt: '' })
    await db.budgets.delete('식비')

    const dirty = loadSync()!.dirty
    expect(dirty[`todos|${id}`]).toBe(2)
    expect(dirty['diaries|"2026-11-11"']).toBe(1)
    expect(dirty['budgets|"식비"']).toBe(2)
  })

  it('올리는 동안 또 바뀐 기록은 다 올린 뒤에도 남겨 둔다', async () => {
    signIn(3)
    const id = await db.todos.add(okTodo('a'))
    await db.todos.update(id, { title: 'b' })
    await db.diaries.put({ date: '2026-11-11', text: 'x', color: 'pink', createdAt: '', updatedAt: '' })

    // 할 일은 1번째 바뀐 것까지만 올렸다
    clearDirty({ [`todos|${id}`]: 1, 'diaries|"2026-11-11"': 1 })

    expect(Object.keys(loadSync()!.dirty)).toEqual([`todos|${id}`])
  })

  it('다른 기기에서 받은 기록은 넣거나 지워도 바뀐 것으로 적어 두지 않는다', async () => {
    signIn(1)
    const OTHER_DEVICE = 2
    const todo = { id: OTHER_DEVICE * ID_BLOCK + 1, ...okTodo('다른 기기') }
    const { json } = await encodeRecord(todo)

    await writeRows([{ table: 'todos', key: todo.id, json, device: OTHER_DEVICE, at: 1 }])
    expect(await db.todos.get(todo.id)).toEqual(todo)
    expect(loadSync()!.dirty).toEqual({})

    await writeRows([{ table: 'todos', key: todo.id, json: null, device: OTHER_DEVICE, at: 2 }])
    expect(await db.todos.get(todo.id)).toBeUndefined()
    expect(loadSync()!.dirty).toEqual({})
  })

  it('클라우드로 바꾸기를 고르면 이 기기 기록을 지우고 받은 것만 남긴다', async () => {
    await db.todos.add(okTodo('이 기기'))
    signIn(1)
    const category = { id: 7, name: '여행', order: 0, createdAt: '' }

    await writeRows([{ table: 'scrapCategories', key: 7, json: (await encodeRecord(category)).json, device: 2, at: 1 }], REPLACE_ALL)

    expect(await db.todos.count()).toBe(0)
    expect(await db.scrapCategories.toArray()).toEqual([category])
    expect(loadSync()!.dirty).toEqual({})
  })
})

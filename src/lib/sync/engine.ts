/**
 * 기기 동기화 (구글 로그인한 사람만)
 *
 * 이 기기의 로컬 DB(IndexedDB)가 그대로 주인이고, 바뀐 기록만 클라우드(Firestore)에 올리고 받는다.
 *   users/{uid}/rows/{표~키}  { t: 표, j: 기록 JSON(지웠으면 null), u: 서버 시각, d: 올린 기기 번호 }
 *   users/{uid}/files/{해시}  { v: 사진 data URL }
 *   users/{uid}/meta/devices  { next: 다음 기기 번호 }
 *
 * - 바꾸면(만들기·고치기·지우기) Dexie 훅이 "아직 안 올림" 목록에 적고, 잠시 뒤 한꺼번에 올린다. 인터넷이 없으면 다음에 올린다
 * - 다른 기기가 올린 것은 실시간으로 받는다. 이 기기에서 아직 못 올린 기록이면 이 기기 것을 남긴다 (나중에 올라간다)
 * - 새 기록 번호는 기기마다 다른 구간(기기 번호 × 100000 + 순번)에서 만들어서 두 기기 번호가 겹치지 않는다
 */
import type { Table, Transaction } from 'dexie'
import type { Firestore, QueryDocumentSnapshot, Unsubscribe } from 'firebase/firestore'
import type { TidyDB } from '../../db/database'
import { startRouteSync, stopRouteSync } from './routeSync'
import { decodeRecord, encodeRecord, fileHashes, parseRowDocId, rowDocId } from './codec'
import { MAX_DEVICE, clearDirty, dirtyKey, isDirty, loadSync, markDirty, maxSeqIn, nextId, parseDirtyKey, saveSync, type SyncState } from './state'

type RemoteTx = Transaction & { __tidyRemote?: boolean }

export type SyncStatus = 'off' | 'idle' | 'syncing' | 'offline' | 'error'
export interface SyncInfo {
  status: SyncStatus
  /** 아직 못 올린 기록 수 */
  pending: number
  lastSyncedAt?: number
  error?: string
}

let info: SyncInfo = { status: 'off', pending: 0 }
const listeners = new Set<(i: SyncInfo) => void>()
function setInfo(patch: Partial<SyncInfo>) {
  info = { ...info, ...patch, pending: Object.keys(loadSync()?.dirty ?? {}).length }
  listeners.forEach((l) => l(info))
}
export const syncInfo = () => info
export function onSyncInfo(fn: (i: SyncInfo) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ---------- 훅: 바뀐 기록 적어 두기 ----------

let hooked: TidyDB | null = null
let database: TidyDB | null = null

/** 앱을 켤 때 한 번. 로그인 전에도 걸어 두고, 동기화 중일 때만 일한다 */
export function installSyncHooks(d: TidyDB) {
  database = d
  if (hooked === d) return
  hooked = d
  for (const table of d.tables) {
    const name = table.name
    const auto = table.schema.primKey.auto
    table.hook('creating', function (primKey, _obj, tx) {
      if ((tx as RemoteTx).__tidyRemote || !loadSync()) return undefined
      let key = primKey
      if (key == null && auto) key = nextId()
      this.onsuccess = (k) => changed(name, k)
      return key
    })
    table.hook('updating', function (_mods, primKey, _obj, tx) {
      if ((tx as RemoteTx).__tidyRemote || !loadSync()) return undefined
      this.onsuccess = () => changed(name, primKey)
      return undefined
    })
    table.hook('deleting', function (primKey, _obj, tx) {
      if ((tx as RemoteTx).__tidyRemote || !loadSync()) return
      this.onsuccess = () => changed(name, primKey)
    })
  }
}

function changed(table: string, key: unknown) {
  markDirty(table, key)
  setInfo({})
  schedulePush()
}

// ---------- 시작 / 끝 ----------

let fs: { db: Firestore; uid: string } | null = null
let unsub: Unsubscribe | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined
let pushing: Promise<void> | null = null

function tableOf(name: string): Table | undefined {
  return database?.tables.find((t) => t.name === name)
}

/** 계정 안에서 이 기기 번호를 하나 받는다 (처음 로그인할 때 한 번) */
async function claimDevice(db: Firestore, uid: string): Promise<number> {
  const { doc, runTransaction } = await import('firebase/firestore')
  const ref = doc(db, 'users', uid, 'meta', 'devices')
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref)
    const n = Math.max(1, Number(snap.data()?.next ?? 1))
    if (n > MAX_DEVICE) throw new Error('기기를 너무 많이 연결했어요')
    tx.set(ref, { next: n + 1 }, { merge: true })
    return n
  })
}

/** 이 기기 구간에서 이미 쓴 가장 큰 순번 */
async function usedSeq(device: number): Promise<number> {
  if (!database) return 0
  let max = 0
  for (const t of database.tables) {
    if (!t.schema.primKey.auto) continue
    const keys = (await t.toCollection().primaryKeys()) as number[]
    max = Math.max(max, maxSeqIn(device, keys))
  }
  return max
}

export type FirstSync = 'resume' | 'upload' | 'download' | 'choose'

/** 로그인한 뒤 무엇을 할지: 이어서 / 이 기기 것 올리기 / 클라우드 것 받기 / 고르기 */
export async function planFirstSync(db: Firestore, uid: string): Promise<FirstSync> {
  if (loadSync()?.uid === uid) return 'resume'
  const { collection, getDocs, limit, query } = await import('firebase/firestore')
  const cloud = await getDocs(query(collection(db, 'users', uid, 'rows'), limit(1)))
  const local = await hasLocalData()
  if (cloud.empty) return 'upload'
  return local ? 'choose' : 'download'
}

/** 기본 스크랩 카테고리 말고 사용자가 넣은 기록이 있는가 */
async function hasLocalData(): Promise<boolean> {
  if (!database) return false
  for (const t of database.tables) if (t.name !== 'scrapCategories' && (await t.count()) > 0) return true
  return false
}

/**
 * 동기화 시작.
 * mode: resume 이어서, upload 이 기기 것으로 클라우드를 덮어쓰기, download 클라우드 것으로 이 기기를 바꾸기
 */
export async function startSync(db: Firestore, uid: string, email: string | undefined, mode: 'resume' | 'upload' | 'download') {
  stopSync()
  fs = { db, uid }
  let s = loadSync()
  if (!s || s.uid !== uid) {
    const device = await claimDevice(db, uid)
    s = { uid, email, device, seq: await usedSeq(device), pulled: 0, dirty: {} }
    saveSync(s)
  } else {
    // localStorage 가 지워졌다가 돌아온 경우에도 같은 번호를 다시 만들지 않게
    saveSync({ ...s, email, seq: Math.max(s.seq, await usedSeq(s.device)) })
  }
  setInfo({ status: 'syncing', error: undefined })
  try {
    if (mode === 'download') await replaceLocalWithCloud()
    if (mode === 'upload') await replaceCloudWithLocal()
    await pushNow()
    await listen()
  } catch (err) {
    setInfo({ status: navigator.onLine ? 'error' : 'offline', error: err instanceof Error ? err.message : String(err) })
    // 인터넷이 없어도 받기는 다시 시도해 둔다
    if (!unsub) await listen().catch(() => undefined)
  }
  // 이동 기록은 본 DB 밖에 있어서 따로 맞춘다 (폰 · 사이트가 같은 길을 보게)
  if (fs?.uid === uid) await startRouteSync(db, uid).catch(() => undefined)
}

/** 로그아웃: 클라우드와 끊는다. 이 기기 데이터는 그대로 두거나(keep) 지운다 */
export async function stopSyncAndForget(keepLocal: boolean) {
  // 못 올린 것이 있으면 마지막으로 한 번 올려 본다
  await pushNow().catch(() => undefined)
  stopSync()
  saveSync(null)
  if (!keepLocal) {
    const { routeStore } = await import('../routeStore')
    await routeStore.wipeLocal().catch(() => undefined)
  }
  if (!keepLocal && database) {
    const { seedCategories } = await import('../../db/database')
    await database.transaction('rw', database.tables, async () => {
      await Promise.all(database!.tables.map((t) => t.clear()))
      await seedCategories(database!.scrapCategories)
    })
  }
  setInfo({ status: 'off' })
}

export function stopSync() {
  stopRouteSync()
  unsub?.()
  unsub = null
  clearTimeout(pushTimer)
  fs = null
}

// ---------- 올리기 ----------

export function schedulePush(delay = 1500) {
  if (!fs) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void pushNow().catch(() => undefined), delay)
}

/** 아직 못 올린 기록을 지금 올린다 */
export function pushNow(): Promise<void> {
  if (!fs) return Promise.resolve()
  pushing ??= doPush().finally(() => (pushing = null))
  return pushing
}

const uploadedFiles = new Set<string>()

async function doPush() {
  const s = loadSync()
  if (!fs || !s) return
  const entries = Object.entries(s.dirty)
  if (entries.length === 0) {
    if (info.status === 'syncing' || info.status === 'offline') setInfo({ status: 'idle', lastSyncedAt: Date.now() })
    return
  }
  const { db, uid } = fs
  const { doc, getDoc, serverTimestamp, setDoc, writeBatch } = await import('firebase/firestore')
  setInfo({ status: 'syncing' })
  try {
    // 400개씩 나눠서 (Firestore 한 번에 500개까지)
    for (let i = 0; i < entries.length; i += 400) {
      const part = entries.slice(i, i + 400)
      const batch = writeBatch(db)
      for (const [k] of part) {
        const { table, key } = parseDirtyKey(k)
        const t = tableOf(table)
        if (!t) continue
        const value = await t.get(key as never)
        const ref = doc(db, 'users', uid, 'rows', rowDocId(table, key))
        if (value === undefined) {
          batch.set(ref, { t: table, j: null, u: serverTimestamp(), d: s.device })
          continue
        }
        const enc = await encodeRecord(value)
        // 사진 파일은 먼저 올린다 (이미 있으면 건너뛴다)
        for (const [hash, data] of enc.files) {
          if (uploadedFiles.has(hash)) continue
          const fref = doc(db, 'users', uid, 'files', hash)
          if (!(await getDoc(fref)).exists()) await setDoc(fref, { v: data })
          uploadedFiles.add(hash)
        }
        batch.set(ref, { t: table, j: enc.json, u: serverTimestamp(), d: s.device })
      }
      await batch.commit()
      clearDirty(Object.fromEntries(part))
    }
    setInfo({ status: 'idle', lastSyncedAt: Date.now(), error: undefined })
  } catch (err) {
    setInfo({ status: navigator.onLine ? 'error' : 'offline', error: err instanceof Error ? err.message : String(err) })
    throw err
  }
}

// ---------- 받기 ----------

async function listen() {
  if (!fs) return
  const { db, uid } = fs
  const { collection, onSnapshot, query, Timestamp, where } = await import('firebase/firestore')
  const s = loadSync()
  // 시계가 조금 어긋나도 놓치지 않게 5분 겹쳐서 받는다 (같은 기록을 또 받아도 결과는 같다)
  const since = Timestamp.fromMillis(Math.max(0, (s?.pulled ?? 0) - 5 * 60_000))
  unsub = onSnapshot(
    query(collection(db, 'users', uid, 'rows'), where('u', '>', since)),
    (snap) => {
      const docs = snap.docChanges().filter((c) => c.type !== 'removed' && !c.doc.metadata.hasPendingWrites).map((c) => c.doc)
      if (docs.length) void applyRemote(docs).catch((err) => setInfo({ status: 'error', error: String(err) }))
      else if (info.status !== 'error') setInfo({ status: 'idle', lastSyncedAt: Date.now() })
    },
    (err) => setInfo({ status: navigator.onLine ? 'error' : 'offline', error: err.message }),
  )
}

export interface RemoteRow {
  table: string
  key: unknown
  json: string | null
  device: number
  at: number
}

function readRow(d: QueryDocumentSnapshot): RemoteRow | null {
  const id = parseRowDocId(d.id)
  const v = d.data() as { t?: string; j?: string | null; d?: number; u?: { toMillis(): number } }
  if (!id || !v.u) return null
  return { table: id.table, key: id.key, json: v.j ?? null, device: v.d ?? 0, at: v.u.toMillis() }
}

async function fetchFiles(hashes: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!fs || hashes.length === 0) return out
  const { db, uid } = fs
  const { doc, getDoc } = await import('firebase/firestore')
  await Promise.all(
    hashes.map(async (h) => {
      const snap = await getDoc(doc(db, 'users', uid, 'files', h)).catch(() => null)
      const v = snap?.data()?.v
      if (typeof v === 'string') {
        out.set(h, v)
        uploadedFiles.add(h)
      }
    }),
  )
  return out
}

async function applyRemote(docs: QueryDocumentSnapshot[]) {
  const s = loadSync()
  if (!s || !database) return
  const rows = docs.map(readRow).filter((r): r is RemoteRow => r !== null)
  // 이 기기가 올린 것, 이 기기에서 아직 못 올린 것은 건너뛴다
  const todo = rows.filter((r) => r.device !== s.device && !isDirty(r.table, r.key) && tableOf(r.table))
  await writeRows(todo)
  const pulled = Math.max(s.pulled, ...rows.map((r) => r.at))
  const now = loadSync()
  if (now) saveSync({ ...now, pulled })
  setInfo({ status: 'idle', lastSyncedAt: Date.now() })
}

/** 받은 기록들을 로컬 DB에 넣는다 (사진 파일은 먼저 받아 둔다). 테스트에서도 쓴다 */
export async function writeRows(rows: RemoteRow[], clearFirst = false) {
  if (!database) return
  const files = await fetchFiles([...new Set(rows.flatMap((r) => (r.json ? fileHashes(r.json) : [])))])
  const d = database
  // 이 기기에 있던 값 (못 받은 사진은 이 값으로 채운다)
  const locals = clearFirst ? [] : await Promise.all(rows.map((r) => (r.json ? tableOf(r.table)!.get(r.key as never) : undefined)))
  await d.transaction('rw', d.tables, async (tx) => {
    ;(tx as RemoteTx).__tidyRemote = true
    if (clearFirst) await Promise.all(d.tables.map((t) => t.clear()))
    for (const [i, r] of rows.entries()) {
      const t = d.table(r.table)
      if (r.json === null) {
        await t.delete(r.key as never)
        continue
      }
      const value = decodeRecord(r.json, files, locals[i]) as Record<string, unknown> | undefined
      // 사진 파일을 하나도 못 받은 스크랩 사진은 넣지 않는다
      if (!value || (r.table === 'scrapMedia' && !(value.blob instanceof Blob))) continue
      await t.put(value)
    }
  })
}

/** 클라우드 내용으로 이 기기 데이터를 모두 바꾼다 */
async function replaceLocalWithCloud() {
  if (!fs || !database) return
  const { collection, getDocs } = await import('firebase/firestore')
  const snap = await getDocs(collection(fs.db, 'users', fs.uid, 'rows'))
  const rows = snap.docs.map(readRow).filter((r): r is RemoteRow => r !== null && r.json !== null && !!tableOf(r.table))
  await writeRows(rows, true)
  const s = loadSync()
  if (s) saveSync({ ...s, dirty: {}, pulled: Math.max(0, ...snap.docs.map((d) => readRow(d)?.at ?? 0)) })
  // 받은 기록 번호들로 순번을 다시 맞춘다
  const now = loadSync()
  if (now) saveSync({ ...now, seq: Math.max(now.seq, await usedSeq(now.device)) })
}

/** 이 기기 데이터로 클라우드를 덮어쓴다: 클라우드에만 있는 기록은 지우고, 이 기기 기록은 모두 올린다 */
async function replaceCloudWithLocal() {
  if (!fs || !database) return
  const { collection, getDocs } = await import('firebase/firestore')
  const snap = await getDocs(collection(fs.db, 'users', fs.uid, 'rows'))
  const s = loadSync()
  if (!s) return
  const dirty: Record<string, number> = { ...s.dirty }
  for (const d of snap.docs) {
    const r = readRow(d)
    if (r && r.json !== null) dirty[dirtyKey(r.table, r.key)] = (dirty[dirtyKey(r.table, r.key)] ?? 0) + 1
  }
  for (const t of database.tables) {
    for (const key of await t.toCollection().primaryKeys()) dirty[dirtyKey(t.name, key)] = (dirty[dirtyKey(t.name, key)] ?? 0) + 1
  }
  saveSync({ ...s, dirty, pulled: Date.now() })
}

/** 테스트용 */
export function _setFirestoreForTest(v: { db: Firestore; uid: string } | null) {
  fs = v
}

export type { SyncState }

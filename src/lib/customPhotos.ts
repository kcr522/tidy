/**
 * 꾸미기 사진 보관함 (사용자 요청 2026-11-10: 사진 크게, 여러 장)
 * localStorage 는 5MB 정도라 큰 사진 한 장도 안 들어갔다.
 * 사진은 IndexedDB(이 기기 안)에 Blob 으로 넣고, 꾸미기 설정에는 'idb:번호' 이름만 적는다.
 * 앱 데이터 DB 와 따로 두어서 데이터 DB 버전에는 영향이 없다.
 */
import Dexie, { type Table } from 'dexie'

interface StoredPhoto {
  id: string
  blob: Blob
  createdAt: string
}

class PhotoDB extends Dexie {
  photos!: Table<StoredPhoto, string>
  constructor() {
    super('tidy-photos')
    this.version(1).stores({ photos: 'id' })
  }
}

let db: PhotoDB | null = null
const photoDb = () => (db ??= new PhotoDB())

/** 'idb:번호' → 화면에 쓸 주소 (blob:) */
const urls = new Map<string, string>()

export const isStoredRef = (v: unknown): v is string => typeof v === 'string' && /^idb:[\w-]{6,64}$/.test(v)
/** 예전에 localStorage 에 바로 넣던 사진 (data:image/...) 도 그대로 읽는다 */
export const isInlinePhoto = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image/')
export const isPhotoRef = (v: unknown): v is string => isStoredRef(v) || isInlinePhoto(v)

/** 사진을 보관하고 이름('idb:번호')을 돌려준다 */
export async function storePhoto(blob: Blob): Promise<string> {
  const id = crypto.randomUUID()
  await photoDb().photos.put({ id, blob, createdAt: new Date().toISOString() })
  const ref = `idb:${id}`
  urls.set(ref, URL.createObjectURL(blob))
  return ref
}

/** 지금 바로 쓸 수 있는 주소. 아직 안 읽은 사진이면 undefined (loadPhotos 를 먼저) */
export function photoSrc(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined
  if (isInlinePhoto(ref)) return ref
  return urls.get(ref)
}

/** 보관함에서 사진들을 읽어 둔다 */
export async function loadPhotos(refs: string[]): Promise<void> {
  const ids = refs.filter((r) => isStoredRef(r) && !urls.has(r)).map((r) => r.slice(4))
  if (ids.length === 0) return
  const rows = await photoDb().photos.bulkGet(ids)
  rows.forEach((row) => row && urls.set(`idb:${row.id}`, URL.createObjectURL(row.blob)))
}

/** 꾸미기에서 더 이상 쓰지 않는 사진을 지운다 */
export async function prunePhotos(keep: string[]): Promise<void> {
  const keepIds = new Set(keep.filter(isStoredRef).map((r) => r.slice(4)))
  const all = await photoDb().photos.toCollection().primaryKeys()
  const drop = all.filter((id) => !keepIds.has(id))
  if (drop.length === 0) return
  await photoDb().photos.bulkDelete(drop)
  drop.forEach((id) => {
    const u = urls.get(`idb:${id}`)
    if (u) URL.revokeObjectURL(u)
    urls.delete(`idb:${id}`)
  })
}

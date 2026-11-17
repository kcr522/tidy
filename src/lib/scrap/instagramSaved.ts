// 인스타그램 "내 정보 다운로드" 파일에서 저장한(북마크한) 게시물 목록을 읽는다
// 인스타 공식 API로는 저장 목록을 가져올 수 없어서, 사용자가 받은 파일(zip · json · html)을 읽는 방식으로 한다

export interface SavedPost {
  /** https://www.instagram.com/p/코드/ 또는 /reel/코드/ */
  url: string
  /** 게시물 코드 (같은 게시물 찾기용) */
  code: string
  /** 저장한 때 (ISO), 모르면 없음 */
  savedAt?: string
  /** 게시물 올린 사람 아이디 */
  author?: string
  /** 인스타 컬렉션 이름 */
  collection?: string
}

const POST = /instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]{5,})/i

/** 인스타 게시물 주소 → 코드와 깔끔한 주소. 게시물 주소가 아니면 null */
export function instagramPost(url: string): { code: string; url: string } | null {
  const m = url.match(POST)
  if (!m) return null
  const kind = m[1].toLowerCase() === 'p' || m[1].toLowerCase() === 'tv' ? 'p' : 'reel'
  return { code: m[2], url: `https://www.instagram.com/${kind}/${m[2]}/` }
}

const toIso = (ts: unknown): string | undefined => {
  const n = typeof ts === 'number' ? ts : typeof ts === 'string' && /^\d+$/.test(ts) ? Number(ts) : NaN
  if (!Number.isFinite(n) || n <= 0) return undefined
  return new Date(n < 1e12 ? n * 1000 : n).toISOString()
}

type Json = unknown
const isObj = (v: Json): v is Record<string, Json> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** 항목 하나 (saved_posts 의 한 줄, 또는 컬렉션 안의 한 줄)에서 주소 · 시간 찾기 */
function readEntry(e: Record<string, Json>): { url?: string; ts?: Json; name?: string } {
  const out: { url?: string; ts?: Json; name?: string } = {}
  const visit = (v: Json) => {
    if (Array.isArray(v)) return v.forEach(visit)
    if (!isObj(v)) return
    if (typeof v.href === 'string' && !out.url && POST.test(v.href)) out.url = v.href
    if (v.timestamp != null && out.ts == null && Number(v.timestamp) > 0) out.ts = v.timestamp
    for (const [k, x] of Object.entries(v)) if (k !== 'href' && k !== 'timestamp') visit(x)
  }
  visit(e)
  // 컬렉션 머리 줄: string_map_data.Name.value (한국어 파일은 '이름')
  const map = isObj(e.string_map_data) ? e.string_map_data : null
  const nameField = map && (map.Name ?? map['이름'])
  if (isObj(nameField) && typeof nameField.value === 'string') out.name = nameField.value
  return out
}

/** saved_posts.json / saved_collections.json 내용 → 게시물 목록 */
export function parseSavedJson(text: string): SavedPost[] {
  let data: Json
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  const out: SavedPost[] = []
  const push = (url: string | undefined, ts: Json, author?: string, collection?: string) => {
    const p = url && instagramPost(url)
    if (!p) return
    out.push({ ...p, savedAt: toIso(ts), author: author && author !== 'Collection' ? author : undefined, collection })
  }
  const lists: { list: Json[]; collections: boolean }[] = []
  if (isObj(data)) {
    for (const [k, v] of Object.entries(data)) if (Array.isArray(v)) lists.push({ list: v, collections: /collection/i.test(k) })
  } else if (Array.isArray(data)) lists.push({ list: data, collections: false })
  for (const { list, collections } of lists) {
    let current: string | undefined
    for (const e of list) {
      if (!isObj(e)) continue
      const r = readEntry(e)
      const title = typeof e.title === 'string' ? e.title : undefined
      if (collections && (title === 'Collection' || title === '컬렉션' || (!r.url && r.name))) {
        current = r.name ?? current
        continue
      }
      // 컬렉션 파일의 게시물 줄은 Name.value 가 올린 사람 아이디
      push(r.url, r.ts, collections ? (r.name ?? title) : title, collections ? current : undefined)
    }
  }
  return out
}

/** HTML 형식으로 받은 파일: 게시물 주소만 모은다 */
export function parseSavedHtml(html: string): SavedPost[] {
  const out: SavedPost[] = []
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const p = instagramPost(m[1].replace(/&amp;/g, '&'))
    if (p) out.push(p)
  }
  return out
}

/** 같은 게시물은 하나로 (컬렉션 정보가 있는 쪽, 저장 시간이 있는 쪽을 남김) */
export function mergeSaved(list: SavedPost[]): SavedPost[] {
  const by = new Map<string, SavedPost>()
  for (const p of list) {
    const old = by.get(p.code)
    if (!old) by.set(p.code, { ...p })
    else by.set(p.code, { ...old, savedAt: old.savedAt ?? p.savedAt, author: old.author ?? p.author, collection: old.collection ?? p.collection })
  }
  // 최근에 저장한 게시물이 앞으로
  return [...by.values()].sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''))
}

// ---------- zip 읽기 (라이브러리 없이: 압축 안 함 / deflate 만) ----------

interface ZipEntry {
  name: string
  method: number
  compSize: number
  offset: number
}

async function bytes(file: Blob, start: number, end: number): Promise<DataView> {
  return new DataView(await file.slice(start, end).arrayBuffer())
}

/** zip 안 파일 목록 (중앙 디렉터리) */
async function zipEntries(file: Blob): Promise<ZipEntry[]> {
  const tailSize = Math.min(file.size, 66_000)
  const tail = await bytes(file, file.size - tailSize, file.size)
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('zip 파일이 아니에요')
  const count = tail.getUint16(eocd + 10, true)
  const cdSize = tail.getUint32(eocd + 12, true)
  const cdOffset = tail.getUint32(eocd + 16, true)
  const cd = await bytes(file, cdOffset, cdOffset + cdSize)
  const out: ZipEntry[] = []
  const dec = new TextDecoder()
  let p = 0
  for (let i = 0; i < count && p + 46 <= cd.byteLength; i++) {
    if (cd.getUint32(p, true) !== 0x02014b50) break
    const method = cd.getUint16(p + 10, true)
    const compSize = cd.getUint32(p + 20, true)
    const nameLen = cd.getUint16(p + 28, true)
    const extraLen = cd.getUint16(p + 30, true)
    const commentLen = cd.getUint16(p + 32, true)
    const offset = cd.getUint32(p + 42, true)
    const name = dec.decode(new Uint8Array(cd.buffer, cd.byteOffset + p + 46, nameLen))
    out.push({ name, method, compSize, offset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

async function zipRead(file: Blob, e: ZipEntry): Promise<string> {
  const head = await bytes(file, e.offset, e.offset + 30)
  const start = e.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true)
  const raw = file.slice(start, start + e.compSize)
  if (e.method === 0) return raw.text()
  if (e.method !== 8) throw new Error('읽을 수 없는 압축 방식이에요')
  const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

const SAVED_FILE = /(^|\/)saved_(posts|collections)\.(json|html)$/i

/** 사용자가 고른 파일 하나 (zip · json · html) → 저장한 게시물 목록 */
export async function readInstagramSaved(file: File): Promise<SavedPost[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.json')) return mergeSaved(parseSavedJson(await file.text()))
  if (name.endsWith('.html') || name.endsWith('.htm')) return mergeSaved(parseSavedHtml(await file.text()))
  const entries = (await zipEntries(file)).filter((e) => SAVED_FILE.test(e.name))
  if (!entries.length) throw new Error('파일 안에 "저장됨" 목록이 없어요. 내려받을 때 "저장됨"을 골랐는지 확인해 주세요')
  const all: SavedPost[] = []
  for (const e of entries) {
    const text = await zipRead(file, e)
    all.push(...(e.name.toLowerCase().endsWith('.json') ? parseSavedJson(text) : parseSavedHtml(text)))
  }
  return mergeSaved(all)
}

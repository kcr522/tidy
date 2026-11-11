/**
 * 기기 동기화: 기록 하나를 클라우드(Firestore)에 올릴 글자로 바꾸고, 받은 글자를 다시 기록으로 바꾼다.
 *
 * - 기록은 JSON 글자 하나로 올린다 (Firestore 는 undefined·배열 속 배열을 못 받아서)
 * - 사진(data URL 글자, Blob 파일)은 따로 "파일"로 올리고, 기록 안에는 {"$f": 해시}만 남긴다.
 *   같은 사진은 해시가 같아서 한 번만 올라간다. Firestore 문서 하나는 1MB까지라 그보다 큰 파일(화면 녹화 등)은
 *   {"$skip": 1}로 남기고 이 기기에만 둔다. 받을 때 이 기기에 있던 파일이 있으면 그대로 둔다.
 */

/** 문서 하나에 넣을 수 있는 파일 크기 (글자 수). Firestore 한도 1MiB 보다 조금 작게 */
export const MAX_FILE_CHARS = 900_000
/** 이보다 짧은 data URL 은 기록 안에 그대로 둔다 (작은 아이콘 등) */
export const INLINE_DATA_URL_CHARS = 2_000

export type FileRef = { $f: string }
export type SkipRef = { $skip: 1 }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isFileRef = (v: unknown): v is FileRef => isObj(v) && typeof v.$f === 'string' && Object.keys(v).length === 1
const isSkipRef = (v: unknown): v is SkipRef => isObj(v) && v.$skip === 1 && Object.keys(v).length === 1
const isBlob = (v: unknown): v is Blob => typeof Blob !== 'undefined' && v instanceof Blob

/** 클라우드 문서 이름: 표 이름 + 기본 키 (키에 / 같은 글자가 있어도 되게 바꿔 넣는다) */
export function rowDocId(table: string, key: unknown): string {
  return `${table}~${encodeURIComponent(JSON.stringify(key))}`
}

export function parseRowDocId(id: string): { table: string; key: unknown } | null {
  const i = id.indexOf('~')
  if (i <= 0) return null
  try {
    return { table: id.slice(0, i), key: JSON.parse(decodeURIComponent(id.slice(i + 1))) }
  } catch {
    return null
  }
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(s)}`
}

export function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(',', 2)
  const type = head.slice(5).replace(/;base64$/, '')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export interface Encoded {
  json: string
  /** 따로 올릴 파일: 해시 → data URL */
  files: Map<string, string>
}

/** 기록 → 올릴 글자 + 파일들 */
export async function encodeRecord(value: unknown): Promise<Encoded> {
  const files = new Map<string, string>()
  async function walk(v: unknown): Promise<unknown> {
    if (isBlob(v)) {
      if (v.size * 1.37 > MAX_FILE_CHARS) return { $skip: 1 }
      return fileRef(await blobToDataUrl(v), true)
    }
    if (typeof v === 'string') return v.startsWith('data:') && v.length > INLINE_DATA_URL_CHARS ? fileRef(v, false) : v
    if (Array.isArray(v)) return Promise.all(v.map(walk))
    if (isObj(v)) {
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) if (x !== undefined) out[k] = await walk(x)
      return out
    }
    return v
  }
  async function fileRef(dataUrl: string, blob: boolean): Promise<FileRef | SkipRef> {
    if (dataUrl.length > MAX_FILE_CHARS) return { $skip: 1 }
    // Blob 이었는지 글자였는지 기억해서 받을 때 같은 모양으로 되돌린다
    const hash = (blob ? 'b' : 's') + (await sha256(dataUrl))
    files.set(hash, dataUrl)
    return { $f: hash }
  }
  return { json: JSON.stringify(await walk(value)), files }
}

/** 기록 안에서 필요한 파일 해시들 */
export function fileHashes(json: string): string[] {
  const out = new Set<string>()
  JSON.parse(json, (_k, v) => {
    if (isFileRef(v)) out.add(v.$f)
    return v
  })
  return [...out]
}

/**
 * 받은 글자 → 기록.
 * files 에 없는 파일, $skip 은 이 기기에 있던 같은 자리의 값(local)으로 채운다. 그것도 없으면 그 칸을 뺀다
 * (배열 안이면 그 항목을 뺀다: 사진 목록에서 못 받은 사진만 빠진다).
 */
export function decodeRecord(json: string, files: Map<string, string>, local?: unknown): unknown {
  const DROP = Symbol('drop')
  function walk(v: unknown, loc: unknown): unknown {
    if (isFileRef(v)) {
      const data = files.get(v.$f)
      if (data !== undefined) return v.$f.startsWith('b') ? dataUrlToBlob(data) : data
      return loc !== undefined && loc !== null ? loc : DROP
    }
    if (isSkipRef(v)) return loc !== undefined && loc !== null ? loc : DROP
    if (Array.isArray(v)) {
      const la = Array.isArray(loc) ? loc : []
      return v.map((x, i) => walk(x, la[i])).filter((x) => x !== DROP)
    }
    if (isObj(v)) {
      const lo = isObj(loc) ? loc : {}
      const out: Record<string, unknown> = {}
      for (const [k, x] of Object.entries(v)) {
        const r = walk(x, lo[k])
        if (r !== DROP) out[k] = r
      }
      return out
    }
    return v
  }
  const r = walk(JSON.parse(json), local)
  return r === DROP ? undefined : r
}

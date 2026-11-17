/**
 * 캘린더 일정 메모·일기에 붙이는 사진과 파일 (사용자 요청 2026-11-12)
 *
 * - 파일은 data URL 글자로 기록 안에 넣는다. 그래서 백업 파일과 기기 동기화가 따로 손대지 않아도 같이 된다
 *   (동기화는 data URL 을 따로 "파일"로 올린다. Firestore 문서 하나 한도 때문에 약 650KB 보다 큰 파일은 이 기기에만 남는다)
 * - 사진은 줄여서 넣고(용량 절약), GIF 는 움직임이 살아 있게 그대로 넣는다
 */
import { MAX_FILE_CHARS, blobToDataUrl } from './sync/codec'
import type { Attachment } from '../db/types'

export const MAX_ATTACHMENTS = 10
/** 파일 하나 최대 크기 (이 기기 저장 기준) */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
/** 이보다 크면 다른 기기로 동기화되지 않는다 (data URL 은 원래 크기의 약 4/3배) */
export const SYNC_ATTACHMENT_BYTES = Math.floor((MAX_FILE_CHARS - 100) * 0.75)

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export const isDataUrl = (v: unknown): v is string => typeof v === 'string' && /^data:[\w/+.-]*(;[\w=.-]+)*;base64,/.test(v)

export function isAttachment(v: unknown): v is Attachment {
  return isObj(v) && typeof v.name === 'string' && typeof v.type === 'string' && typeof v.size === 'number' && Number.isFinite(v.size) && isDataUrl(v.src)
}

export const isAttachmentList = (v: unknown): boolean => v === undefined || (Array.isArray(v) && v.every(isAttachment))

/** 저장할 모양으로: 잘못된 것은 빼고 10개까지 */
export function cleanAttachments(list: readonly Attachment[] | undefined): Attachment[] {
  return (list ?? [])
    .filter(isAttachment)
    .slice(0, MAX_ATTACHMENTS)
    .map((a) => ({ name: a.name.trim().slice(0, 120) || '파일', type: a.type, size: a.size, src: a.src }))
}

export const isImage = (a: Pick<Attachment, 'type'>) => a.type.startsWith('image/')
export const isVideo = (a: Pick<Attachment, 'type'>) => a.type.startsWith('video/')
export const isGif = (a: Pick<Attachment, 'type'>) => a.type === 'image/gif'

/** 다른 기기로도 넘어가는지 */
export const syncsToCloud = (a: Pick<Attachment, 'src'>) => a.src.length <= MAX_FILE_CHARS

/** 1,234B / 12KB / 3.4MB */
export function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`
  return `${(n / 1024 / 1024).toFixed(1).replace(/\.0$/, '')}MB`
}

/** 파일 이름 끝 확장자 (대문자, 없으면 '파일') */
export function extLabel(name: string): string {
  const m = /\.([a-z0-9]{1,5})$/i.exec(name)
  return m ? m[1].toUpperCase() : '파일'
}

/** data URL 안 내용의 바이트 수 */
export function dataUrlBytes(src: string): number {
  const b64 = src.slice(src.indexOf(',') + 1)
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((b64.length * 3) / 4) - pad)
}

/** 파일 → data URL (종류를 모르면 application/octet-stream) */
export const readAsDataUrl = (file: Blob): Promise<string> => blobToDataUrl(file)

export class AttachmentTooBigError extends Error {
  constructor(name: string, max = MAX_ATTACHMENT_BYTES) {
    super(`${name}: ${formatBytes(max)}보다 큰 파일은 넣을 수 없어요`)
    this.name = 'AttachmentTooBigError'
  }
}

/** 줄여 넣을 사진 (GIF·SVG 는 그대로) */
const shrinkable = (type: string, name: string) => (/^image\/(jpeg|png|webp|heic|heif|bmp)$/.test(type) || /\.(heic|heif)$/i.test(name))

/**
 * 고른 파일 하나 → 첨부.
 * 사진은 긴 쪽 1600px JPEG 으로 줄이고(못 줄이면 그대로), 나머지(GIF, PDF, 문서 등)는 그대로 넣는다.
 */
export async function fileToAttachment(file: File, shrink: (f: File) => Promise<string>, maxBytes = MAX_ATTACHMENT_BYTES): Promise<Attachment> {
  const name = file.name || '파일'
  if (shrinkable(file.type, name)) {
    try {
      const src = await shrink(file)
      return { name: name.replace(/\.(heic|heif|png|webp|bmp)$/i, '.jpg'), type: 'image/jpeg', size: dataUrlBytes(src), src }
    } catch {
      // 열 수 없는 사진이면 파일 그대로
    }
  }
  if (file.size > maxBytes) throw new AttachmentTooBigError(name, maxBytes)
  const src = await readAsDataUrl(file)
  return { name, type: file.type || 'application/octet-stream', size: file.size, src }
}

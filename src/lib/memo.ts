/**
 * 메모 (사용자 요청 2026-11-17)
 * 글 + 사진·영상·파일을 남기고, 비슷한 것끼리 색깔 있는 파일집에 모은다.
 * 쓴 시각이 그대로 남아서 날짜별·시간순으로 보인다.
 */
import type { Attachment, Memo, MemoInk } from '../db/types'
import { isDataUrl } from './attachments'
import { toDateKey } from './date'

export const MAX_MEMO_TITLE = 60
export const MAX_MEMO_TEXT = 10000
/** 꾸민 글 html 최대 길이 (사진은 따로라 글자 · 꾸밈만) */
export const MAX_MEMO_HTML = 200000
export const MAX_FOLDER_NAME = 12
/** 메모에 붙이는 파일 하나 최대 크기 (영상 때문에 일기·일정보다 크게) */
export const MAX_MEMO_FILE_BYTES = 50 * 1024 * 1024
/** 메모 하나에 손글씨 몇 장까지 */
export const MAX_MEMO_INK = 10
/** 손글씨에서 읽은 글자 최대 길이 */
export const MAX_INK_TEXT = 2000

/** 저장할 모양으로 다듬는다: 그림이 아닌 것은 빼고, 10장까지 */
export function cleanInk(list: readonly MemoInk[] | undefined): MemoInk[] {
  return (list ?? [])
    .filter((k) => isDataUrl(k.src) && k.src.startsWith('data:image/') && typeof k.at === 'string')
    .slice(0, MAX_MEMO_INK)
    .map((k) => (typeof k.text === 'string' ? { src: k.src, text: k.text.trim().slice(0, MAX_INK_TEXT), at: k.at } : { src: k.src, at: k.at }))
}

/** 손글씨에서 읽은 글자를 한 덩어리로 (검색·제목용) */
export const inkText = (m: Pick<Memo, 'ink'>) => (m.ink ?? []).map((k) => k.text ?? '').filter(Boolean).join('\n')

/** 파일집 색 (밝은 화면·어두운 화면 둘 다 읽히는 중간 밝기) */
export const MEMO_FOLDER_COLORS: { name: string; hex: string }[] = [
  { name: '빨강', hex: '#e5484d' },
  { name: '주황', hex: '#f0802b' },
  { name: '노랑', hex: '#d4a017' },
  { name: '연두', hex: '#7cb342' },
  { name: '초록', hex: '#2ea97c' },
  { name: '청록', hex: '#14a3a8' },
  { name: '하늘', hex: '#3d93dc' },
  { name: '파랑', hex: '#4f63e0' },
  { name: '보라', hex: '#8c70da' },
  { name: '분홍', hex: '#e2607f' },
  { name: '갈색', hex: '#a0715a' },
  { name: '회색', hex: '#7d8796' },
]

/** 목록에 보일 제목: 제목이 없으면 글 첫 줄 */
export function memoTitle(m: Pick<Memo, 'title' | 'text' | 'attachments' | 'ink'>): string {
  const t = m.title.trim()
  if (t) return t
  const line = [m.text, inkText(m)].join('\n').split('\n').map((l) => l.trim()).find(Boolean)
  if (line) return line.length > 40 ? `${line.slice(0, 40)}…` : line
  if (m.ink?.length) return '손글씨 메모'
  return m.attachments?.length ? '파일만 있는 메모' : '빈 메모'
}

/** 목록에 보일 미리보기 글: 제목이 있으면 글 앞부분, 없으면 첫 줄 다음부터 */
export function memoPreview(m: Pick<Memo, 'title' | 'text'>): string {
  const lines = m.text.split('\n').map((l) => l.trim()).filter(Boolean)
  return (m.title.trim() ? lines : lines.slice(1)).join(' ')
}

export const memoFileNames = (list: Attachment[] | undefined) => (list ?? []).map((a) => a.name).join(' ')

/** 고정 먼저, 그다음 최근에 쓴 것부터 */
export function sortMemos(list: Memo[]): Memo[] {
  return [...list].sort((a, b) => (b.pinned ?? 0) - (a.pinned ?? 0) || b.createdAt.localeCompare(a.createdAt) || (b.id ?? 0) - (a.id ?? 0))
}

/** 쓴 날짜별로 묶는다 (고정 메모는 맨 위 '고정' 묶음) */
export function groupByDay(list: Memo[]): { key: string; memos: Memo[] }[] {
  const groups: { key: string; memos: Memo[] }[] = []
  for (const m of sortMemos(list)) {
    const key = m.pinned ? 'pinned' : toDateKey(new Date(m.createdAt))
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.memos.push(m)
    else groups.push({ key, memos: [m] })
  }
  return groups
}

/** 검색어 (띄어쓰기로 나눈 낱말이 모두 들어 있어야) 로 거른다. 제목·글·손글씨·파일 이름에서 찾는다 */
export function filterMemos(list: Memo[], query: string): Memo[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!terms.length) return list
  return list.filter((m) => {
    const hay = `${m.title}\n${m.text}\n${inkText(m)}\n${memoFileNames(m.attachments)}`.toLowerCase()
    return terms.every((t) => hay.includes(t))
  })
}

/** "오후 2:05" */
export const clockLabel = (iso: string) => new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** "2026년 11월 17일 (화) 오후 2:05" */
export function fullWhen(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${'일월화수목금토'[d.getDay()]}) ${clockLabel(iso)}`
}

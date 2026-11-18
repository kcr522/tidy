/**
 * 시간별 일기 (사용자 요청 2026-11-18)
 * 하루를 1시간씩 칸으로 나눠서, 칸마다 그 시간에 있었던 일을 쓰고 그 시간에 찍은 사진을 모아 보여 준다.
 * 세로 선 위에 시간마다 점을 찍은 타임라인 모양.
 * 칸 글은 메모처럼 꾸밀 수 있다 (형광펜 · 글머리 기호 · 기울임 · 글 크기 · 글 색 · 손글씨 그림)
 */
import type { DiaryHour, DiaryPhoto, MemoPic } from '../db/types'
import { isDataUrl } from './attachments'
import { MAX_MEMO_HTML } from './memo'
import { isPlainHtml, sanitizeHtml } from './richText'

export const MAX_HOUR_TEXT = 2000
/** 시간 칸 하나에 글 사이 사진 · 손글씨 그림 몇 장까지 */
export const MAX_HOUR_PICS = 5

const isHour = (h: unknown): h is number => typeof h === 'number' && Number.isInteger(h) && h >= 0 && h <= 23

/** 시간 칸 하나를 저장할 모양으로. 글도 그림도 없으면 null */
function cleanOne(h: DiaryHour): DiaryHour | null {
  if (!isHour(h.hour) || typeof h.text !== 'string') return null
  const text = h.text.trim().slice(0, MAX_HOUR_TEXT)
  const pics = (h.pics ?? []).filter((p) => typeof p.id === 'string' && typeof p.src === 'string' && isDataUrl(p.src) && p.src.startsWith('data:image/')).slice(0, MAX_HOUR_PICS)
  const html = typeof h.html === 'string' && h.html.length <= MAX_MEMO_HTML ? sanitizeHtml(h.html) : undefined
  // html 안에 실제로 있는 그림만 남긴다
  const used = pics.filter((p) => html?.includes(`data-pic="${p.id}"`))
  if (!text && !used.length) return null
  const out: DiaryHour = { hour: h.hour, text }
  if (html && (used.length || !isPlainHtml(html))) {
    out.html = html
    if (used.length) out.pics = used
  }
  return out
}

/** 저장할 모양으로 다듬는다: 빈 칸·잘못된 시간은 빼고, 같은 시간은 하나만, 시간 순서 */
export function cleanHours(hours: DiaryHour[]): DiaryHour[] {
  const byHour = new Map<number, DiaryHour>()
  for (const h of hours) {
    const c = cleanOne(h)
    if (c && !byHour.has(c.hour)) byHour.set(c.hour, c)
  }
  return [...byHour.values()].sort((a, b) => a.hour - b.hour)
}

/** 'HH:mm' 의 시. 시간이 없으면 null */
export function hourOf(time: string | undefined): number | null {
  if (!time) return null
  const h = Number(time.slice(0, 2))
  return isHour(h) ? h : null
}

/** 0 → '오전 12시', 9 → '오전 9시', 13 → '오후 1시' */
export function hourLabel(h: number): string {
  return `${h < 12 ? '오전' : '오후'} ${h % 12 || 12}시`
}

/** 9 → '09:00' */
export const hourTime = (h: number) => `${String(h).padStart(2, '0')}:00`

/** 사진을 그 시간 칸에 넣을 때의 시간: 찍은 시간이 그 칸이면 그대로, 아니면 그 칸의 정각 */
export function timeInHour(time: string | undefined, h: number): string {
  return hourOf(time) === h ? time! : hourTime(h)
}

/** 편집 중인 시간 칸 값 */
export interface HourValue {
  text: string
  html?: string
  pics?: MemoPic[]
}

/** 글이나 그림이 있는 칸인가 */
export const hasContent = (v: HourValue | undefined) => !!v && (v.text.trim() !== '' || !!v.pics?.length)

/**
 * 타임라인에 보일 시간들.
 * 기본은 글이나 사진이 있는 시간 + 직접 더한 시간만, showAll 이면 0~23시 전부.
 */
export function visibleHours(values: Record<number, HourValue>, photos: DiaryPhoto[], extra: number[], showAll: boolean): number[] {
  if (showAll) return Array.from({ length: 24 }, (_, i) => i)
  const set = new Set<number>(extra)
  for (const [h, v] of Object.entries(values)) if (hasContent(v)) set.add(Number(h))
  for (const p of photos) {
    const h = hourOf(p.time)
    if (h !== null) set.add(h)
  }
  return [...set].filter(isHour).sort((a, b) => a - b)
}

/** 저장된 칸들을 { 시: 값 } 으로 */
export function hoursToMap(hours: DiaryHour[] | undefined): Record<number, HourValue> {
  const out: Record<number, HourValue> = {}
  for (const { hour, ...v } of hours ?? []) out[hour] = v
  return out
}

/** { 시: 값 } 을 저장할 칸들로 */
export function mapToHours(map: Record<number, HourValue>): DiaryHour[] {
  return cleanHours(Object.entries(map).map(([hour, v]) => ({ hour: Number(hour), ...v })))
}

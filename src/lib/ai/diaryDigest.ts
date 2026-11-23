/**
 * 일기 하루 정리 자동으로 채우기 (사용자 요청 2026-11-23)
 * 시간별 칸에 간단히 적은 것들을 시간마다 한 줄(길어도 두 줄 안)로 줄여서 하루 정리 칸에 넣는다.
 * AI 순서는 다른 AI 기능과 같다: Tidy AI·내 Gemini 키 → 예비 Groq → 기본(AI 없이, 규칙으로 줄이기)
 */
import type { DiaryPhoto } from '../../db/types'
import { hourLabel, hourOf, type HourValue } from '../diaryHours'
import { effectiveAi, type AiSettings, type EngineId } from './engines'
import { callGemini } from './gemini'
import { callGroq } from './groq'

/** 정리할 시간 칸 하나: 그 시간에 쓴 글과 사진 아래 작은 글 */
export interface DigestHour {
  hour: number
  text: string
}

/** 한 시간 줄에 들어갈 내용 글자 수 (시간 글자 빼고). 폰에서 두 줄을 넘지 않게 */
export const MAX_DIGEST_LINE = 45

const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** 시간 칸 글 + 그 시간에 찍은 사진의 작은 글을 시간 순서로 모은다. 글이 하나도 없는 시간은 뺀다 */
export function digestHours(values: Record<number, HourValue>, photos: DiaryPhoto[]): DigestHour[] {
  const byHour = new Map<number, string[]>()
  const add = (h: number, s: string | undefined) => {
    const t = s?.trim()
    if (!t) return
    byHour.set(h, [...(byHour.get(h) ?? []), t])
  }
  for (const [h, v] of Object.entries(values)) add(Number(h), v.text)
  for (const p of photos) {
    const h = hourOf(p.time)
    if (h !== null) add(h, p.note)
  }
  return [...byHour.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([hour, parts]) => ({ hour, text: parts.join('\n').slice(0, 1500) }))
}

/** 'n시 · 내용' 한 줄 */
const line = (hour: number, body: string) => `${hourLabel(hour)} · ${body}`

/** 글을 MAX_DIGEST_LINE 자 안으로: 문장·줄을 앞에서부터 쉼표로 이어 붙이고, 넘치면 자른다 */
export function shorten(text: string, max = MAX_DIGEST_LINE): string {
  const pieces = text
    .split(/\n+|(?<=[.!?。~])\s+/)
    .map((p) => squash(p.replace(/^[-•*·\d.)\s]+/, '')).replace(/[.。]+$/, ''))
    .filter((p) => p.length > 0)
  let out = ''
  for (const p of pieces) {
    const next = out ? `${out}, ${p}` : p
    if (next.length > max) break
    out = next
  }
  if (!out) out = pieces[0] ? `${pieces[0].slice(0, max - 1).trim()}…` : ''
  return out
}

/** AI 없이 정리: 시간마다 쓴 글을 짧게 줄여서 한 줄씩 */
export function localDigest(hours: DigestHour[]): string {
  return hours
    .map((h) => ({ hour: h.hour, body: shorten(h.text) }))
    .filter((h) => h.body)
    .map((h) => line(h.hour, h.body))
    .join('\n')
}

export const DIGEST_SYSTEM = `너는 "Tidy" 앱의 일기 정리 도우미야. 사용자가 하루를 1시간 칸으로 나눠 간단히 적은 메모를 받아서, 시간마다 한 줄로 짧게 정리해 줘.

형식 (꼭 지켜):
- 받은 시간마다 딱 한 줄. 받은 시간 순서 그대로, 받은 시간만.
- 각 줄은 "오전 9시 · 내용" 처럼 받은 시간 글자 그대로 쓰고 " · " 뒤에 내용.
- 내용은 ${MAX_DIGEST_LINE}자 안으로. 그 시간에 한 일과 느낌의 핵심만, "~함", "~했음" 처럼 짧은 말투로.
- 메모에 없는 일은 지어내지 마. 이름·장소·음식처럼 나중에 기억할 단어는 남겨.
- 머리말, 맺음말, 마크다운, 글머리 기호 없이 줄들만 써.`

export function digestPrompt(hours: DigestHour[]): string {
  return `${hours.map((h) => `[${hourLabel(h.hour)}]\n${h.text}`).join('\n\n')}\n\n위 시간들을 한 줄씩 정리해 줘.`
}

/**
 * AI 답을 하루 정리 칸에 넣을 모양으로: 빈 줄·글머리 기호·마크다운을 걷어 내고, 줄마다 길이를 줄인다.
 * 줄이 하나도 안 남으면 빈 글
 */
export function cleanDigest(raw: string, hours: DigestHour[]): string {
  const known = new Set(hours.map((h) => hourLabel(h.hour)))
  const lines = raw
    .split('\n')
    .map((l) => squash(l.replace(/^[-•*\s]+/, '').replace(/\*\*/g, '')))
    .filter((l) => l.length > 0)
  const out: string[] = []
  for (const l of lines) {
    const m = l.match(/^(오[전후] \d{1,2}시)\s*[·:\-–]\s*(.+)$/)
    if (!m || !known.has(m[1])) continue
    const body = m[2].length > MAX_DIGEST_LINE + 15 ? `${m[2].slice(0, MAX_DIGEST_LINE + 14).trim()}…` : m[2]
    out.push(`${m[1]} · ${body}`)
  }
  return out.slice(0, 24).join('\n')
}

export interface DigestResult {
  text: string
  engine: EngineId
}

export class DigestError extends Error {}

/** 설정 > AI 연결에서 고른 방법으로 하루 정리를 만든다 */
export async function digestDiary(chosen: AiSettings, hours: DigestHour[], signal?: AbortSignal): Promise<DigestResult> {
  const settings = effectiveAi(chosen)
  const key = settings.engine === 'gemini' ? settings.geminiKey?.trim() : undefined
  if (!key) return { text: localDigest(hours), engine: 'local' }
  const engine: EngineId = chosen.engine === 'tidy' ? 'tidy' : 'gemini'
  try {
    const text = cleanDigest(await callGemini(key, { system: DIGEST_SYSTEM, parts: [{ text: digestPrompt(hours) }], maxTokens: 1024, signal }), hours)
    if (text) return { text, engine }
    throw new Error('AI가 정리한 글을 읽지 못했어요')
  } catch (err) {
    if (signal?.aborted) throw err
    const groq = settings.groqKey?.trim()
    if (groq) {
      try {
        const text = cleanDigest((await callGroq(groq, { system: DIGEST_SYSTEM, user: digestPrompt(hours), maxTokens: 1024, signal })).text, hours)
        if (text) return { text, engine: 'groq' }
      } catch (err2) {
        if (signal?.aborted) throw err2
      }
    }
    throw new DigestError(err instanceof Error && err.message ? err.message : '지금은 AI에 연결하지 못했어요')
  }
}

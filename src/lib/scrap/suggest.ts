// 스크랩 카테고리 추천 (AI 없이). 내가 만든 카테고리 중 어디에 넣을지 아래를 보고 점수를 매긴다
// 1) 카테고리 이름 낱말이 제목·캡션에 나오는지
// 2) 카테고리 이름이 꿀팁 · 자취 · 만들 거 · 살 것 같은 뜻이면 그 낱말 규칙 (classify.ts)
// 3) 내가 전에 그 카테고리에 넣은 스크랩들의 낱말 · 해시태그 · 사이트 (나눌수록 잘 맞는다)
// AI는 사용자가 "AI에게 물어보기"를 누를 때만 쓴다 (aiPickCategories)
import type { Bookmark, ScrapCategory } from '../../db/types'
import { effectiveAi, type AiSettings, type EngineId } from '../ai/engines'
import { callGemini } from '../ai/gemini'
import { callGroq } from '../ai/groq'
import { classifyText, classScores, type ScrapClass } from './classify'

/** 카테고리 이름 → 낱말 규칙 갈래 (이름에 이런 낱말이 있으면) */
const NAME_TO_CLASS: [RegExp, ScrapClass][] = [
  [/만들|레시피|요리|베이킹|diy|공예|뜨개|간식|음식|먹/i, 'make'],
  [/자취|살림|집|인테리어|청소|수납|생활|방\s?꾸/, 'living'],
  [/살\s?것|살것|쇼핑|위시|사고|구매|장바구니|옷|템|뷰티|화장/, 'buy'],
  [/꿀팁|팁|정보|노하우|tip|공부|알아/i, 'tip'],
]

export function classOfName(name: string): ScrapClass | null {
  for (const [re, c] of NAME_TO_CLASS) if (re.test(name)) return c
  return null
}

const SOCIAL = /(^|\.)(instagram\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|blog\.naver\.com|m\.blog\.naver\.com|naver\.me)$/
/** 사이트 주소 (인스타 · X · 유튜브 · 네이버 블로그처럼 아무거나 다 올라오는 곳은 빼고) */
export function hostOf(url: string): string | null {
  try {
    const h = new URL(url).hostname.replace(/^www\.|^m\./, '')
    return SOCIAL.test(h) ? null : h
  } catch {
    return null
  }
}

const STOP = new Set(['그리고', '진짜', '정말', '너무', '이거', '저장', '공유', '게시물', '오늘', '여기', '이번', '하는', '있는', '없는', '같은', '나중', '이렇게', '그냥', '완전', '추천', '댓글', '좋아요', '팔로우', '프로필', '링크', 'instagram', 'the', 'and', 'for', 'with', 'you', 'this', 'that'])
const JOSA = /(으로|에서|에게|까지|부터|처럼|이랑|하고|이에요|예요|입니다|해요|했어요|합니다|은|는|이|가|을|를|에|의|도|로|와|과|랑|요)$/

/** 글 → 낱말 (해시태그는 #을 떼고 따로 무게를 더 준다) */
export function tokens(text: string): string[] {
  const out: string[] = []
  for (const m of text.matchAll(/#([\p{L}\p{N}_]{2,30})/gu)) out.push(`#${m[1].toLowerCase()}`)
  const plain = text.replace(/https?:\/\/\S+/g, ' ').replace(/[#@][\p{L}\p{N}_.]+/gu, ' ')
  for (const raw of plain.split(/[^\p{L}\p{N}]+/u)) {
    let w = raw.toLowerCase()
    if (w.length >= 3) w = w.replace(JOSA, '')
    if (w.length < 2 || w.length > 20 || /^\d+$/.test(w) || STOP.has(w)) continue
    out.push(w)
  }
  return out
}

export type Confidence = 'sure' | 'guess'
export interface Suggestion {
  categoryId: number
  confidence: Confidence
  /** 왜 골랐는지 짧게 ("이름", "전에 나눈 것과 비슷", "같은 사이트") */
  why: string
}

interface Learned {
  docs: number
  words: Map<string, number>
  hosts: Map<string, number>
}

/**
 * 추천기 만들기: 이미 카테고리에 넣은 스크랩(all)에서 배운다.
 * 돌려준 함수에 스크랩(또는 저장 전 글)을 주면 추천 하나 (없으면 null)
 */
export function makeSuggester(categories: ScrapCategory[], all: Bookmark[]) {
  const learned = new Map<number, Learned>()
  const df = new Map<string, number>()
  for (const c of categories) learned.set(c.id!, { docs: 0, words: new Map(), hosts: new Map() })
  for (const b of all) {
    const l = b.categoryId != null ? learned.get(b.categoryId) : undefined
    if (!l) continue
    l.docs++
    for (const w of new Set(tokens(classifyText(b)))) {
      l.words.set(w, (l.words.get(w) ?? 0) + 1)
      df.set(w, (df.get(w) ?? 0) + 1)
    }
    const h = hostOf(b.url)
    if (h) l.hosts.set(h, (l.hosts.get(h) ?? 0) + 1)
  }
  const nameWords = new Map(categories.map((c) => [c.id!, tokens(c.name).filter((w) => !w.startsWith('#'))]))
  const nameClass = new Map(categories.map((c) => [c.id!, classOfName(c.name)]))

  return function suggest(b: Pick<Bookmark, 'title' | 'description' | 'memo' | 'url'> & { id?: number; categoryId?: number }): Suggestion | null {
    const text = classifyText(b)
    if (!text.trim() && !hostOf(b.url)) return null
    const lower = text.toLowerCase()
    const words = new Set(tokens(text))
    const cls = classScores(text)
    const host = hostOf(b.url)
    const scores: { id: number; score: number; why: string }[] = []
    for (const c of categories) {
      const id = c.id!
      let score = 0
      const parts: [number, string][] = []
      // 1) 이름 낱말
      const nw = nameWords.get(id) ?? []
      const nameHit = nw.filter((w) => lower.includes(w)).length
      if (nameHit) parts.push([nameHit * 5, '이름'])
      // 2) 뜻이 같은 낱말 규칙
      const k = nameClass.get(id)
      if (k && cls[k]) parts.push([Math.min(cls[k], 12), '낱말'])
      // 3) 전에 나눈 스크랩 (자기 자신은 빼고 센다)
      const l = learned.get(id)
      if (l && l.docs) {
        const self = b.id != null && b.categoryId === id ? 1 : 0
        const docs = l.docs - self
        let sim = 0
        if (docs > 0) {
          for (const w of words) {
            const n = (l.words.get(w) ?? 0) - self
            if (n <= 0) continue
            const d = Math.max(1, (df.get(w) ?? 1) - self)
            // 다른 카테고리에도 흔한 낱말은 약하게, 이 카테고리에만 자주 나오는 낱말은 세게
            sim += (n / d) * Math.min(n, 3) * (w.startsWith('#') ? 1.5 : 1)
          }
        }
        if (sim) parts.push([Math.min(sim, 15), '전에 나눈 것과 비슷'])
        const hn = host ? (l.hosts.get(host) ?? 0) - self : 0
        if (hn > 0) parts.push([4 + Math.min(hn, 4), '같은 사이트'])
      }
      for (const [s] of parts) score += s
      if (score > 0) scores.push({ id, score, why: parts.sort((a, z) => z[0] - a[0])[0][1] })
    }
    if (!scores.length) return null
    scores.sort((a, z) => z.score - a.score)
    const [best, second] = scores
    const gap = second ? best.score / second.score : Infinity
    const confidence: Confidence = best.score >= 4 && gap >= 1.5 ? 'sure' : 'guess'
    // 너무 약하면 (낱말 하나 겹친 정도) 고르지 않는다
    if (best.score < 1.5) return null
    return { categoryId: best.id, confidence, why: best.why }
  }
}

// ── AI (사용자가 누를 때만) ─────────────────────────────

const SYSTEM = [
  '너는 저장한 스크랩(링크)을 사용자가 만든 카테고리에 나눠 주는 도우미야.',
  '카테고리 목록에서 가장 알맞은 번호 하나를 골라. 어디에도 안 맞으면 0.',
  'JSON 으로만 답해: {"results":[{"n":스크랩번호,"c":카테고리번호}]}',
].join('\n')

export function aiPrompt(names: string[], items: { text: string }[]): string {
  const cats = names.map((n, i) => `${i + 1}. ${n}`).join('\n')
  const list = items.map((it, i) => `[${i + 1}]\n${it.text.slice(0, 500) || '(글 없음)'}`).join('\n\n')
  return `카테고리:\n${cats}\n\n스크랩:\n${list}`
}

/** AI 답 → 스크랩마다 카테고리 순번 (0부터, 못 정하면 null) */
export function parseAiPicks(text: string, count: number, cats: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: count }, () => null)
  let found = 0
  const put = (nRaw: string, cRaw: string) => {
    found++
    const n = Number(nRaw)
    const c = Number(cRaw)
    if (Number.isInteger(n) && n >= 1 && n <= count && Number.isInteger(c) && c >= 1 && c <= cats) out[n - 1] = c - 1
  }
  for (const m of text.matchAll(/"n"\s*:\s*"?(\d+)"?\s*,\s*"c"\s*:\s*"?(\d+)"?/g)) put(m[1], m[2])
  for (const m of text.matchAll(/"c"\s*:\s*"?(\d+)"?\s*,\s*"n"\s*:\s*"?(\d+)"?/g)) put(m[2], m[1])
  if (!found) throw new Error('AI 답을 읽지 못했어요')
  return out
}

const AI_BATCH = 30

/**
 * 고른 스크랩만 AI에게 묻기 (사용자가 버튼을 눌렀을 때). Gemini(Tidy AI) → 막히면 Groq.
 * 기본(AI 없음)으로 설정돼 있으면 에러
 */
export async function aiPickCategories(chosen: AiSettings, categories: ScrapCategory[], items: { id: number; text: string }[], signal?: AbortSignal): Promise<{ result: Map<number, number>; engine: EngineId }> {
  const settings = effectiveAi(chosen)
  let gemini = settings.engine === 'gemini' ? settings.geminiKey?.trim() || null : null
  let groq = chosen.engine === 'local' ? null : settings.groqKey?.trim() || null
  if (!gemini && !groq) throw new Error('설정 > AI 연결에서 AI를 먼저 골라 주세요')
  const names = categories.map((c) => c.name)
  const result = new Map<number, number>()
  let engine: EngineId = 'local'
  let lastErr = ''
  for (let i = 0; i < items.length; i += AI_BATCH) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const batch = items.slice(i, i + AI_BATCH)
    const user = aiPrompt(names, batch)
    let picks: (number | null)[] | null = null
    if (gemini) {
      try {
        picks = parseAiPicks(await callGemini(gemini, { system: SYSTEM, parts: [{ text: user }], maxTokens: 200 + batch.length * 20, signal }), batch.length, names.length)
        engine = chosen.engine === 'tidy' ? 'tidy' : 'gemini'
      } catch (e) {
        if (signal?.aborted) throw e
        lastErr = e instanceof Error ? e.message : '알 수 없는 오류'
        gemini = null
      }
    }
    if (!picks && groq) {
      try {
        const r = await callGroq(groq, { system: SYSTEM, user: `${user}\n\n위 ${batch.length}개를 JSON 한 줄로만 답해.`, maxTokens: 200 + batch.length * 20, timeoutMs: 30_000, signal })
        picks = parseAiPicks(r.text, batch.length, names.length)
        engine = 'groq'
      } catch (e) {
        if (signal?.aborted) throw e
        lastErr = e instanceof Error ? e.message : '알 수 없는 오류'
        groq = null
      }
    }
    if (!picks) throw new Error(lastErr || 'AI에 연결하지 못했어요')
    batch.forEach((it, k) => {
      const p = picks![k]
      if (p != null) result.set(it.id, categories[p].id!)
    })
  }
  return { result, engine }
}

// 미분류 인스타 스크랩을 캡션을 보고 세 갈래로 나누기: 꿀팁 / 자취를 위해 모으기 / 나중에 만들 거
// 무료 AI(Tidy AI · 내 Gemini 키 → 예비 Groq)로 한 번에 여러 개씩 묻고, AI가 안 되면 낱말 규칙(기본)으로 나눈다.
// 유료 AI는 쓰지 않는다 (사용자 요청 2026-11-13)
import type { Bookmark } from '../../db/types'
import { effectiveAi, type AiSettings, type EngineId } from '../ai/engines'
import { callGemini } from '../ai/gemini'
import { callGroq } from '../ai/groq'

export type ScrapClass = 'tip' | 'living' | 'make'

/** 만들 카테고리 이름 (12자 안) */
export const CLASS_NAME: Record<ScrapClass, string> = {
  tip: '꿀팁',
  living: '자취를 위해 모으기',
  make: '나중에 만들 거',
}
export const CLASS_EMOJI: Record<ScrapClass, string> = { tip: '💡', living: '🏠', make: '🍳' }
export const CLASS_ORDER: ScrapClass[] = ['tip', 'living', 'make']

/** 낱말과 무게. 여러 갈래에 걸치면 점수가 큰 쪽 */
const RULES: Record<ScrapClass, [RegExp, number][]> = {
  make: [
    [/레시피|만드는\s?법|만들기|만들어\s?(보|먹)|재료|조리법|황금\s?비율|에어프라이어|전자레인지\s?요리/g, 3],
    [/요리|베이킹|쿠키|케이크|빵|디저트|소스|반찬|볶음|찌개|국수|파스타|샐러드|샌드위치|도시락|김밥|떡볶이|덮밥|간식|음료|라떼|카레|무침|굽기|구워|오븐|밀가루|버터|계란|두부/g, 2],
    [/diy|DIY|뜨개|코바늘|도안|키링|비즈|공예|자수|리폼|만들었|핸드메이드|클레이|캔들|향수\s?만들|다꾸|꾸미기\s?만들/g, 2],
    [/분\s?완성|간단\s?(요리|레시피)|초간단/g, 1],
  ],
  living: [
    [/자취|자취생|자취방|원룸|혼자\s?(살|사는)|1인\s?가구|이사|첫\s?독립|독립/g, 3],
    [/살림|수납|정리\s?(법|템|꿀팁)?|청소|세탁|빨래|곰팡이|냄새\s?제거|배수구|화장실|욕실|주방|냉장고|분리수거|인테리어|셀프\s?인테리어|가구|조명|커튼|침구|이불|방\s?꾸미기|집\s?꾸미기|다이소|이케아|생활용품|살림템|자취템|필수템|가성비템|전기세|관리비|월세|전세|보증금|집들이|장보기|밀키트|식비\s?절약/g, 2],
  ],
  tip: [
    [/꿀팁|팁|tip|TIP|Tip|노하우|모르면\s?손해|알아두면|알아\s?두|꿀정보|정보\s?공유|방법|하는\s?법|활용법|사용법|단축키|설정|기능|앱\s?추천|사이트\s?추천|추천/g, 2],
    [/절약|재테크|적금|통장|카드|혜택|할인|무료|공부|엑셀|자격증|면접|자소서|취업|여행|맛집|건강|운동|다이어트|피부|화장|스킨케어|꿀템|정리\s?법/g, 1],
  ],
}

/** 캡션·제목 글에서 갈래 점수 */
export function classScores(text: string): Record<ScrapClass, number> {
  const out: Record<ScrapClass, number> = { tip: 0, living: 0, make: 0 }
  for (const k of CLASS_ORDER) for (const [re, w] of RULES[k]) out[k] += (text.match(re)?.length ?? 0) * w
  return out
}

/** 낱말 규칙으로 하나 고르기. 아무 낱말도 없으면 null (그대로 미분류) */
export function ruleClassify(text: string): ScrapClass | null {
  const s = classScores(text)
  // 동점이면 만들 거 > 자취 > 꿀팁 (꿀팁이 가장 넓어서 마지막)
  const best = (['make', 'living', 'tip'] as ScrapClass[]).reduce((a, b) => (s[b] > s[a] ? b : a))
  return s[best] > 0 ? best : null
}

/** 분류에 쓸 글: 캡션(설명) + 사용자가 쓴 제목·메모. "@아이디의 게시물" 같은 자동 제목은 뺀다 */
export function classifyText(b: Pick<Bookmark, 'title' | 'description' | 'memo'>): string {
  const title = /^@[\w.]+의 게시물$|^Instagram 게시물$/.test(b.title) ? '' : b.title
  return [title, b.description ?? '', b.memo ?? ''].map((s) => s.trim()).filter(Boolean).join('\n').slice(0, 1500)
}

/** 미분류 + 인스타 */
export function isUnsortedInstagram(b: Bookmark): boolean {
  return b.categoryId == null && (b.source === 'instagram' || /instagram\.com\//.test(b.url))
}

/** 캡션이 아직 없는 스크랩 (분류 전에 서버에서 캡션을 읽어 온다) */
export function needsCaption(b: Bookmark): boolean {
  return !b.description?.trim()
}

export const CLASSIFY_SYSTEM = [
  '너는 인스타그램에서 저장한 게시물을 캡션을 보고 분류하는 도우미야.',
  '각 게시물을 아래 셋 중 하나로 나눠.',
  '- tip (꿀팁): 알아 두면 좋은 정보, 생활·공부·돈·앱·여행 같은 꿀팁, 추천 목록',
  '- living (자취를 위해 모으기): 혼자 살 집에 필요한 것. 자취템, 살림·청소·수납·정리, 인테리어·방 꾸미기, 가구·생활용품, 이사·월세',
  '- make (나중에 만들 거): 직접 만들어 볼 것. 요리·베이킹 레시피, 간식·음료, DIY·뜨개·공예',
  '- none: 캡션이 없거나 셋 어디에도 안 맞을 때',
  '요리 레시피는 자취 이야기가 섞여 있어도 make 야.',
  'JSON 으로만 답해: {"results":[{"n":번호,"c":"tip|living|make|none"}]}',
].join('\n')

export function classifyPrompt(items: { n: number; text: string }[]): string {
  return items.map((it) => `[${it.n}]\n${it.text.slice(0, 600) || '(캡션 없음)'}`).join('\n\n')
}

/** AI 답 읽기: 번호 → 갈래 (none·모르는 값은 null) */
export function parseClassifyJson(text: string, count: number): (ScrapClass | null)[] {
  const out: (ScrapClass | null)[] = Array.from({ length: count }, () => null)
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('AI 답을 읽지 못했어요')
  const data = JSON.parse(m[0]) as { results?: { n?: unknown; c?: unknown }[] }
  for (const r of data.results ?? []) {
    const n = Number(r.n)
    if (Number.isInteger(n) && n >= 1 && n <= count && (r.c === 'tip' || r.c === 'living' || r.c === 'make')) out[n - 1] = r.c
  }
  return out
}

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'integer' }, c: { type: 'string', enum: ['tip', 'living', 'make', 'none'] } }, required: ['n', 'c'] },
    },
  },
  required: ['results'],
}

/** 한 번에 묻는 개수 (Tidy AI 하루 횟수를 아끼려고 여러 개씩) */
export const BATCH = 40

export interface ClassifyInput {
  id: number
  text: string
}
export interface ClassifyOutcome {
  /** id → 갈래 (null = 못 정함, 그대로 미분류) */
  result: Map<number, ScrapClass | null>
  /** 실제로 답한 쪽 */
  engine: EngineId
  /** AI가 중간에 막혀서 낱말 규칙으로 바꾼 이유 */
  error?: string
}

async function askAi(settings: AiSettings, batch: ClassifyInput[], signal?: AbortSignal): Promise<{ list: (ScrapClass | null)[]; engine: EngineId }> {
  const user = classifyPrompt(batch.map((it, i) => ({ n: i + 1, text: it.text })))
  const maxTokens = 40 + batch.length * 20
  try {
    const text = await callGemini(settings.geminiKey!.trim(), { system: CLASSIFY_SYSTEM, parts: [{ text: user }], schema: SCHEMA, maxTokens, signal })
    return { list: parseClassifyJson(text, batch.length), engine: 'gemini' }
  } catch (err) {
    if (signal?.aborted) throw err
    const groq = settings.groqKey?.trim()
    if (!groq) throw err
    try {
      const r = await callGroq(groq, { system: CLASSIFY_SYSTEM, user, json: true, maxTokens, signal })
      return { list: parseClassifyJson(r.text, batch.length), engine: 'groq' }
    } catch (err2) {
      if (signal?.aborted) throw err2
      const why = (e: unknown) => (e instanceof Error && e.message ? e.message : '알 수 없는 오류')
      // 둘 다 같은 이유(예: 로그인 안 함)면 한 번만
      throw new Error(why(err) === why(err2) ? why(err) : `${why(err)} · 예비 AI(Groq)도 안 됐어요: ${why(err2)}`)
    }
  }
}

/**
 * 여러 스크랩을 나눈다. 캡션이 없는 건 AI에 묻지 않는다 (횟수 아끼기).
 * AI가 정하지 못한 것은 낱말 규칙으로 한 번 더 본다
 */
export async function classifyScraps(chosen: AiSettings, items: ClassifyInput[], onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<ClassifyOutcome> {
  const settings = effectiveAi(chosen)
  const result = new Map<number, ScrapClass | null>()
  const useAi = settings.engine === 'gemini' && !!settings.geminiKey?.trim()
  let engine: EngineId = 'local'
  let error: string | undefined
  const withText = items.filter((it) => it.text.trim())
  for (const it of items) if (!it.text.trim()) result.set(it.id, null)
  let done = items.length - withText.length
  onProgress?.(done, items.length)
  for (let i = 0; i < withText.length; i += BATCH) {
    const batch = withText.slice(i, i + BATCH)
    let list: (ScrapClass | null)[] | null = null
    if (useAi && !error) {
      try {
        const r = await askAi(settings, batch, signal)
        list = r.list
        engine = chosen.engine === 'tidy' && r.engine === 'gemini' ? 'tidy' : r.engine
      } catch (err) {
        if (signal?.aborted) throw err
        // 남은 것은 낱말 규칙으로 (오늘 횟수를 다 썼을 때 등)
        error = err instanceof Error ? err.message : '지금은 AI에 연결하지 못했어요'
      }
    }
    batch.forEach((it, k) => result.set(it.id, list?.[k] ?? ruleClassify(it.text)))
    done += batch.length
    onProgress?.(done, items.length)
  }
  return { result, engine, error }
}

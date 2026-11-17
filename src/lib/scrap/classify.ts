// 미분류 인스타 스크랩을 캡션을 보고 네 갈래로 나누기: 꿀팁 / 자취를 위해 모으기 / 나중에 만들 거 / 나중에 살 것
// 무료 AI(Tidy AI · 내 Gemini 키 → 예비 Groq)로 한 번에 여러 개씩 묻고, AI가 안 되면 낱말 규칙(기본)으로 나눈다.
// 유료 AI는 쓰지 않는다 (사용자 요청 2026-11-13)
import type { Bookmark } from '../../db/types'
import { effectiveAi, type AiSettings, type EngineId } from '../ai/engines'
import { callGemini } from '../ai/gemini'
import { callGroq } from '../ai/groq'

export type ScrapClass = 'tip' | 'living' | 'make' | 'buy'

/** 만들 카테고리 이름 (12자 안) */
export const CLASS_NAME: Record<ScrapClass, string> = {
  tip: '꿀팁',
  living: '자취를 위해 모으기',
  make: '나중에 만들 거',
  buy: '나중에 살 것',
}
/** 좁은 칸에 쓰는 짧은 이름 */
export const CLASS_SHORT: Record<ScrapClass, string> = { tip: '꿀팁', living: '자취', make: '만들 거', buy: '살 것' }
export const CLASS_EMOJI: Record<ScrapClass, string> = { tip: '💡', living: '🏠', make: '🍳', buy: '🛍️' }
export const CLASS_ORDER: ScrapClass[] = ['tip', 'living', 'make', 'buy']

/** 낱말과 무게. 여러 갈래에 걸치면 점수가 큰 쪽 */
const RULES: Record<ScrapClass, [RegExp, number][]> = {
  make: [
    [/레시피|만드는\s?법|만들기|만들어\s?(보|먹)|재료|조리법|황금\s?비율|에어프라이어|전자레인지\s?요리/g, 3],
    [/요리|베이킹|쿠키|케이크|빵|디저트|소스|반찬|볶음|찌개|국수|파스타|샐러드|샌드위치|도시락|김밥|떡볶이|덮밥|간식|음료|라떼|카레|무침|굽기|구워|오븐|밀가루|버터|계란|두부/g, 2],
    [/diy|DIY|뜨개|코바늘|도안|키링|비즈|공예|자수|리폼|만들었|핸드메이드|클레이|캔들|향수\s?만들|다꾸|꾸미기\s?만들/g, 2],
    [/분\s?완성|간단\s?(요리|레시피)|초간단/g, 1],
    // 음식 이름 · 맛 · 조리 낱말 (하나만으론 약하게)
    [/맛탕|고구마|감자|치즈|떡|라면|김치|닭|고기|삼겹|돼지|소고기|새우|연어|참치|스팸|마요|토스트|브런치|크림|초코|딸기|과일|아이스크림|푸딩|젤리|마카롱|스콘|머핀|와플|팬케이크|타르트|잼|칵테일|하이볼|안주|튀김|볶아|끓여|삶아|데쳐|큰술|숟가락|스푼|홈카페|홈베이킹|존맛|꿀맛|바삭|쫀득|촉촉|달달|맛있|먹어\s?보|해\s?먹|집밥|밥도둑|자취\s?요리/g, 1],
  ],
  living: [
    [/자취|자취생|자취방|원룸|혼자\s?(살|사는)|1인\s?가구|이사|첫\s?독립|독립/g, 3],
    [/살림|수납|정리\s?(법|템|꿀팁)?|청소|세탁|빨래|곰팡이|냄새\s?제거|배수구|화장실|욕실|주방|냉장고|분리수거|인테리어|셀프\s?인테리어|가구|조명|커튼|침구|이불|방\s?꾸미기|집\s?꾸미기|다이소|이케아|생활용품|살림템|자취템|필수템|가성비템|전기세|관리비|월세|전세|보증금|집들이|장보기|밀키트|식비\s?절약/g, 2],
    [/보관법|소분|밀폐|냉동실|세제|수건|행거|선반|정리함|공간\s?활용|좁은\s?방|작은\s?방|건조기|세탁기|가전|청소기|에어컨|보일러|난방|결로|단열|벌레|바퀴벌레|모기|방충|오늘의집|집꾸|쿠팡|룸투어|랜선집들이|침대|매트리스|책상|의자|러그|조명|무드등/g, 1],
  ],
  tip: [
    [/꿀팁|팁|tip|TIP|Tip|노하우|모르면\s?손해|알아두면|알아\s?두|꿀정보|정보\s?공유|방법|하는\s?법|활용법|사용법|단축키|설정|기능|앱\s?추천|사이트\s?추천|추천/g, 2],
    [/절약|재테크|적금|통장|카드|혜택|할인|무료|공부|엑셀|자격증|면접|자소서|취업|여행|맛집|건강|운동|다이어트|피부|화장|스킨케어|정리\s?법|편의점|후기|리뷰|꿀조합|가성비|포인트|이벤트|저장\s?(해|필수)|공유/g, 1],
  ],
  buy: [
    [/사고\s?싶|살\s?거|사야\s?(지|겠|할)|구매|장바구니|위시\s?리스트|위시|최저가|구매처|품절|재입고|내돈내산|언박싱|하울|쇼핑\s?리스트|살까\s?말까|지름|질렀|득템/g, 3],
    [/쇼핑|세일|할인|쿠폰|특가|공구|공동구매|링크\s?(는|에)|프로필\s?링크|올리브영|무신사|쿠팡|29cm|지그재그|에이블리|신상|추천템|꿀템|선물|옷|코디|신발|가방|향수|립|쿠션|틴트|화장품|가격|원\s?대|만\s?원/g, 1],
  ],
}

/** 캡션·제목 글에서 갈래 점수 */
export function classScores(text: string): Record<ScrapClass, number> {
  const out: Record<ScrapClass, number> = { tip: 0, living: 0, make: 0, buy: 0 }
  for (const k of CLASS_ORDER) for (const [re, w] of RULES[k]) out[k] += (text.match(re)?.length ?? 0) * w
  return out
}

/** 낱말 규칙으로 하나 고르기. 아무 낱말도 없으면 null (그대로 미분류) */
export function ruleClassify(text: string): ScrapClass | null {
  const s = classScores(text)
  // 동점이면 만들 거 > 자취 > 살 것 > 꿀팁 (꿀팁이 가장 넓어서 마지막)
  const best = (['make', 'living', 'buy', 'tip'] as ScrapClass[]).reduce((a, b) => (s[b] > s[a] ? b : a))
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
  '각 게시물을 아래 넷 중 하나로 나눠.',
  '- tip (꿀팁): 알아 두면 좋은 정보, 생활·공부·돈·앱·여행 같은 꿀팁, 추천 목록',
  '- living (자취를 위해 모으기): 혼자 살 집에 필요한 것. 자취템, 살림·청소·수납·정리, 인테리어·방 꾸미기, 가구·생활용품, 이사·월세',
  '- make (나중에 만들 거): 직접 만들어 볼 것. 요리·베이킹 레시피, 간식·음료, DIY·뜨개·공예',
  '- buy (나중에 살 것): 사고 싶은 물건. 옷·화장품·소품·전자기기 추천, 제품 후기·내돈내산, 할인·공구·구매 링크',
  '- none: 캡션이 없거나 넷 어디에도 안 맞을 때',
  '자취방에 쓸 물건은 buy 보다 living 이야.',
  '요리 레시피는 자취 이야기가 섞여 있어도 make 야.',
  'JSON 으로만 답해: {"results":[{"n":번호,"c":"tip|living|make|buy|none"}]}',
].join('\n')

export function classifyPrompt(items: { n: number; text: string }[]): string {
  return items.map((it) => `[${it.n}]\n${it.text.slice(0, 600) || '(캡션 없음)'}`).join('\n\n')
}

/**
 * AI 답 읽기: 번호 → 갈래 (none · 모르는 값은 null).
 * JSON 이 중간에 잘렸거나 모양이 조금 달라도(예: 1:make) 읽을 수 있는 만큼 읽는다
 */
export function parseClassifyJson(text: string, count: number): (ScrapClass | null)[] {
  const out: (ScrapClass | null)[] = Array.from({ length: count }, () => null)
  let found = 0
  const put = (nRaw: string, c: string) => {
    const n = Number(nRaw)
    found++
    if (Number.isInteger(n) && n >= 1 && n <= count && (c === 'tip' || c === 'living' || c === 'make' || c === 'buy')) out[n - 1] = c
  }
  for (const m of text.matchAll(/"n"\s*:\s*"?(\d+)"?\s*,\s*"c"\s*:\s*"(\w+)"/g)) put(m[1], m[2])
  for (const m of text.matchAll(/"c"\s*:\s*"(\w+)"\s*,\s*"n"\s*:\s*"?(\d+)"?/g)) put(m[2], m[1])
  if (!found) for (const m of text.matchAll(/(?:^|[\s,{\[])"?(\d+)"?\s*[:=]\s*"?(tip|living|make|buy|none)\b/g)) put(m[1], m[2])
  if (!found) throw new Error('AI 답을 읽지 못했어요')
  return out
}

const SCHEMA = {
  type: 'object',
  properties: {
    results: {
      type: 'array',
      items: { type: 'object', properties: { n: { type: 'integer' }, c: { type: 'string', enum: ['tip', 'living', 'make', 'buy', 'none'] } }, required: ['n', 'c'] },
    },
  },
  required: ['results'],
}

/** 한 번에 묻는 개수 (Tidy AI 하루 횟수를 아끼려고 여러 개씩). Groq 는 답이 길면 잘려서 조금 적게 */
export const BATCH = 40
export const GROQ_BATCH = 20

export interface ClassifyInput {
  id: number
  text: string
}
export interface ClassifyOutcome {
  /** id → 갈래 (null = 못 정함, 그대로 미분류) */
  result: Map<number, ScrapClass | null>
  /** 실제로 답한 쪽 */
  engine: EngineId
  /** AI가 막혀서 (일부를) 낱말 규칙으로 나눈 이유 */
  error?: string
}

const why = (e: unknown) => (e instanceof Error && e.message ? e.message : '알 수 없는 오류')
const tokensFor = (n: number) => 200 + n * 30

async function askGemini(key: string, batch: ClassifyInput[], signal?: AbortSignal): Promise<(ScrapClass | null)[]> {
  const user = classifyPrompt(batch.map((it, i) => ({ n: i + 1, text: it.text })))
  const text = await callGemini(key, { system: CLASSIFY_SYSTEM, parts: [{ text: user }], schema: SCHEMA, maxTokens: tokensFor(batch.length), signal })
  return parseClassifyJson(text, batch.length)
}

/**
 * Groq: JSON 모드(response_format)를 쓰면 답이 조금만 어긋나도 Groq 가 400 "Failed to validate JSON" 으로 막는다.
 * 그래서 JSON 모드 없이 묻고, 받은 글에서 읽을 수 있는 만큼 읽는다
 */
async function askGroq(key: string, batch: ClassifyInput[], signal?: AbortSignal): Promise<(ScrapClass | null)[]> {
  const user = classifyPrompt(batch.map((it, i) => ({ n: i + 1, text: it.text.slice(0, 400) })))
  const r = await callGroq(key, { system: CLASSIFY_SYSTEM, user: `${user}\n\n위 ${batch.length}개를 모두 JSON 한 줄로만 답해.`, maxTokens: tokensFor(batch.length), timeoutMs: 30_000, signal })
  return parseClassifyJson(r.text, batch.length)
}

/**
 * 여러 스크랩을 나눈다. 캡션이 없는 건 AI에 묻지 않는다 (횟수 아끼기).
 * Gemini 가 막히면(오늘 무료 사용량 다 씀 등) 남은 건 Groq 로, Groq 도 막히면 낱말 규칙으로.
 * AI가 정하지 못한 것은 낱말 규칙으로 한 번 더 본다
 */
export async function classifyScraps(chosen: AiSettings, items: ClassifyInput[], onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<ClassifyOutcome> {
  const settings = effectiveAi(chosen)
  const result = new Map<number, ScrapClass | null>()
  let gemini = settings.engine === 'gemini' ? settings.geminiKey?.trim() || null : null
  let groq = gemini ? settings.groqKey?.trim() || null : null
  let geminiErr: string | undefined
  let groqErr: string | undefined
  let usedGemini = false
  let usedGroq = false
  let ruled = false
  const withText = items.filter((it) => it.text.trim())
  for (const it of items) if (!it.text.trim()) result.set(it.id, null)
  let done = items.length - withText.length
  onProgress?.(done, items.length)
  let i = 0
  while (i < withText.length) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const size = gemini ? BATCH : groq ? GROQ_BATCH : BATCH
    const batch = withText.slice(i, i + size)
    let list: (ScrapClass | null)[] | null = null
    if (gemini) {
      try {
        list = await askGemini(gemini, batch, signal)
        usedGemini = true
      } catch (err) {
        if (signal?.aborted) throw err
        geminiErr = why(err)
        gemini = null
        // 남은 건 Groq 로 (Groq 는 한 번에 적게 묻으니 이 묶음부터 다시 나눈다)
        if (groq) continue
      }
    } else if (groq) {
      try {
        list = await askGroq(groq, batch, signal)
        usedGroq = true
      } catch (err) {
        if (signal?.aborted) throw err
        groqErr = why(err)
        groq = null
      }
    }
    if (!list) ruled = true
    batch.forEach((it, k) => result.set(it.id, list?.[k] ?? ruleClassify(it.text)))
    i += batch.length
    done += batch.length
    onProgress?.(done, items.length)
  }
  const engine: EngineId = usedGemini ? (chosen.engine === 'tidy' ? 'tidy' : 'gemini') : usedGroq ? 'groq' : 'local'
  let error: string | undefined
  if (ruled && (geminiErr || groqErr)) {
    error = geminiErr && groqErr ? (geminiErr === groqErr ? geminiErr : `${geminiErr} · 예비 AI(Groq)도 안 됐어요: ${groqErr}`) : (geminiErr ?? groqErr)
  }
  return { result, engine, error }
}

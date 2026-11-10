// Google Gemini (무료 등급): 키만 있으면 이 기기에서 바로 묻는다. 서버도 결제도 필요 없다.
// 키는 aistudio.google.com 에서 무료로 만든다. 무료 등급은 하루·분당 횟수 제한이 있고,
// 구글이 무료 등급 대화를 서비스 개선에 쓸 수 있다.

/** 쓰는 모델. 무료 등급은 Flash 만 되고, 별칭이라 새 Flash 가 나오면 따라간다 (사진도 읽는다) */
export const GEMINI_MODEL = 'gemini-flash-latest'

const ENDPOINT = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

export interface GeminiRequest {
  system: string
  parts: GeminiPart[]
  /** 주면 JSON 으로만 답하게 한다. 빈 객체 {} 면 모양은 정하지 않고 JSON 만 */
  schema?: Record<string, unknown>
  maxTokens?: number
  /** 구글 검색으로 근거 찾기 (무료 등급은 하루 횟수 제한이 따로 있다). 이때는 schema 를 같이 쓰지 않는다 */
  search?: boolean
  signal?: AbortSignal
}

/** 이 키로 쓸 수 있는 Flash 모델 목록 (구글에 물어본 결과를 앱을 켜 둔 동안 기억) */
const modelCache = new Map<string, Promise<string[]>>()

/** 모델 이름에서 버전 숫자 (gemini-3.1-flash → 3.1) */
const versionOf = (name: string) => Number(name.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)

/**
 * 구글에 "지금 쓸 수 있는 모델"을 물어보고 Flash 모델을 좋은 순으로 고른다.
 * 오래된 모델은 새 사용자에게 막히기 때문에 이름을 박아 두지 않는다.
 * 순서: 새 버전 먼저, 같은 버전이면 lite 가 아닌 것, 미리보기(preview)·실험(exp)은 뒤로
 */
export function rankFlashModels(names: string[]): string[] {
  const score = (n: string) => (/lite/.test(n) ? 1 : 0) + (/preview|exp/.test(n) ? 2 : 0) + (/image|tts|audio|live|embedding|thinking/.test(n) ? 10 : 0)
  return names
    .map((n) => n.replace(/^models\//, ''))
    .filter((n) => /^gemini-.*flash/.test(n) && score(n) < 10)
    .sort((a, b) => versionOf(b) - versionOf(a) || score(a) - score(b) || a.localeCompare(b))
}

async function listFlashModels(apiKey: string, fetcher: typeof fetch, signal?: AbortSignal): Promise<string[]> {
  let cached = modelCache.get(apiKey)
  if (!cached) {
    cached = (async () => {
      const res = await fetcher('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': apiKey }, signal })
      if (!res.ok) return []
      const data = (await res.json().catch(() => ({}))) as { models?: { name: string; supportedGenerationMethods?: string[] }[] }
      return rankFlashModels((data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes('generateContent')).map((m) => m.name))
    })().catch(() => [])
    modelCache.set(apiKey, cached)
  }
  return cached
}

/** 시험용: 기억해 둔 모델 목록 지우기 */
export const clearGeminiModelCache = () => modelCache.clear()

type GeminiData = {
  candidates?: {
    content?: { parts?: { text?: string; thought?: boolean }[] }
    finishReason?: string
    /** 구글 검색으로 찾은 출처 (search: true 일 때) */
    groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] }
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 무료 사용량(분당·하루)을 넘었을 때 */
export class GeminiLimitError extends Error {}
/** 키가 틀렸을 때 */
export class GeminiKeyError extends Error {}

/** 검색으로 찾은 출처 한 개 */
export interface GeminiSource {
  title: string
  url: string
}

/** Gemini 에게 묻고 글 답을 돌려준다 */
export async function callGemini(apiKey: string, req: GeminiRequest, fetcher: typeof fetch = fetch): Promise<string> {
  return (await callGeminiWithSources(apiKey, req, fetcher)).text
}

/** Gemini 에게 묻고 글 답과, 검색했다면 출처까지 돌려준다 */
export async function callGeminiWithSources(apiKey: string, req: GeminiRequest, fetcher: typeof fetch = fetch): Promise<{ text: string; sources: GeminiSource[] }> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: req.parts }],
    ...(req.search ? { tools: [{ google_search: {} }] } : {}),
    generationConfig: {
      // 요즘 Flash 는 답하기 전에 생각하는 데도 토큰을 써서, 너무 작으면 답이 비어 버린다
      maxOutputTokens: Math.max(req.maxTokens ?? 2048, 2048),
      ...(req.schema ? { responseMimeType: 'application/json' } : {}),
      ...(req.schema && Object.keys(req.schema).length ? { responseJsonSchema: req.schema } : {}),
    },
  })
  const send = async (model: string) => {
    try {
      return await fetcher(ENDPOINT(model), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: req.signal,
      })
    } catch (err) {
      if (req.signal?.aborted) throw err
      throw new Error('Gemini에 연결하지 못했어요. 인터넷을 확인해 주세요')
    }
  }

  // 모델 이름을 못 찾거나(404) 구글 서버가 붐비면(500·503) 다른 무료 모델로 차례로 다시 묻는다
  const retry = (r: Response) => r.status === 404 || r.status === 500 || r.status === 503
  let res = await send(GEMINI_MODEL)
  if (retry(res)) {
    // 이 키로 지금 쓸 수 있는 Flash 모델을 구글에 물어보고, 좋은 순으로 많아야 3개 더 시도
    const tried = new Set([GEMINI_MODEL])
    const others = (await listFlashModels(apiKey, fetcher, req.signal)).filter((m) => !tried.has(m)).slice(0, 3)
    for (const model of others) {
      if (!retry(res)) break
      if (res.status !== 404) await wait(800)
      res = await send(model)
    }
  }
  const data = (await res.json().catch(() => ({}))) as GeminiData
  const why = data.error?.message ?? ''
  if (res.status === 429) throw new GeminiLimitError('오늘 무료 사용량을 다 썼어요. 잠시 뒤에 다시 해 주세요')
  if (/api.?key/i.test(why) || res.status === 401 || res.status === 403) throw new GeminiKeyError('Gemini 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
  if (/location is not supported/i.test(why)) throw new Error('지금 있는 곳에서는 Gemini 무료 등급을 쓸 수 없어요')
  if (res.status === 500 || res.status === 503) throw new Error('구글 Gemini 서버가 붐벼요. 잠시 뒤에 다시 해 주세요')
  // 그 밖의 오류는 원인을 찾을 수 있게 구글이 준 이유를 같이 보여 준다
  if (!res.ok) throw new Error(`Gemini에서 오류가 났어요 (${res.status}${why ? `: ${why.slice(0, 300)}` : ''})`)
  if (data.promptFeedback?.blockReason) throw new Error('Gemini가 이번엔 답하지 않았어요')
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error(data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'Gemini 답이 너무 길어서 끊겼어요. 다시 해 주세요' : 'Gemini가 빈 답을 줬어요')
  const seen = new Set<string>()
  const sources: GeminiSource[] = []
  for (const c of data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) {
    const url = c.web?.uri ?? ''
    if (!/^https?:\/\//.test(url) || seen.has(url)) continue
    seen.add(url)
    sources.push({ title: (c.web?.title ?? '').slice(0, 80) || new URL(url).hostname, url })
  }
  return { text, sources: sources.slice(0, 5) }
}

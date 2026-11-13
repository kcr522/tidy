import type { AiSettings } from './engines'
import { DEFAULT_SERVER_URL, effectiveAi } from './engines'
import { callGemini, GeminiKeyError, GeminiLimitError } from './gemini'
import { askClaudeMeal, guessFromText, MealError, mealPrompt, SYSTEM_JSON, type MealGuess, type MealRequest, type NearbyPlace } from './meal'

export const DEFAULT_MEAL_URL = '/api/meal'

export interface MealResult {
  guess: MealGuess
  nearby: NearbyPlace[]
}

/** 음식 사진을 어디에 물어볼지. null 이면 AI 없이 직접 입력 */
export type MealEngine = (req: MealRequest, signal?: AbortSignal) => Promise<MealResult>

/** 'AI 소비 한마디' 서버 주소가 .../api/feedback 이면 같은 서버의 .../api/meal 로 */
export function mealUrlFrom(serverUrl?: string): string {
  const url = serverUrl?.trim()
  if (!url || url === DEFAULT_SERVER_URL) return DEFAULT_MEAL_URL
  return url.replace(/\/api\/feedback\/?$/, '/api/meal')
}

export function serverMealEngine(url = DEFAULT_MEAL_URL): MealEngine {
  return async (req, signal) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
    const data = (await res.json().catch(() => ({}))) as { guess?: MealGuess; nearby?: NearbyPlace[]; error?: string }
    if (!res.ok || !data.guess) throw new MealError(data.error ?? '서버에서 답을 받지 못했어요')
    return { guess: data.guess, nearby: data.nearby ?? [] }
  }
}

/** 내 키로 바로 묻기: 근처 식당 지도 검색은 서버에서만 되니, AI가 좌표와 사진만 보고 찾는다 */
export function keyMealEngine(apiKey: string): MealEngine {
  return async (req, signal) => {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
    return { guess: await askClaudeMeal(client, req, signal), nearby: [] }
  }
}

/**
 * 무료 Gemini 키로 이 기기에서 바로 묻는다.
 * 먼저 구글 검색을 켜고 메뉴판 가격까지 찾아 보고, 검색이 막히면(무료 검색 한도 등) 검색 없이 사진만으로 다시 묻는다.
 * 그래도 한도에 걸리면 화면이 "직접 적어 주세요"로 넘어간다.
 */
export function geminiMealEngine(apiKey: string, fetcher: typeof fetch = fetch): MealEngine {
  return async (req, signal) => {
    const parts = [{ inlineData: { mimeType: 'image/jpeg', data: req.image } }, { text: mealPrompt(req) }]
    const ask = async (search: boolean) => {
      const text = await callGemini(apiKey, { system: SYSTEM_JSON, parts, search, ...(search ? {} : { schema: {} }), maxTokens: 4096, signal }, fetcher)
      const guess = guessFromText(text)
      if (!guess) throw new MealError('사진 속 음식을 알아내지 못했어요')
      return guess
    }
    try {
      let guess: MealGuess
      try {
        guess = await ask(true)
      } catch (err) {
        if (signal?.aborted || err instanceof GeminiKeyError) throw err
        // 검색 없이 한 번 더: 가격은 못 찾아도 음식과 가게는 알아본다
        guess = { ...(await ask(false)), price: null, priceUrl: null }
      }
      return { guess, nearby: [] }
    } catch (err) {
      if (err instanceof MealError || signal?.aborted) throw err
      if (err instanceof GeminiLimitError) throw new MealError('오늘 Gemini 무료 사용량을 다 썼어요')
      throw new MealError(err instanceof Error ? err.message : 'Gemini에 연결하지 못했어요')
    }
  }
}

export function mealEngineFor(chosen: AiSettings): MealEngine | null {
  const settings = effectiveAi(chosen)
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) return geminiMealEngine(settings.geminiKey.trim())
  if (settings.engine === 'server') return serverMealEngine(mealUrlFrom(settings.serverUrl))
  if (settings.engine === 'key' && settings.apiKey?.trim()) return keyMealEngine(settings.apiKey.trim())
  return null
}

import type { AiSettings } from './engines'
import { effectiveAi } from './engines'
import { appFetch } from '../../platform/nativeFetch'
import { callGemini, GeminiKeyError, GeminiLimitError } from './gemini'
import { aiServerUrl } from './serverAi'
import { guessFromText, MealError, mealPrompt, SYSTEM_JSON, type MealGuess, type MealRequest, type NearbyPlace } from './meal'

export interface MealResult {
  guess: MealGuess
  nearby: NearbyPlace[]
}

/** 음식 사진을 어디에 물어볼지. null 이면 AI 없이 직접 입력 */
export type MealEngine = (req: MealRequest, signal?: AbortSignal) => Promise<MealResult>

/** 사진 찍은 곳 근처 식당 (Tidy 서버가 카카오 지도에서 찾는다. 서버에 카카오 키가 없거나 안 되면 빈 목록) */
export async function fetchNearby(location: { lat: number; lng: number }, signal?: AbortSignal, fetcher: typeof fetch = appFetch()): Promise<NearbyPlace[]> {
  try {
    const res = await fetcher(aiServerUrl().replace(/\/api\/ai$/, '/api/meal'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(location),
      signal,
    })
    const data = (await res.json().catch(() => ({}))) as { nearby?: NearbyPlace[] }
    return Array.isArray(data.nearby) ? data.nearby.slice(0, 10) : []
  } catch {
    return []
  }
}

/**
 * 무료 Gemini 키로 이 기기에서 바로 묻는다.
 * 먼저 구글 검색을 켜고 메뉴판 가격까지 찾아 보고, 검색이 막히면(무료 검색 한도 등) 검색 없이 사진만으로 다시 묻는다.
 * 그래도 한도에 걸리면 화면이 "직접 적어 주세요"로 넘어간다.
 */
export function geminiMealEngine(apiKey: string, fetcher: typeof fetch = fetch): MealEngine {
  return async (req, signal) => {
    const nearby = req.location ? await fetchNearby(req.location, signal) : []
    const parts = [{ inlineData: { mimeType: 'image/jpeg', data: req.image } }, { text: mealPrompt({ ...req, nearby }) }]
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
      return { guess, nearby }
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
  return null
}

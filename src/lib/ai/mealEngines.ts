import type { AiSettings } from './engines'
import { DEFAULT_SERVER_URL } from './engines'
import { askClaudeMeal, MealError, type MealGuess, type MealRequest, type NearbyPlace } from './meal'

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

export function mealEngineFor(settings: AiSettings): MealEngine | null {
  if (settings.engine === 'server') return serverMealEngine(mealUrlFrom(settings.serverUrl))
  if (settings.engine === 'key' && settings.apiKey?.trim()) return keyMealEngine(settings.apiKey.trim())
  return null
}

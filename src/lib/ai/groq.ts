/**
 * 예비 AI: Groq 무료 (사용자 요청 2026-11-10)
 * Gemini 무료 한도를 다 쓰면 여기로 넘어온다. 큰 모델 → 작은 모델 순서로 묻고, 둘 다 막히면 에러.
 * Groq는 OpenAI와 같은 모양의 API를 쓴다. 키는 이 기기에만 저장한다.
 * 사진과 구글 검색은 못 한다 (사진이 있으면 부르는 쪽이 기기 안 글자 인식으로 바꿔서 글로 보낸다).
 */

import { appFetch } from '../../platform/nativeFetch'
import { SERVER_KEY, ServerAiError, serverAiFetch } from './serverAi'
import { AiTimeoutError, deadline } from './timeout'

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
export const GROQ_MODELS_URL = 'https://api.groq.com/openai/v1/models'
/** 큰 모델(하루 약 1,000번) → 작은 모델(하루 1만 번 넘게). 이름이 바뀌어 없어지면(404) Groq 모델 목록에서 새로 찾는다 */
export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

/** Groq 모델 목록에서 찾은, 지금 쓸 수 있는 글 모델 (앱을 켜 둔 동안만 기억) */
let discovered: string[] | null = null
export const clearGroqModelCache = () => {
  discovered = null
}

/** 글로 답하는 모델만 (음성·안전 검사 모델 빼기), 큰 모델 먼저 */
export function pickGroqModels(ids: string[]): string[] {
  const size = (id: string) => Number(id.match(/(\d+)b\b/i)?.[1] ?? 0)
  return ids
    .filter((id) => !/whisper|tts|guard|playai|distil|compound|vision|embed|prompt/i.test(id))
    .sort((a, b) => size(b) - size(a))
    .slice(0, 3)
}

async function findModels(fetcher: typeof fetch, apiKey: string, signal?: AbortSignal): Promise<string[]> {
  if (discovered) return discovered
  try {
    const res = await fetcher(GROQ_MODELS_URL, { method: 'GET', headers: { authorization: `Bearer ${apiKey}` }, signal })
    const data = (await res.json().catch(() => ({}))) as { data?: { id?: string; active?: boolean }[] }
    const ids = (data.data ?? []).filter((m) => m.id && m.active !== false).map((m) => m.id!)
    discovered = pickGroqModels(ids)
  } catch (err) {
    if (err instanceof ServerAiError) throw err
    discovered = []
  }
  return discovered
}

export interface GroqRequest {
  system: string
  user: string
  /** true 면 JSON 으로만 답하게 한다 */
  json?: boolean
  maxTokens?: number
  /** 모델 하나에 기다릴 시간(ms). 넘으면 멈추고 에러. 기본 20초 */
  timeoutMs?: number
  signal?: AbortSignal
}

/** Groq 에게 묻고 글 답과 쓴 모델을 돌려준다 */
export async function callGroq(apiKey: string, req: GroqRequest, fetcher: typeof fetch = appFetch(), models = GROQ_MODELS): Promise<{ text: string; model: string }> {
  // 키 대신 SERVER_KEY 면 Tidy 서버가 서버의 키로 대신 묻는다
  if (apiKey === SERVER_KEY) fetcher = serverAiFetch(fetcher)
  const first = discovered?.length ? discovered : models
  const r = await tryModels(apiKey, req, fetcher, first)
  if ('text' in r) return r
  // 정해 둔 모델이 다 없어졌으면(404) Groq 모델 목록에서 지금 있는 모델을 찾아 다시 묻는다
  if (r.gone) {
    const fresh = (await findModels(fetcher, apiKey, req.signal)).filter((m) => !first.includes(m))
    if (fresh.length) {
      const again = await tryModels(apiKey, req, fetcher, fresh)
      if ('text' in again) return again
      throw new Error(again.last)
    }
  }
  throw new Error(r.last)
}

/** 모델을 차례로 물어본다. 답을 받으면 { text, model }, 다 안 되면 마지막 이유와 "모델이 다 없어졌는지" */
async function tryModels(apiKey: string, req: GroqRequest, fetcher: typeof fetch, models: string[]): Promise<{ text: string; model: string } | { last: string; gone: boolean }> {
  let last = 'Groq에서 답을 받지 못했어요'
  let gone = true
  for (const model of models) {
    let res: Response
    const limit = deadline(req.timeoutMs ?? 20_000, req.signal)
    try {
      res = await fetcher(GROQ_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: req.system },
            { role: 'user', content: req.user },
          ],
          max_tokens: req.maxTokens ?? 1024,
          temperature: 0.4,
          ...(req.json ? { response_format: { type: 'json_object' } } : {}),
        }),
        signal: limit.signal,
      })
    } catch (err) {
      limit.done()
      if (req.signal?.aborted) throw err
      if (limit.timedOut()) throw new AiTimeoutError('Groq 답이 너무 오래 걸려서 멈췄어요')
      if (err instanceof ServerAiError) throw err
      const why = err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : ''
      throw new Error(`Groq에 연결하지 못했어요. 인터넷을 확인해 주세요${why}`)
    }
    const data = (await res
      .json()
      .catch(() => ({}))
      .finally(limit.done)) as { choices?: { message?: { content?: string } }[]; error?: { message?: string; code?: string } }
    const why = data.error?.message ?? ''
    if (res.status === 401 || res.status === 403) throw new Error('Groq 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
    // 한도를 다 썼거나(429), 모델이 없어졌거나(404·400 decommissioned), 붐비면(5xx) 다음 모델로
    if (res.status === 429) {
      last = 'Groq 무료 사용량도 다 썼어요'
      gone = false
      continue
    }
    if (res.status === 404 || /decommission|not found|does not exist/i.test(why)) {
      last = `Groq에 이 AI 모델이 없어졌어요 (${model})`
      continue
    }
    if (res.status >= 500) {
      last = `Groq 서버가 붐벼요 (${res.status}). 잠시 뒤에 다시 해 주세요`
      gone = false
      continue
    }
    if (!res.ok) throw new Error(`Groq에서 오류가 났어요 (${res.status}${why ? `: ${why.slice(0, 200)}` : ''})`)
    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (text) return { text, model }
    last = 'Groq가 빈 답을 줬어요'
    gone = false
  }
  return { last, gone }
}

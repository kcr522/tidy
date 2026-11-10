/**
 * 예비 AI: Groq 무료 (사용자 요청 2026-11-10)
 * Gemini 무료 한도를 다 쓰면 여기로 넘어온다. 큰 모델 → 작은 모델 순서로 묻고, 둘 다 막히면 에러.
 * Groq는 OpenAI와 같은 모양의 API를 쓴다. 키는 이 기기에만 저장한다.
 * 사진과 구글 검색은 못 한다 (사진이 있으면 부르는 쪽이 기기 안 글자 인식으로 바꿔서 글로 보낸다).
 */

import { appFetch } from '../../platform/nativeFetch'

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
/** 큰 모델(하루 약 1,000번) → 작은 모델(하루 1만 번 넘게) */
export const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']

export interface GroqRequest {
  system: string
  user: string
  /** true 면 JSON 으로만 답하게 한다 */
  json?: boolean
  maxTokens?: number
  signal?: AbortSignal
}

/** Groq 에게 묻고 글 답과 쓴 모델을 돌려준다 */
export async function callGroq(apiKey: string, req: GroqRequest, fetcher: typeof fetch = appFetch(), models = GROQ_MODELS): Promise<{ text: string; model: string }> {
  let last = 'Groq에서 답을 받지 못했어요'
  for (const model of models) {
    let res: Response
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
        signal: req.signal,
      })
    } catch (err) {
      if (req.signal?.aborted) throw err
      const why = err instanceof Error && err.message ? ` (${err.message.slice(0, 120)})` : ''
      throw new Error(`Groq에 연결하지 못했어요. 인터넷을 확인해 주세요${why}`)
    }
    const data = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[]; error?: { message?: string; code?: string } }
    const why = data.error?.message ?? ''
    if (res.status === 401 || res.status === 403) throw new Error('Groq 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
    // 한도를 다 썼거나(429), 모델이 없어졌거나(404·400 decommissioned), 붐비면(5xx) 다음 모델로
    if (res.status === 429) {
      last = 'Groq 무료 사용량도 다 썼어요'
      continue
    }
    if (res.status === 404 || res.status >= 500 || /decommission|not found|does not exist/i.test(why)) {
      last = `Groq에서 오류가 났어요 (${res.status})`
      continue
    }
    if (!res.ok) throw new Error(`Groq에서 오류가 났어요 (${res.status}${why ? `: ${why.slice(0, 200)}` : ''})`)
    const text = data.choices?.[0]?.message?.content?.trim() ?? ''
    if (text) return { text, model }
    last = 'Groq가 빈 답을 줬어요'
  }
  throw new Error(last)
}

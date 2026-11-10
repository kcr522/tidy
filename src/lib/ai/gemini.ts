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
  signal?: AbortSignal
}

/** 별칭이 안 되거나 붐비면 차례로 이 모델들로 다시 묻는다 (모두 무료 등급) */
export const GEMINI_FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite']
export const GEMINI_FALLBACK_MODEL = GEMINI_FALLBACK_MODELS[0]

type GeminiData = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string; status?: string }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Gemini 에게 묻고 글 답을 돌려준다 */
export async function callGemini(apiKey: string, req: GeminiRequest, fetcher: typeof fetch = fetch): Promise<string> {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: req.system }] },
    contents: [{ role: 'user', parts: req.parts }],
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
  for (const model of GEMINI_FALLBACK_MODELS) {
    if (!retry(res)) break
    if (res.status !== 404) await wait(800)
    res = await send(model)
  }
  const data = (await res.json().catch(() => ({}))) as GeminiData
  const why = data.error?.message ?? ''
  if (res.status === 429) throw new Error('오늘 무료 사용량을 다 썼어요. 잠시 뒤에 다시 해 주세요')
  if (/api.?key/i.test(why) || res.status === 401 || res.status === 403) throw new Error('Gemini 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
  if (/location is not supported/i.test(why)) throw new Error('지금 있는 곳에서는 Gemini 무료 등급을 쓸 수 없어요')
  if (res.status === 500 || res.status === 503) throw new Error('구글 Gemini 서버가 붐벼요. 잠시 뒤에 다시 해 주세요')
  // 그 밖의 오류는 원인을 찾을 수 있게 구글이 준 이유를 같이 보여 준다
  if (!res.ok) throw new Error(`Gemini에서 오류가 났어요 (${res.status}${why ? `: ${why.slice(0, 120)}` : ''})`)
  if (data.promptFeedback?.blockReason) throw new Error('Gemini가 이번엔 답하지 않았어요')
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error(data.candidates?.[0]?.finishReason === 'MAX_TOKENS' ? 'Gemini 답이 너무 길어서 끊겼어요. 다시 해 주세요' : 'Gemini가 빈 답을 줬어요')
  return text
}

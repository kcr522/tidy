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

/** 무료 사용량(분당·하루)을 넘었을 때 */
export class GeminiLimitError extends Error {}
/** 키가 틀렸을 때 */
export class GeminiKeyError extends Error {}

/** Gemini 에게 묻고 글 답을 돌려준다 */
export async function callGemini(apiKey: string, req: GeminiRequest, fetcher: typeof fetch = fetch): Promise<string> {
  let res: Response
  try {
    res = await fetcher(ENDPOINT(GEMINI_MODEL), {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: req.system }] },
        contents: [{ role: 'user', parts: req.parts }],
        ...(req.search ? { tools: [{ google_search: {} }] } : {}),
        generationConfig: {
          maxOutputTokens: req.maxTokens ?? 2048,
          ...(req.schema ? { responseMimeType: 'application/json' } : {}),
          ...(req.schema && Object.keys(req.schema).length ? { responseJsonSchema: req.schema } : {}),
        },
      }),
      signal: req.signal,
    })
  } catch (err) {
    if (req.signal?.aborted) throw err
    throw new Error('Gemini에 연결하지 못했어요. 인터넷을 확인해 주세요')
  }
  const data = (await res.json().catch(() => ({}))) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
    promptFeedback?: { blockReason?: string }
    error?: { message?: string }
  }
  if (res.status === 429) throw new GeminiLimitError('오늘 무료 사용량을 다 썼어요. 잠시 뒤에 다시 해 주세요')
  if (res.status === 400 && /api key/i.test(data.error?.message ?? '')) throw new GeminiKeyError('Gemini 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
  if (res.status === 401 || res.status === 403) throw new GeminiKeyError('Gemini 키가 맞지 않아요. 설정 > AI 연결에서 확인해 주세요')
  if (!res.ok) throw new Error('Gemini에서 오류가 났어요')
  if (data.promptFeedback?.blockReason) throw new Error('Gemini가 이번엔 답하지 않았어요')
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini가 빈 답을 줬어요')
  return text
}

// Google Gemini API (무료 사용량 있음): 앱 여러 곳(소비 한마디, AI 채팅)이 같이 쓰는 호출 함수
// 키는 Google AI Studio(aistudio.google.com)에서 무료로 만든다. 무료는 하루·분당 횟수 제한이 있다.

/** 무료로 쓸 수 있는 최신 Flash 모델을 가리키는 이름 (Google이 새 모델로 알아서 바꿔 준다) */
export const GEMINI_MODEL = 'gemini-flash-latest'

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models'

export type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

export interface GeminiRequest {
  system: string
  parts: GeminiPart[]
  /** 주면 JSON으로만 답한다 (responseSchema) */
  schema?: object
  signal?: AbortSignal
}

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

export async function callGemini(apiKey: string, req: GeminiRequest): Promise<string> {
  const res = await fetch(`${ENDPOINT}/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: req.system }] },
      contents: [{ role: 'user', parts: req.parts }],
      ...(req.schema ? { generationConfig: { responseMimeType: 'application/json', responseSchema: req.schema } } : {}),
    }),
    signal: req.signal,
  })
  const data = (await res.json().catch(() => ({}))) as GeminiResponse

  if (res.status === 429) throw new Error('오늘 무료 사용량을 다 썼어요. 잠시 뒤에 다시 해 주세요')
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error(/api key/i.test(data.error?.message ?? '') ? 'Gemini API 키가 맞지 않아요' : 'Gemini가 요청을 받지 않았어요')
  }
  if (!res.ok) throw new Error('Gemini 서버에서 오류가 났어요')
  if (data.promptFeedback?.blockReason) throw new Error('Gemini가 이번엔 답하지 않았어요')

  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => !p.thought)
    .map((p) => p.text ?? '')
    .join('')
    .trim()
  if (!text) throw new Error('Gemini가 빈 답을 줬어요')
  return text
}

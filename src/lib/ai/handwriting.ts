/**
 * 손글씨 → 글자 (사용자 요청 2026-11-17): 메모에 손으로 쓴 것을 검색할 수 있게 글자로 읽는다.
 * 기기 안 글자 읽기(tesseract)는 한글 손글씨를 거의 못 읽어서, 무료 Tidy AI(서버의 Gemini) 또는 내 Gemini 키로 읽는다.
 */
import { effectiveAi, type AiSettings } from './engines'
import { GeminiKeyError, GeminiLimitError, callGemini } from './gemini'
import { ServerAiError } from './serverAi'
import { loadAiSettings } from './settings'

export class HandwritingError extends Error {
  /** 오늘 한도를 다 써서 못 읽었다 (나중에 다시 하면 된다) */
  readonly later: boolean
  constructor(message: string, later = false) {
    super(message)
    this.later = later
  }
}

const SYSTEM = [
  '너는 손글씨를 글자로 옮겨 적는 도구야.',
  '사진 속 손글씨(한국어, 영어, 숫자, 기호)를 쓴 그대로 옮겨 적어. 줄은 그대로 나누고, 고치거나 요약하거나 설명을 붙이지 마.',
  '글자가 아닌 그림·낙서는 무시해. 읽을 글자가 하나도 없으면 아무것도 쓰지 마.',
].join('\n')

/** AI 가 덧붙인 따옴표·코드 블록·"(글자 없음)" 같은 것을 걷어 낸다 */
export function cleanReading(text: string): string {
  let t = text.trim()
  t = t.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim()
  if (/^["“'].*["”']$/s.test(t)) t = t.slice(1, -1).trim()
  if (/^\(?(글자\s*없음|없음|읽을\s*글자가\s*없[어습]|none|no text)\)?\.?$/i.test(t)) return ''
  return t
}

/**
 * 손글씨 그림(PNG data URL)을 글자로 읽는다.
 * AI 를 쓸 수 없거나 실패하면 HandwritingError (메시지를 그대로 보여 주면 된다)
 */
export async function readHandwriting(src: string, signal?: AbortSignal, chosen: AiSettings = loadAiSettings(), fetcher?: typeof fetch): Promise<string> {
  const settings = effectiveAi(chosen)
  const key = settings.engine === 'gemini' ? settings.geminiKey?.trim() : ''
  if (!key) throw new HandwritingError('손글씨를 글자로 읽으려면 설정 > AI에서 Tidy AI나 Gemini를 켜 주세요')
  const m = src.match(/^data:(image\/[\w+.-]+);base64,(.+)$/)
  if (!m) throw new HandwritingError('그림을 읽지 못했어요')
  try {
    const text = await callGemini(key, { system: SYSTEM, parts: [{ inlineData: { mimeType: m[1], data: m[2] } }, { text: '이 손글씨를 글자로 옮겨 적어 줘.' }], maxTokens: 1024, signal }, fetcher)
    return cleanReading(text)
  } catch (err) {
    if (signal?.aborted) throw err
    if (err instanceof GeminiLimitError) throw new HandwritingError('오늘 AI 사용량을 다 써서 손글씨는 나중에 읽을게요', true)
    if (err instanceof ServerAiError) throw new HandwritingError(err.message, err.limit)
    if (err instanceof GeminiKeyError) throw new HandwritingError('Gemini 키가 맞지 않아요. 설정 > AI를 확인해 주세요')
    throw new HandwritingError('손글씨를 읽지 못했어요. 인터넷을 확인하고 다시 눌러 주세요', true)
  }
}

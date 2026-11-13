import { effectiveAi, type AiSettings, type EngineId } from './engines'
import { callGemini } from './gemini'
import { callGroq } from './groq'
import { localSummary, summaryPrompt, SUMMARY_SYSTEM, type ScrapSummaryInput } from './scrapSummary'

export interface SummaryResult {
  text: string
  engine: EngineId
}

/**
 * 설정 > AI 연결에서 고른 방법으로 스크랩을 요약한다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 미리보기 설명을 줄여서 보여 준다
 * - Gemini (무료): 내 Gemini 키로 글과 캡처 사진을 읽어 정리한다. 사용량을 다 쓰면 기본 요약으로
 * - Tidy AI: 서버에 넣어 둔 무료 Gemini 키로 (키 입력 없이)
 */
export async function summarizeScrap(chosen: AiSettings, input: ScrapSummaryInput, signal?: AbortSignal): Promise<SummaryResult> {
  const r = await summarizeWith(effectiveAi(chosen), input, signal)
  return chosen.engine === 'tidy' && r.engine === 'gemini' ? { ...r, engine: 'tidy' } : r
}

async function summarizeWith(settings: AiSettings, input: ScrapSummaryInput, signal?: AbortSignal): Promise<SummaryResult> {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) {
    const parts = [...(input.image ? [{ inlineData: { mimeType: input.image.mediaType, data: input.image.data } }] : []), { text: summaryPrompt(input) }]
    try {
      return { text: (await callGemini(settings.geminiKey.trim(), { system: SUMMARY_SYSTEM, parts, maxTokens: 2048, signal })).slice(0, 1200), engine: 'gemini' }
    } catch (err) {
      if (signal?.aborted) throw err
      const groq = settings.groqKey?.trim()
      if (groq) {
        try {
          return { text: (await callGroq(groq, { system: SUMMARY_SYSTEM, user: summaryPrompt(input), maxTokens: 1024, signal })).text.slice(0, 1200), engine: 'groq' }
        } catch (err2) {
          if (signal?.aborted) throw err2
        }
      }
      return { text: localSummary(input), engine: 'local' }
    }
  }
  return { text: localSummary(input), engine: 'local' }
}

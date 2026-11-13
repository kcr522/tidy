import { effectiveAi, type AiSettings, type EngineId } from './engines'
import { callGemini } from './gemini'
import { callGroq } from './groq'
import { localSummary, SummaryError, summaryPrompt, SUMMARY_SYSTEM, type ScrapSummaryInput } from './scrapSummary'

export interface SummaryResult {
  text: string
  engine: EngineId
}

/**
 * 설정 > AI 연결에서 고른 방법으로 스크랩을 요약한다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 미리보기 설명을 줄여서 보여 준다
 * - Gemini (무료): 내 Gemini 키로 사이트 본문·사진과 캡처를 읽어 정리한다. 안 되면 이유를 알려 준다 (버튼이 기본 요약을 대신 넣는다)
 * - Tidy AI: 서버에 넣어 둔 무료 Gemini 키로 (키 입력 없이)
 */
export async function summarizeScrap(chosen: AiSettings, input: ScrapSummaryInput, signal?: AbortSignal): Promise<SummaryResult> {
  const r = await summarizeWith(effectiveAi(chosen), input, signal)
  return chosen.engine === 'tidy' && r.engine === 'gemini' ? { ...r, engine: 'tidy' } : r
}

async function summarizeWith(settings: AiSettings, input: ScrapSummaryInput, signal?: AbortSignal): Promise<SummaryResult> {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) {
    const parts = [
      ...(input.pageImages ?? []).map((data) => ({ inlineData: { mimeType: 'image/jpeg', data } })),
      ...(input.image ? [{ inlineData: { mimeType: input.image.mediaType, data: input.image.data } }] : []),
      { text: summaryPrompt(input) },
    ]
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
      // 로그인 안 함·오늘 횟수 다 씀처럼 이유가 분명하면 그 이유를 보여 준다 (조용히 기본 요약으로 넘어가지 않게)
      throw new SummaryError(err instanceof Error ? err.message : '지금은 AI에 연결하지 못했어요')
    }
  }
  return { text: localSummary(input), engine: 'local' }
}

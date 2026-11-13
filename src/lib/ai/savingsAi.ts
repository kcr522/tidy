import { parseSavingsText } from '../savingsText'
import { effectiveAi } from './engines'
import { callGemini } from './gemini'
import { callGroq } from './groq'
import { draftFromText, savingsPrompt, SavingsAiError, SAVINGS_SYSTEM, type SavingsAiInput, type SavingsDraft } from './savingsPrompt'
import { loadAiSettings } from './settings'

/**
 * 적금 글·캡처 읽기. 'AI 소비 한마디'와 같은 설정 > AI 연결 값을 쓴다.
 * - 기본(AI 없이): 글만 기기 안에서 읽는다 (사진은 못 읽는다)
 * - Tidy AI / 내 Gemini 키: Gemini가 글과 캡처를 읽는다. 막히면 예비 Groq(글만), 그래도 안 되면 기기 안에서
 */
export interface ReadResult {
  draft: SavingsDraft
  /** 누가 읽었나 */
  by: 'ai' | 'local'
  /** AI가 안 돼서 기기 안에서 읽었을 때 그 이유 */
  note?: string
}

async function askAi(input: SavingsAiInput, signal?: AbortSignal): Promise<SavingsDraft> {
  const s = effectiveAi(loadAiSettings())
  const gemini = s.engine === 'gemini' ? s.geminiKey?.trim() : undefined
  if (!gemini) throw new SavingsAiError('사진을 읽으려면 설정 > AI 연결에서 Tidy AI를 골라 주세요')
  try {
    const parts = [...(input.image ? [{ inlineData: { mimeType: input.image.mediaType, data: input.image.data } }] : []), { text: savingsPrompt(input) }]
    return draftFromText(await callGemini(gemini, { system: SAVINGS_SYSTEM, parts, schema: {}, maxTokens: 2048, signal }))
  } catch (err) {
    if (signal?.aborted) throw err
    const groq = s.groqKey?.trim()
    if (!groq || !input.text) throw err
    return draftFromText((await callGroq(groq, { system: SAVINGS_SYSTEM, user: savingsPrompt(input), json: true, maxTokens: 1024, signal })).text)
  }
}

/** 붙여 넣은 글 또는 캡처에서 적금 정보를 읽는다 */
export async function readSavings(input: SavingsAiInput, signal?: AbortSignal): Promise<ReadResult> {
  const local = input.text ? parseSavingsText(input.text, input.today) : {}
  if (loadAiSettings().engine === 'local') {
    if (input.image) throw new SavingsAiError('사진을 읽으려면 설정 > AI 연결에서 Tidy AI를 골라 주세요')
    return { draft: local, by: 'local' }
  }
  try {
    const ai = await askAi(input, signal)
    // AI가 비워 둔 칸은 기기에서 찾은 값으로 채운다
    return { draft: { ...local, ...ai }, by: 'ai' }
  } catch (err) {
    if (input.image && !input.text) throw err instanceof SavingsAiError ? err : new SavingsAiError(err instanceof Error ? err.message : '지금은 AI에 연결하지 못했어요')
    return { draft: local, by: 'local', note: err instanceof Error ? err.message : undefined }
  }
}

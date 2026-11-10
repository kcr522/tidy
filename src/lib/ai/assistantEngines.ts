import { askClaudeAssistant, assistantPrompt, AssistantError, ASSISTANT_SYSTEM, JSON_SHAPE, parseAssistantJson, type AssistantReply, type AssistantRequest } from './assistant'
import { askAdvisor } from './advisor'
import { callGemini, type GeminiSource } from './gemini'
import { localAssistant } from './assistantLocal'
import { DEFAULT_SERVER_URL, type AiSettings, type EngineId } from './engines'

export const DEFAULT_ASSISTANT_URL = '/api/assistant'

/** 설정의 서버 주소(…/api/feedback)와 같은 곳의 …/api/assistant */
export function assistantUrlFor(serverUrl?: string): string {
  const s = serverUrl?.trim()
  if (!s || s === DEFAULT_SERVER_URL) return DEFAULT_ASSISTANT_URL
  return s.replace(/\/api\/feedback\/?$/, '/api/assistant')
}

export interface AssistantResult extends AssistantReply {
  engine: EngineId
  /** AI를 못 써서 기본(AI 없이)으로 대신 답했을 때, 왜 그랬는지 */
  fallback?: string
  /** 질문에 답할 때 검색으로 찾은 출처 */
  sources?: GeminiSource[]
}

/**
 * 설정 > AI 연결에서 고른 방법으로 묻는다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 글에서 날짜·금액을 규칙으로 찾는다. 사진은 기기 안에서 글자를 읽어(OCR) 같은 규칙으로 찾는다
 * - Gemini (무료): 내 Gemini 키로 사진과 글을 읽는다
 * - 서버 / 내 키: Claude가 사진과 글을 읽는다
 */
export async function askAssistant(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
  try {
    const ai = await askAi(settings, req, signal)
    if (ai?.kind === 'question') return await answerQuestion(settings, req, ai, signal)
    if (ai) return ai
  } catch (err) {
    if (signal?.aborted) throw err
    // AI를 못 쓰면(무료 사용량을 다 썼거나, 서버가 붐비거나, 인터넷이 끊기면) 멈추지 않고 기본(AI 없이)으로 답한다
    const why = err instanceof Error ? err.message : 'AI에 연결하지 못했어요'
    return { ...(await askLocal(req)), fallback: why }
  }
  return askLocal(req)
}

/** 돈·생활 질문: Gemini가 검색까지 해서 답한다 */
async function answerQuestion(settings: AiSettings, req: AssistantRequest, ai: AssistantResult, signal?: AbortSignal): Promise<AssistantResult> {
  const question = req.text?.trim() || '사진 속 내용에 대해 알려 줘'
  if (settings.engine !== 'gemini' || !settings.geminiKey?.trim()) {
    return { ...ai, kind: 'none', reply: ai.reply || '질문에 답하는 건 설정 > AI 연결에서 Gemini (무료)를 고르면 할 수 있어요.' }
  }
  const a = await askAdvisor(settings.geminiKey.trim(), question, req.today, req.context, signal)
  return { ...ai, kind: 'question', reply: a.text.slice(0, 1500), sources: a.sources }
}

/** 고른 AI로 묻기. AI를 고르지 않았으면 null */
async function askAi(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult | null> {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) {
    const parts = [
      ...(req.image ? [{ inlineData: { mimeType: 'image/jpeg', data: req.image } }] : []),
      { text: `${assistantPrompt(req).replace(/report로 알려 줘\.$/, '알려 줘.')}\n\n${JSON_SHAPE}` },
    ]
    try {
      const text = await callGemini(settings.geminiKey.trim(), { system: ASSISTANT_SYSTEM, parts, schema: {}, maxTokens: 4096, signal })
      const out = parseAssistantJson(text)
      if (!out) throw new AssistantError('Gemini 답을 알아보지 못했어요')
      return { ...out, engine: 'gemini' }
    } catch (err) {
      if (signal?.aborted || err instanceof AssistantError) throw err
      throw new AssistantError(err instanceof Error ? err.message : 'Gemini에 연결하지 못했어요')
    }
  }
  if (settings.engine === 'server') {
    const res = await fetch(assistantUrlFor(settings.serverUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal,
    })
    const data = (await res.json().catch(() => ({}))) as Partial<AssistantReply> & { error?: string }
    if (!res.ok || !data.kind) throw new AssistantError(data.error ?? '서버에서 답을 받지 못했어요')
    return { kind: data.kind, reply: data.reply ?? '', events: data.events ?? [], payments: data.payments ?? [], diary: data.diary ?? null, engine: 'server' }
  }
  if (settings.engine === 'key' && settings.apiKey?.trim()) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 })
    return { ...(await askClaudeAssistant(client, req, signal)), engine: 'key' }
  }
  return null
}

async function askLocal(req: AssistantRequest): Promise<AssistantResult> {
  // 기본(AI 없이): 사진이 있으면 기기 안에서 글자를 읽고, 은행·카드 캡처면 내역을 규칙으로 찾는다
  if (req.image) {
    const { recognizeText } = await import('../ocr/recognize')
    const { parseBankText } = await import('../ocr/bankText')
    const read = await recognizeText(`data:image/jpeg;base64,${req.image}`).catch(() => '')
    const bank = parseBankText(read, req.today)
    if (bank.payments.length > 0) {
      const n = bank.payments.length
      return {
        kind: 'payment',
        reply: `캡처에서 결제 내역 ${n}건을 찾았어요. 맞는지 확인해 주세요.`,
        events: [],
        payments: bank.payments,
        diary: null,
        engine: 'local',
      }
    }
    const text = [req.text, read].filter((t) => t?.trim()).join('\n')
    return { ...localAssistant({ ...req, image: undefined, text }), engine: 'local' }
  }
  return { ...localAssistant(req), engine: 'local' }
}

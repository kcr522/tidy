import { askClaudeAssistant, assistantPrompt, AssistantError, ASSISTANT_SYSTEM, JSON_SHAPE, parseAssistantJson, type AssistantReply, type AssistantRequest } from './assistant'
import { callGemini } from './gemini'
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
}

/**
 * 설정 > AI 연결에서 고른 방법으로 묻는다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 글에서 날짜·금액을 규칙으로 찾는다. 사진은 기기 안에서 글자를 읽어(OCR) 같은 규칙으로 찾는다
 * - Gemini (무료): 내 Gemini 키로 사진과 글을 읽는다
 * - 서버 / 내 키: Claude가 사진과 글을 읽는다
 */
export async function askAssistant(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
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

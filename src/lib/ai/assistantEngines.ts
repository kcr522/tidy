import { askClaudeAssistant, AssistantError, type AssistantReply, type AssistantRequest } from './assistant'
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
 * - 기본(AI 없이): 글에서 날짜·금액을 규칙으로 찾는다 (사진은 못 읽는다)
 * - 서버 / 내 키: Claude가 사진과 글을 읽는다
 */
export async function askAssistant(settings: AiSettings, req: AssistantRequest, signal?: AbortSignal): Promise<AssistantResult> {
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
  return { ...localAssistant(req), engine: 'local' }
}

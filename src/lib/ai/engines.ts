import { callGemini } from './gemini'
import { localFeedback } from './localEngine'
import { askClaude, FeedbackError, systemPrompt, userPrompt, type FeedbackMode, type SpendingSnapshot } from './prompts'

/**
 * AI 연결 방법. 화면은 이 모양만 알고, 실제로 어디에 묻는지는 몰라도 된다.
 * 새 방법(예: Firebase Functions)이 생기면 여기에 하나 더 만들면 된다.
 */
export interface FeedbackEngine {
  id: EngineId
  generate(mode: FeedbackMode, snapshot: SpendingSnapshot, signal?: AbortSignal): Promise<string>
}

export type EngineId = 'local' | 'gemini' | 'server' | 'key'

export interface AiSettings {
  engine: EngineId
  /** engine = 'key' 일 때: 사용자 본인의 Claude API 키 (이 기기에만 저장) */
  apiKey?: string
  /** engine = 'gemini' 일 때: 무료 Gemini API 키 (이 기기에만 저장) */
  geminiKey?: string
  /** engine = 'server' 일 때: 한마디를 받아 올 주소 */
  serverUrl?: string
}

export const DEFAULT_SERVER_URL = '/api/feedback'

export const ENGINE_LABEL: Record<EngineId, { title: string; desc: string }> = {
  local: { title: '기본 (AI 없이)', desc: '인터넷 없이 앱이 정해진 문장으로 말해 줘요. 무료예요.' },
  gemini: { title: 'Gemini (무료)', desc: '구글 Gemini 무료 키로 이 기기에서 바로 물어봐요. 하루 사용 횟수 제한이 있어요.' },
  server: { title: 'Claude (Tidy 서버)', desc: '배포한 서버가 Claude에게 물어봐요. 키는 서버에만 있어요.' },
  key: { title: 'Claude (내 API 키)', desc: '이 기기에서 바로 Claude에게 물어봐요. 키는 이 기기에만 저장돼요.' },
}

/** 기기 안에서 만든다 */
export const localEngine: FeedbackEngine = {
  id: 'local',
  generate: async (mode, snapshot) => localFeedback(mode, snapshot),
}

/** 서버 함수(api/feedback.ts)에 묻는다 */
export function serverEngine(url = DEFAULT_SERVER_URL): FeedbackEngine {
  return {
    id: 'server',
    async generate(mode, snapshot, signal) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode, snapshot }),
        signal,
      })
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
      if (!res.ok || !data.text) throw new FeedbackError(data.error ?? '서버에서 답을 받지 못했어요')
      return data.text
    },
  }
}

/** 사용자 키로 이 기기에서 바로 묻는다. SDK는 처음 쓸 때만 불러온다 */
export function keyEngine(apiKey: string): FeedbackEngine {
  return {
    id: 'key',
    async generate(mode, snapshot, signal) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk')
      // 키가 이 기기 밖(브라우저)에 있다는 걸 알고 쓰는 방식이라 브라우저 사용을 허용한다
      const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
      return askClaude(client, mode, snapshot, signal)
    },
  }
}

/** 무료 Gemini 키로 이 기기에서 바로 묻는다 */
export function geminiEngine(apiKey: string): FeedbackEngine {
  return {
    id: 'gemini',
    async generate(mode, snapshot, signal) {
      try {
        return await callGemini(apiKey, { system: systemPrompt(mode), parts: [{ text: userPrompt(snapshot) }], maxTokens: 512, signal })
      } catch (err) {
        throw new FeedbackError(err instanceof Error ? err.message : 'Gemini에서 답을 받지 못했어요')
      }
    },
  }
}

export function engineFor(settings: AiSettings): FeedbackEngine {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) return geminiEngine(settings.geminiKey.trim())
  if (settings.engine === 'server') return serverEngine(settings.serverUrl?.trim() || DEFAULT_SERVER_URL)
  if (settings.engine === 'key' && settings.apiKey?.trim()) return keyEngine(settings.apiKey.trim())
  return localEngine
}

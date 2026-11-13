import { callGemini } from './gemini'
import { callGroq } from './groq'
import { localFeedback } from './localEngine'
import { SERVER_KEY } from './serverAi'
import { FeedbackError, systemPrompt, userPrompt, type FeedbackMode, type SpendingSnapshot } from './prompts'

/**
 * AI 연결 방법. 화면은 이 모양만 알고, 실제로 어디에 묻는지는 몰라도 된다.
 * 유료 AI(Claude)는 쓰지 않는다 (사용자 요청 2026-11-13). 무료 Gemini·Groq 와 기본(AI 없이)만.
 */
export interface FeedbackEngine {
  id: EngineId
  generate(mode: FeedbackMode, snapshot: SpendingSnapshot, signal?: AbortSignal): Promise<string>
}

export type EngineId = 'tidy' | 'local' | 'gemini' | 'groq'

export interface AiSettings {
  engine: EngineId
  /** engine = 'gemini' 일 때: 무료 Gemini API 키 (이 기기에만 저장) */
  geminiKey?: string
  /** 예비 AI: Groq 무료 키. 고른 AI가 막히면(한도 초과 등) 이걸로 다시 묻는다 (이 기기에만 저장) */
  groqKey?: string
}

export const ENGINE_LABEL: Record<EngineId, { title: string; desc: string }> = {
  tidy: { title: 'Tidy AI (자동, 무료)', desc: '키를 넣지 않아도 돼요. Tidy 서버에 미리 넣어 둔 무료 AI가 답해요. 구글 로그인하면 쓸 수 있고, 하루 횟수 제한이 있어요.' },
  local: { title: '기본 (AI 없이)', desc: '인터넷 없이 앱이 정해진 문장으로 말해 줘요. 무료예요.' },
  groq: { title: 'Groq (무료, 예비)', desc: 'Gemini 한도를 다 쓰면 대신 답해요.' },
  gemini: { title: 'Gemini (내 무료 키)', desc: '내가 만든 구글 Gemini 무료 키로 이 기기에서 바로 물어봐요. 하루 사용 횟수 제한이 있어요.' },
}

/** 기기 안에서 만든다 */
export const localEngine: FeedbackEngine = {
  id: 'local',
  generate: async (mode, snapshot) => localFeedback(mode, snapshot),
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

/** 예비 Groq 키로 묻는다 */
export function groqEngine(apiKey: string): FeedbackEngine {
  return {
    id: 'groq',
    async generate(mode, snapshot, signal) {
      try {
        return (await callGroq(apiKey, { system: systemPrompt(mode), user: userPrompt(snapshot), maxTokens: 512, signal })).text
      } catch (err) {
        throw new FeedbackError(err instanceof Error ? err.message : 'Groq에서 답을 받지 못했어요')
      }
    },
  }
}

/** 고른 AI가 막히면 예비 AI로 한 번 더 */
function withBackup(primary: FeedbackEngine, backup: FeedbackEngine): FeedbackEngine {
  return {
    id: primary.id,
    async generate(mode, snapshot, signal) {
      try {
        return await primary.generate(mode, snapshot, signal)
      } catch (err) {
        if (signal?.aborted) throw err
        return backup.generate(mode, snapshot, signal)
      }
    },
  }
}

/**
 * 실제로 쓸 설정: Tidy AI 를 골랐으면 키 자리에 SERVER_KEY 를 넣어 Gemini 처럼 쓴다 (서버의 키로 묻는다).
 * 내 Gemini 키를 넣었는데 예비 Groq 키가 없으면, 예비는 서버의 Groq 를 쓴다.
 */
export function effectiveAi(settings: AiSettings): AiSettings {
  if (settings.engine === 'tidy') return { ...settings, engine: 'gemini', geminiKey: SERVER_KEY, groqKey: settings.groqKey?.trim() || SERVER_KEY }
  if (settings.engine === 'gemini' && settings.geminiKey?.trim() && !settings.groqKey?.trim()) return { ...settings, groqKey: SERVER_KEY }
  return settings
}

function primaryFor(settings: AiSettings): FeedbackEngine | null {
  if (settings.engine === 'gemini' && settings.geminiKey?.trim()) return geminiEngine(settings.geminiKey.trim())
  return null
}

export function engineFor(chosen: AiSettings): FeedbackEngine {
  const settings = effectiveAi(chosen)
  const primary = primaryFor(settings)
  const groq = settings.groqKey?.trim()
  const engine = primary && groq ? withBackup(primary, groqEngine(groq)) : primary
  if (!engine) return localEngine
  // Tidy AI 는 화면에 'Tidy AI' 로 보여 준다
  return chosen.engine === 'tidy' ? { ...engine, id: 'tidy' } : engine
}

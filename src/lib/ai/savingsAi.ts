import { parseSavingsText } from '../savingsText'
import { SavingsAiError, type SavingsAiInput, type SavingsDraft } from './savingsPrompt'

/**
 * AI 연결 설정. 'AI 소비 한마디'의 설정 > AI 연결과 같은 값을 읽는다 (같은 키에 저장).
 * - local: AI 없이 (글만 읽을 수 있다)
 * - server: Tidy 서버(api/savings-parse)
 * - key: 내 Claude API 키로 이 기기에서 바로
 * 설정이 없으면 서버를 먼저 써 보고, 안 되면 글은 기기 안에서 읽는다.
 */
interface AiSettings {
  engine: 'local' | 'server' | 'key'
  apiKey?: string
}

function loadSettings(): AiSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem('tidy.ai.settings') ?? 'null') as AiSettings | null
    return v && (v.engine === 'local' || v.engine === 'server' || v.engine === 'key') ? v : null
  } catch {
    return null
  }
}

export const SAVINGS_API_URL = '/api/savings-parse'

async function askServer(input: SavingsAiInput, signal?: AbortSignal): Promise<SavingsDraft> {
  const res = await fetch(SAVINGS_API_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input), signal })
  const data = (await res.json().catch(() => ({}))) as { draft?: SavingsDraft; error?: string }
  if (!res.ok || !data.draft) throw new SavingsAiError(data.error ?? '서버에서 답을 받지 못했어요')
  return data.draft
}

async function askWithKey(apiKey: string, input: SavingsAiInput, signal?: AbortSignal): Promise<SavingsDraft> {
  const [{ default: Anthropic }, { askClaudeSavings }] = await Promise.all([import('@anthropic-ai/sdk'), import('./savingsPrompt')])
  // 키가 이 기기(브라우저)에 있다는 걸 알고 쓰는 방식이라 브라우저 사용을 허용한다
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 })
  return askClaudeSavings(client, input, signal)
}

export interface ReadResult {
  draft: SavingsDraft
  /** 누가 읽었나 */
  by: 'ai' | 'local'
  /** AI가 안 돼서 기기 안에서 읽었을 때 그 이유 */
  note?: string
}

/** 붙여 넣은 글 또는 캡처에서 적금 정보를 읽는다 */
export async function readSavings(input: SavingsAiInput, signal?: AbortSignal): Promise<ReadResult> {
  const settings = loadSettings()
  const local = input.text ? parseSavingsText(input.text, input.today) : {}
  if (settings?.engine === 'local') {
    if (input.image) throw new SavingsAiError('사진을 읽으려면 설정 > AI 연결에서 Claude를 골라 주세요')
    return { draft: local, by: 'local' }
  }
  try {
    const ai = settings?.engine === 'key' && settings.apiKey?.trim() ? await askWithKey(settings.apiKey.trim(), input, signal) : await askServer(input, signal)
    // AI가 비워 둔 칸은 기기에서 찾은 값으로 채운다
    return { draft: { ...local, ...ai }, by: 'ai' }
  } catch (err) {
    if (input.image && !input.text) throw err instanceof SavingsAiError ? err : new SavingsAiError('지금은 AI에 연결하지 못했어요')
    return { draft: local, by: 'local', note: err instanceof Error ? err.message : undefined }
  }
}

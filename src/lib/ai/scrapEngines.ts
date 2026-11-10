import { DEFAULT_SERVER_URL, type AiSettings, type EngineId } from './engines'
import { askClaudeSummary, localSummary, SummaryError, type ScrapSummaryInput } from './scrapSummary'

export const DEFAULT_SUMMARY_URL = '/api/scrap-summary'

/** 설정의 서버 주소(…/api/feedback)와 같은 곳의 …/api/scrap-summary */
export function summaryUrlFor(serverUrl?: string): string {
  const s = serverUrl?.trim()
  if (!s || s === DEFAULT_SERVER_URL) return DEFAULT_SUMMARY_URL
  try {
    return new URL('scrap-summary', new URL(s, window.location.href)).href
  } catch {
    return DEFAULT_SUMMARY_URL
  }
}

export interface SummaryResult {
  text: string
  engine: EngineId
}

/**
 * 설정 > AI 연결에서 고른 방법으로 스크랩을 요약한다 (AI 소비 한마디와 같은 설정)
 * - 기본(AI 없이): 미리보기 설명을 줄여서 보여 준다
 * - 서버 / 내 키: Claude가 정리한다
 */
export async function summarizeScrap(settings: AiSettings, input: ScrapSummaryInput, signal?: AbortSignal): Promise<SummaryResult> {
  if (settings.engine === 'server') {
    const res = await fetch(summaryUrlFor(settings.serverUrl), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ input }),
      signal,
    })
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }
    if (!res.ok || !data.text) throw new SummaryError(data.error ?? '서버에서 답을 받지 못했어요')
    return { text: data.text, engine: 'server' }
  }
  if (settings.engine === 'key' && settings.apiKey?.trim()) {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true, maxRetries: 1 })
    return { text: await askClaudeSummary(client, input, signal), engine: 'key' }
  }
  return { text: localSummary(input), engine: 'local' }
}

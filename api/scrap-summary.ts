// Vercel 서버 함수: POST /api/scrap-summary  { input } → { text }
// AI 소비 한마디(api/feedback.ts)와 같은 ANTHROPIC_API_KEY 환경 변수를 쓴다.
import Anthropic from '@anthropic-ai/sdk'
import { askClaudeSummary, sanitizeSummaryInput, SummaryError } from '../src/lib/ai/scrapSummary.js'

const client = new Anthropic({ maxRetries: 1 })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: '서버에 Claude API 키가 없어요' }, 503)

  const body = (await req.json().catch(() => null)) as { input?: unknown } | null
  const input = sanitizeSummaryInput(body?.input)
  if (!input) return json({ error: '요청 형식이 맞지 않아요' }, 400)

  try {
    return json({ text: await askClaudeSummary(client, input, req.signal) })
  } catch (err) {
    if (err instanceof SummaryError) return json({ error: err.message }, 502)
    if (err instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아요. 잠시 뒤에 다시 해 주세요' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: '서버의 Claude API 키가 맞지 않아요' }, 502)
    if (err instanceof Anthropic.APIError) return json({ error: 'AI 서버에서 오류가 났어요' }, 502)
    return json({ error: '지금은 AI에 연결하지 못했어요' }, 500)
  }
}

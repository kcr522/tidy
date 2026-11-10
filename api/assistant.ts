// Vercel 서버 함수: POST /api/assistant  { image?, text?, today, context? } → { kind, reply, events, payments, diary }
// AI 대화창: 사진이나 글을 보고 일정 / 결제 내역 / 일기를 찾는다.
// Claude API 키는 Vercel 프로젝트 설정의 환경 변수 ANTHROPIC_API_KEY 에만 둔다 (앱에는 없다).
import Anthropic from '@anthropic-ai/sdk'
import { askClaudeAssistant, AssistantError, sanitizeAssistantRequest } from '../src/lib/ai/assistant.js'

const client = new Anthropic({ maxRetries: 1 })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: '서버에 Claude API 키가 없어요' }, 503)

  const body = sanitizeAssistantRequest(await req.json().catch(() => null))
  if (!body) return json({ error: '사진이 너무 크거나 요청 형식이 맞지 않아요' }, 400)

  try {
    return json(await askClaudeAssistant(client, body, req.signal))
  } catch (err) {
    if (err instanceof AssistantError) return json({ error: err.message }, 502)
    if (err instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아요. 잠시 뒤에 다시 해 주세요' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: '서버의 Claude API 키가 맞지 않아요' }, 502)
    if (err instanceof Anthropic.APIError) return json({ error: 'AI 서버에서 오류가 났어요' }, 502)
    return json({ error: '지금은 AI에 연결하지 못했어요' }, 500)
  }
}

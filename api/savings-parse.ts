// Vercel 서버 함수: POST /api/savings-parse  { text?, image?, today } → { draft }
// 적금 상품 글이나 은행 앱 캡처를 Claude가 읽어 적금 칸을 채운다.
// Claude API 키는 Vercel 프로젝트 설정의 환경 변수 ANTHROPIC_API_KEY 에만 둔다 (앱에는 없다).
import Anthropic from '@anthropic-ai/sdk'
import { askClaudeSavings, sanitizeInput, SavingsAiError } from '../src/lib/ai/savingsPrompt.js'

const client = new Anthropic({ maxRetries: 1 })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: '서버에 Claude API 키가 없어요' }, 503)

  const input = sanitizeInput(await req.json().catch(() => null))
  if (!input) return json({ error: '글이나 사진을 넣어 주세요' }, 400)

  try {
    return json({ draft: await askClaudeSavings(client, input, req.signal) })
  } catch (err) {
    if (err instanceof SavingsAiError) return json({ error: err.message }, 502)
    if (err instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아요. 잠시 뒤에 다시 해 주세요' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: '서버의 Claude API 키가 맞지 않아요' }, 502)
    if (err instanceof Anthropic.APIError) return json({ error: 'AI 서버에서 오류가 났어요' }, 502)
    return json({ error: '지금은 AI에 연결하지 못했어요' }, 500)
  }
}

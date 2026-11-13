// Vercel 서버 함수: /api/ai  (Tidy AI: 키를 넣지 않아도 쓰는 AI)
// GET  → { gemini, groq, limit, today? }  서버에 키가 있는지, 오늘 사용량
// POST { provider: 'gemini' | 'groq', path?, method?, payload } → { status, data, usage }
// 키는 Vercel 프로젝트 설정의 환경 변수 GEMINI_API_KEY (필수), GROQ_API_KEY (예비, 넣지 않아도 됨) 에만 둔다 (앱에는 없다).
// 하루 횟수는 AI_DAILY_LIMIT (기본 50), 쓸 수 있는 메일을 정하려면 AI_ALLOWED_EMAILS (쉼표로 구분).
import { handleAiProxy, proxyEnvFrom } from '../src/lib/ai/proxyServer.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export async function GET(req: Request): Promise<Response> {
  const r = await handleAiProxy({ method: 'GET', authorization: req.headers.get('authorization') }, proxyEnvFrom(process.env))
  return json(r.body, r.status)
}

export async function POST(req: Request): Promise<Response> {
  const body = await req.json().catch(() => null)
  const r = await handleAiProxy({ method: 'POST', authorization: req.headers.get('authorization'), body }, proxyEnvFrom(process.env))
  return json(r.body, r.status)
}

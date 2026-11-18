// Vercel 서버 함수: /api/admin  (Tidy 관리자 페이지)
// GET ?check=1 → { admin }   GET → 사용자 목록 · AI 사용량 · 서버 상태 (관리자만)
// 관리자 메일은 Vercel 환경 변수 ADMIN_EMAILS, 모든 사람을 읽는 Firebase 서비스 계정은 FIREBASE_SERVICE_ACCOUNT 에만 둔다.
import { adminEnvFrom, handleAdmin } from '../src/lib/admin/adminServer.js'

export async function GET(req: Request): Promise<Response> {
  const check = new URL(req.url).searchParams.has('check')
  const r = await handleAdmin({ method: 'GET', authorization: req.headers.get('authorization'), check }, adminEnvFrom(process.env))
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
}

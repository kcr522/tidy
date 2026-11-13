// Vercel 서버 함수: POST /api/meal  { lat, lng } → { nearby }
// 음식 사진을 찍은 곳 근처 식당을 카카오 지도에서 찾는다 (사진은 Tidy AI(Gemini)가 읽는다).
// 키는 Vercel 프로젝트 설정의 환경 변수 KAKAO_REST_API_KEY 에만 둔다 (넣지 않으면 빈 목록).
import { nearbyPlaces } from '../src/lib/ai/places.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => null)) as { lat?: unknown; lng?: unknown } | null
  const lat = Number(body?.lat)
  const lng = Number(body?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return json({ error: '위치가 맞지 않아요' }, 400)
  const key = process.env.KAKAO_REST_API_KEY
  if (!key) return json({ nearby: [] })
  return json({ nearby: await nearbyPlaces(lat, lng, key, req.signal).catch(() => []) })
}

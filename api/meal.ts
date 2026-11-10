// Vercel 서버 함수: POST /api/meal  { image, date, time?, location?, placeHint? } → { guess, nearby }
// 키는 Vercel 프로젝트 설정의 환경 변수에만 둔다 (앱에는 없다):
//   ANTHROPIC_API_KEY  (필수) 사진 보고 음식 알아내기 + 메뉴판 가격 검색
//   KAKAO_REST_API_KEY (선택) 사진 찍은 곳 근처 식당 찾기. 없으면 AI가 좌표만 보고 찾는다
import Anthropic from '@anthropic-ai/sdk'
import { askClaudeMeal, MealError, sanitizeMealRequest } from '../src/lib/ai/meal.js'
import { nearbyPlaces } from '../src/lib/ai/places.js'

const client = new Anthropic({ maxRetries: 1 })

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

export async function POST(req: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: '서버에 Claude API 키가 없어요' }, 503)

  const meal = sanitizeMealRequest(await req.json().catch(() => null))
  if (!meal) return json({ error: '사진이 너무 크거나 요청 형식이 맞지 않아요' }, 400)

  const kakaoKey = process.env.KAKAO_REST_API_KEY
  if (meal.location && kakaoKey) {
    // 지도 검색이 안 되어도 사진만으로 계속한다
    meal.nearby = await nearbyPlaces(meal.location.lat, meal.location.lng, kakaoKey, req.signal).catch(() => [])
  }

  try {
    const guess = await askClaudeMeal(client, meal, req.signal)
    return json({ guess, nearby: meal.nearby ?? [] })
  } catch (err) {
    if (err instanceof MealError) return json({ error: err.message }, 502)
    if (err instanceof Anthropic.RateLimitError) return json({ error: '요청이 많아요. 잠시 뒤에 다시 해 주세요' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: '서버의 Claude API 키가 맞지 않아요' }, 502)
    if (err instanceof Anthropic.APIError) return json({ error: 'AI 서버에서 오류가 났어요' }, 502)
    return json({ error: '지금은 AI에 연결하지 못했어요' }, 500)
  }
}

// Vercel 서버 함수: GET /api/ical?url=https://calendar.google.com/calendar/ical/…/basic.ics → 그 캘린더(.ics) 글자
// 웹에서는 브라우저가 구글 캘린더 주소를 직접 읽을 수 없어서(CORS) 이 함수가 대신 읽는다. 구글 캘린더 주소만 받는다.
import { fetchIcal, IcalProxyError } from '../src/lib/icalProxy.js'

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url).searchParams.get('url') ?? ''
  try {
    const text = await fetchIcal(url, fetch, AbortSignal.timeout(15000))
    // 비공개 일정이라 어디에도 저장(캐시)하지 않는다
    return new Response(text, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'cache-control': 'no-store' } })
  } catch (err) {
    const status = err instanceof IcalProxyError ? err.status : 502
    const message = err instanceof Error ? err.message : '가져오지 못했어요'
    return new Response(JSON.stringify({ error: message }), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })
  }
}

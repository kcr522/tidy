// Vercel 서버 함수: GET /api/tile?z=15&x=27938&y=12693 → OpenStreetMap 지도 그림(PNG)
// 이동 기록 지도에 쓴다. OSM 사용 규칙대로 Tidy 라고 밝히고 받아서, Vercel 캐시에 오래 둔다 (같은 그림은 OSM 에 다시 안 물음).
import { osmTileUrl, parseTile, TILE_USER_AGENT } from '../src/lib/mapTile.js'

export async function GET(req: Request): Promise<Response> {
  const q = new URL(req.url).searchParams
  const t = parseTile(q.get('z'), q.get('x'), q.get('y'))
  if (!t) return new Response('bad tile', { status: 400, headers: { 'cache-control': 'no-store' } })
  try {
    const res = await fetch(osmTileUrl(t), { headers: { 'user-agent': TILE_USER_AGENT, referer: 'https://tidy-gules.vercel.app/', accept: 'image/png' }, signal: AbortSignal.timeout(10000) })
    // 어떤 이유로 못 받았는지 남긴다 (Vercel 로그 · 응답 머리글)
    if (!res.ok) {
      console.warn('tile upstream', res.status, osmTileUrl(t))
      return new Response(`tile error ${res.status}`, { status: 502, headers: { 'cache-control': 'no-store', 'x-upstream-status': String(res.status) } })
    }
    return new Response(await res.arrayBuffer(), {
      headers: {
        'content-type': res.headers.get('content-type') ?? 'image/png',
        // 폰 · 브라우저 7일, Vercel 캐시 30일
        'cache-control': 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400',
        'access-control-allow-origin': '*',
      },
    })
  } catch (err) {
    console.warn('tile fetch failed', err instanceof Error ? err.message : err)
    return new Response('tile error', { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}

// Vercel 서버 함수: GET /api/preview?url=https://...  → { title, description, siteName, image, imageData, source }
// 브라우저는 인스타그램·네이버·X 페이지를 직접 읽을 수 없어서(CORS) 이 함수가 대신 읽고 미리보기 정보만 돌려준다.
//   &mode=content → { text, images, caption } 본문 글과 사진 (AI 요약용). &images=0 이면 글만 (저장할 때 캡션 가져오기)
//   &mode=shot    → { imageData } 사이트 화면 캡처 (무료 캡처 서비스)
import { captureSite, readPageContent } from '../src/lib/scrap/pageContent.js'
import { buildPreview, PreviewError } from '../src/lib/scrap/previewServer.js'

const json = (body: unknown, status = 200, cache = false) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 같은 주소는 하루 동안 다시 읽지 않는다
      ...(cache ? { 'cache-control': 'public, s-maxage=86400, max-age=3600' } : {}),
    },
  })

export async function GET(req: Request): Promise<Response> {
  const params = new URL(req.url).searchParams
  const url = params.get('url')
  const mode = params.get('mode')
  if (!url) return json({ error: 'url이 필요해요' }, 400)
  try {
    if (mode === 'content') return json(await readPageContent(url, fetch, AbortSignal.timeout(15000), params.get('images') !== '0'), 200, true)
    if (mode === 'shot') return json({ imageData: await captureSite(url, fetch, AbortSignal.timeout(40000)) })
    return json(await buildPreview(url, fetch, AbortSignal.timeout(9000)), 200, true)
  } catch (err) {
    if (err instanceof PreviewError) return json({ error: err.message }, err.status)
    return json({ error: '미리보기를 가져오지 못했어요' }, 502)
  }
}

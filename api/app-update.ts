// Vercel 서버 함수: 앱 안에서 바로 업데이트하기
//  GET /api/app-update            → { versionCode, versionName, notes, publishedAt, size } (Releases 의 최신 tidy.apk)
//  GET /api/app-update?download=1 → 그 APK 파일로 넘겨준다 (GitHub 가 몇 분 동안만 여는 주소)
// 저장소가 비공개라서 Vercel 환경 변수 GITHUB_RELEASE_TOKEN (kcr522/tidy 의 Contents 읽기 전용 토큰)이 있어야 한다.
import { AppUpdateError, fetchLatestRelease, signedApkUrl } from '../src/lib/appUpdate.js'

const json = (body: unknown, status = 200, cache = 'no-store') =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': cache } })

export async function GET(req: Request): Promise<Response> {
  const token = process.env.GITHUB_RELEASE_TOKEN
  if (!token) return json({ error: '서버에 GitHub 토큰(GITHUB_RELEASE_TOKEN)이 없어요' }, 503)
  const repo = process.env.TIDY_RELEASE_REPO || 'kcr522/tidy'
  const signal = AbortSignal.timeout(15000)
  try {
    const { latest, asset } = await fetchLatestRelease(repo, token, fetch, signal)
    if (new URL(req.url).searchParams.has('download')) {
      const location = await signedApkUrl(asset, token, fetch, signal)
      return new Response(null, { status: 302, headers: { location, 'cache-control': 'no-store' } })
    }
    // 1분 동안은 Vercel 이 답을 기억해 둔다 (GitHub API 를 덜 부르게)
    return json(latest, 200, 'public, max-age=0, s-maxage=60')
  } catch (err) {
    const status = err instanceof AppUpdateError ? err.status : 502
    return json({ error: err instanceof Error ? err.message : '확인하지 못했어요' }, status)
  }
}

/**
 * 앱 안에서 바로 업데이트하기 (2026-11-12)
 * 새 APK 는 GitHub Actions(Android APK)가 Releases 에 올린다 (태그 v1.0.<번호>, 파일 tidy.apk, versionCode = 번호).
 * 저장소가 비공개라 폰이 GitHub 에서 바로 못 받아서, 우리 서버(api/app-update.ts)가 대신 묻고 받을 주소를 넘겨준다.
 */

/** 서버가 앱에 알려 주는 최신 버전 */
export interface LatestApp {
  versionCode: number
  versionName: string
  /** 이번에 바뀐 것 (한 줄씩) */
  notes: string[]
  publishedAt: string
  /** 파일 크기 (바이트) */
  size: number
}

export class AppUpdateError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export const APK_NAME = 'tidy.apk'
const FIXED_NOTE = '폰에서 이 파일(tidy.apk)을 받아 설치하면'

/** 'v1.0.63' → 63 (자동 버전 증가: versionCode = 마지막 숫자) */
export function versionCodeOfTag(tag: string): number | null {
  const m = /^v?\d+\.\d+\.(\d+)$/.exec(tag.trim())
  return m ? Number(m[1]) : null
}

/** 릴리스 설명에서 "바뀐 것"만 뽑는다. "Merge pull request …", Co-Authored-By 같은 줄과 고정 안내 문장은 뺀다 */
export function releaseNotes(body: string | null | undefined): string[] {
  return (body ?? '')
    .split(/\r?\n/)
    .map((l) => l.replace(/^[-*•]\s*/, '').trim())
    .filter((l) => l && !/^(Merge (pull request|branch)|Co-Authored-By:|Claude-Session:|Signed-off-by:)/i.test(l) && !l.startsWith(FIXED_NOTE))
    .slice(0, 5)
}

interface GhAsset {
  id: number
  name: string
  size: number
  url: string
}
interface GhRelease {
  tag_name: string
  body?: string | null
  published_at?: string
  assets?: GhAsset[]
}

/** GitHub 의 releases/latest 응답 → 최신 버전 정보와 APK 파일 */
export function parseRelease(r: GhRelease): { latest: LatestApp; asset: GhAsset } {
  const code = versionCodeOfTag(r.tag_name)
  const asset = r.assets?.find((a) => a.name === APK_NAME)
  if (code === null || !asset) throw new AppUpdateError(404, '아직 올라간 앱 파일이 없어요')
  return {
    latest: { versionCode: code, versionName: r.tag_name.replace(/^v/, ''), notes: releaseNotes(r.body), publishedAt: r.published_at ?? '', size: asset.size },
    asset,
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

/** 서버 쪽: GitHub 에서 최신 릴리스를 읽는다. token 은 저장소 읽기 권한만 있는 토큰 */
export async function fetchLatestRelease(repo: string, token: string, f: Fetch = fetch, signal?: AbortSignal): Promise<{ latest: LatestApp; asset: GhAsset }> {
  let res: Response
  try {
    res = await f(`https://api.github.com/repos/${repo}/releases/latest`, {
      signal,
      headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'tidy-app-update' },
    })
  } catch {
    throw new AppUpdateError(502, 'GitHub에 연결하지 못했어요')
  }
  if (res.status === 401 || res.status === 403) throw new AppUpdateError(502, '서버의 GitHub 토큰이 맞지 않아요')
  if (res.status === 404) throw new AppUpdateError(404, '아직 올라간 앱 파일이 없어요')
  if (!res.ok) throw new AppUpdateError(502, `GitHub 오류 (${res.status})`)
  return parseRelease((await res.json()) as GhRelease)
}

/** 서버 쪽: APK 파일의 잠깐 쓰는 다운로드 주소 (GitHub 가 몇 분 동안만 열어 둔다). 토큰은 폰으로 넘어가지 않는다 */
export async function signedApkUrl(asset: GhAsset, token: string, f: Fetch = fetch, signal?: AbortSignal): Promise<string> {
  let res: Response
  try {
    res = await f(asset.url, {
      signal,
      redirect: 'manual',
      headers: { accept: 'application/octet-stream', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28', 'user-agent': 'tidy-app-update' },
    })
  } catch {
    throw new AppUpdateError(502, 'GitHub에 연결하지 못했어요')
  }
  const location = res.headers.get('location')
  if (res.status >= 300 && res.status < 400 && location?.startsWith('https://')) return location
  throw new AppUpdateError(502, `파일 주소를 받지 못했어요 (${res.status})`)
}

/** 새 버전인가 */
export const isNewer = (latest: Pick<LatestApp, 'versionCode'> | null, currentCode: number | null): boolean =>
  !!latest && currentCode !== null && latest.versionCode > currentCode

/** 1234567 → '1.2MB' */
export function formatSize(bytes: number): string {
  if (!bytes) return ''
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`
}

// "나중에"를 누르면 그 버전은 하루 동안 다시 묻지 않는다
const SNOOZE_KEY = 'tidy.update.snooze'
const DAY = 24 * 60 * 60 * 1000

export function isSnoozed(versionCode: number, now = Date.now()): boolean {
  try {
    const s = JSON.parse(localStorage.getItem(SNOOZE_KEY) ?? 'null') as { code: number; at: number } | null
    return !!s && s.code === versionCode && now - s.at < DAY
  } catch {
    return false
  }
}

export function snooze(versionCode: number, now = Date.now()): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify({ code: versionCode, at: now }))
  } catch {
    // 저장이 안 되면 다음에 또 물어본다
  }
}

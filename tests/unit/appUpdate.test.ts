import { describe, expect, it } from 'vitest'
import { AppUpdateError, fetchLatestRelease, formatSize, isNewer, parseRelease, releaseNotes, signedApkUrl, versionCodeOfTag } from '../../src/lib/appUpdate'

const release = {
  tag_name: 'v1.0.64',
  body: 'Merge pull request #59 from kcr522/claude/x\n\n앱 안에서 바로 업데이트하기\n\n폰에서 이 파일(tidy.apk)을 받아 설치하면 이전 기록은 그대로 두고 업데이트돼요.',
  published_at: '2026-11-12T09:00:00Z',
  assets: [{ id: 7, name: 'tidy.apk', size: 9_437_184, url: 'https://api.github.com/repos/kcr522/tidy/releases/assets/7' }],
}

const TOKEN = 'tok'
const REPO = 'kcr522/tidy'
const SIGNED_URL = 'https://objects.githubusercontent.com/signed?x=1'

/** GitHub 흉내: 최신 릴리스는 release, 파일 받기는 잠깐 쓰는 주소로 302 */
function fakeGitHub(calls: { url: string; init?: RequestInit }[]) {
  return async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (url.endsWith('/releases/latest')) return new Response(JSON.stringify(release), { status: 200 })
    return new Response(null, { status: 302, headers: { location: SIGNED_URL } })
  }
}

describe('앱 업데이트', () => {
  it.each([
    ['v1.0.63', 63],
    ['1.0.7', 7],
    ['latest', null],
  ])('태그 "%s" 에서 버전 번호 %s 를 읽는다', (tag, versionCode) => {
    expect(versionCodeOfTag(tag)).toBe(versionCode)
  })

  it('바뀐 점에서 Merge 줄과 설치 안내 문장은 뺀다', () => {
    expect(releaseNotes(release.body)).toEqual(['앱 안에서 바로 업데이트하기'])
  })

  it('바뀐 점에서 Co-Authored-By · Claude-Session 줄은 뺀다', () => {
    const body = '새 기능\n\nCo-Authored-By: A <a@b.c>\nClaude-Session: https://x'

    expect(releaseNotes(body)).toEqual(['새 기능'])
  })

  it('바뀐 점이 비어 있으면 빈 목록을 준다', () => {
    expect(releaseNotes(null)).toEqual([])
  })

  it('릴리스에서 버전 · 크기 · 받을 파일을 읽는다', () => {
    const { latest, asset } = parseRelease(release)

    expect(latest).toMatchObject({ versionCode: 64, versionName: '1.0.64', size: 9_437_184 })
    expect(asset.id).toBe(7)
  })

  it('릴리스에 apk 파일이 없으면 AppUpdateError 를 낸다', () => {
    const noAssets = { ...release, assets: [] }

    expect(() => parseRelease(noAssets)).toThrow(AppUpdateError)
  })

  const NOT_INSTALLED = null
  const NO_LATEST = null

  it.each([
    ['64 가 63 보다 새 버전', { versionCode: 64 }, 63, true],
    ['같은 63 은 새 버전 아님', { versionCode: 63 }, 63, false],
    ['지금 버전을 모르면 아님', { versionCode: 64 }, NOT_INSTALLED, false],
    ['최신 버전을 모르면 아님', NO_LATEST, 1, false],
  ])('%s', (_case, latest, current, isNewVersion) => {
    expect(isNewer(latest, current)).toBe(isNewVersion)
  })

  it.each([
    [9_437_184, '9.0MB'], // 9 × 1024 × 1024
    [2048, '2KB'],
  ])('%i 바이트는 "%s" 로 보여 준다', (bytes, label) => {
    expect(formatSize(bytes)).toBe(label)
  })

  it('GitHub 에 토큰을 붙여 묻고, 다운로드는 잠깐 쓰는 주소만 돌려준다', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const fetchGitHub = fakeGitHub(calls)

    const { asset } = await fetchLatestRelease(REPO, TOKEN, fetchGitHub)
    const apkUrl = await signedApkUrl(asset, TOKEN, fetchGitHub)

    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe(`Bearer ${TOKEN}`)
    expect(apkUrl).toBe(SIGNED_URL)
    expect(calls[1].init?.redirect).toBe('manual') // 302 를 따라가지 않고 주소만 받았는지 확인
  })

  it('토큰이 틀려 401 이 오면 토큰 문제라고 알려 준다', async () => {
    const unauthorized = async () => new Response('{}', { status: 401 })

    await expect(fetchLatestRelease(REPO, 'bad', unauthorized)).rejects.toThrow('토큰')
  })
})

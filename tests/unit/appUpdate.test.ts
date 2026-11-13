import { describe, expect, it } from 'vitest'
import { AppUpdateError, fetchLatestRelease, formatSize, isNewer, parseRelease, releaseNotes, signedApkUrl, versionCodeOfTag } from '../../src/lib/appUpdate'

const release = {
  tag_name: 'v1.0.64',
  body: 'Merge pull request #59 from kcr522/claude/x\n\n앱 안에서 바로 업데이트하기\n\n폰에서 이 파일(tidy.apk)을 받아 설치하면 이전 기록은 그대로 두고 업데이트돼요.',
  published_at: '2026-11-12T09:00:00Z',
  assets: [{ id: 7, name: 'tidy.apk', size: 9_437_184, url: 'https://api.github.com/repos/kcr522/tidy/releases/assets/7' }],
}

describe('앱 업데이트', () => {
  it('태그에서 버전 번호를 읽는다', () => {
    expect(versionCodeOfTag('v1.0.63')).toBe(63)
    expect(versionCodeOfTag('1.0.7')).toBe(7)
    expect(versionCodeOfTag('latest')).toBeNull()
  })

  it('바뀐 점에서 Merge 줄과 고정 안내는 뺀다', () => {
    expect(releaseNotes(release.body)).toEqual(['앱 안에서 바로 업데이트하기'])
    expect(releaseNotes('새 기능\n\nCo-Authored-By: A <a@b.c>\nClaude-Session: https://x')).toEqual(['새 기능'])
    expect(releaseNotes(null)).toEqual([])
  })

  it('릴리스를 읽는다', () => {
    const { latest, asset } = parseRelease(release)
    expect(latest).toMatchObject({ versionCode: 64, versionName: '1.0.64', size: 9_437_184 })
    expect(asset.id).toBe(7)
    expect(() => parseRelease({ ...release, assets: [] })).toThrow(AppUpdateError)
  })

  it('새 버전인지 비교한다', () => {
    expect(isNewer({ versionCode: 64 }, 63)).toBe(true)
    expect(isNewer({ versionCode: 63 }, 63)).toBe(false)
    expect(isNewer({ versionCode: 64 }, null)).toBe(false)
    expect(isNewer(null, 1)).toBe(false)
  })

  it('크기를 보기 좋게', () => {
    expect(formatSize(9_437_184)).toBe('9.0MB')
    expect(formatSize(2048)).toBe('2KB')
  })

  it('GitHub 에 토큰을 붙여 묻고, 다운로드는 잠깐 쓰는 주소만 돌려준다', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const f = async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (url.endsWith('/releases/latest')) return new Response(JSON.stringify(release), { status: 200 })
      return new Response(null, { status: 302, headers: { location: 'https://objects.githubusercontent.com/signed?x=1' } })
    }
    const { asset } = await fetchLatestRelease('kcr522/tidy', 'tok', f)
    expect(new Headers(calls[0].init?.headers).get('authorization')).toBe('Bearer tok')
    expect(await signedApkUrl(asset, 'tok', f)).toBe('https://objects.githubusercontent.com/signed?x=1')
    expect(calls[1].init?.redirect).toBe('manual')
  })

  it('토큰이 틀리면 알려 준다', async () => {
    const f = async () => new Response('{}', { status: 401 })
    await expect(fetchLatestRelease('kcr522/tidy', 'bad', f)).rejects.toThrow('토큰')
  })
})

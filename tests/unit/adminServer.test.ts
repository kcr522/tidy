import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { adminEnvFrom, handleAdmin, kstDay, lastDays, parseServiceAccount, type AdminReport } from '../../src/lib/admin/adminServer'
import { ago } from '../../src/lib/admin/ago'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const SA = JSON.stringify({ client_email: 'admin@tidy-b0d8d.iam.gserviceaccount.com', private_key: privateKey, project_id: 'tidy-b0d8d' })
const NOW = new Date('2026-11-18T03:00:00Z')

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** 구글 API 흉내: 토큰 tok-admin 은 관리자, tok-user 는 일반 사람 */
function fakeGoogle(log: string[] = []): typeof fetch {
  return async (input, init) => {
    const url = String(input)
    log.push(url)
    const body = typeof init?.body === 'string' ? init.body : ''
    if (url.includes('accounts:lookup')) {
      const t = (JSON.parse(body) as { idToken: string }).idToken
      if (t === 'tok-admin') return json({ users: [{ localId: 'u1', email: 'Boss@Gmail.com', emailVerified: true }] })
      if (t === 'tok-user') return json({ users: [{ localId: 'u2', email: 'friend@gmail.com', emailVerified: true }] })
      return json({ error: { message: 'INVALID_ID_TOKEN' } }, 400)
    }
    if (url.startsWith('https://oauth2.googleapis.com/token')) return json({ access_token: 'sa-token' })
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer sa-token')
    if (url.includes('accounts:batchGet'))
      return json({
        users: [
          { localId: 'u1', email: 'boss@gmail.com', displayName: '주인', createdAt: '1762000000000', lastLoginAt: '1763000000000', lastRefreshAt: '2026-11-18T02:00:00Z' },
          { localId: 'u2', email: 'friend@gmail.com', displayName: '친구', createdAt: '1762100000000', lastLoginAt: '1763100000000' },
        ],
      })
    if (url.endsWith(':batchGet'))
      return json([
        { found: { name: 'projects/tidy-b0d8d/databases/(default)/documents/users/u1/aiUsage/2026-11-18', fields: { count: { integerValue: '12' }, tokens: { integerValue: '3400' } } } },
        { found: { name: 'projects/tidy-b0d8d/databases/(default)/documents/users/u2/aiUsage/2026-11-17', fields: { count: { integerValue: '3' }, tokens: { integerValue: '900' } } } },
        { missing: 'projects/tidy-b0d8d/databases/(default)/documents/users/u2/aiUsage/2026-11-18' },
      ])
    if (url.includes(':runAggregationQuery')) {
      const n = body.includes('"rows"') ? (url.includes('/u1:') ? 820 : 40) : 5
      return json([{ result: { aggregateFields: { n: { integerValue: String(n) } } } }])
    }
    if (url.includes(':runQuery')) return json([{ document: { name: 'x', fields: { u: { timestampValue: url.includes('/u1:') ? '2026-11-18T01:30:00Z' : '2026-11-10T09:00:00Z' } } } }])
    if (url.endsWith('/meta/devices')) return url.includes('/u1/') ? json({ name: 'x', fields: { next: { integerValue: '3' } } }) : json({}, 404)
    return json({}, 500)
  }
}

const env = (extra: Record<string, string> = {}) => adminEnvFrom({ ADMIN_EMAILS: 'boss@gmail.com', FIREBASE_SERVICE_ACCOUNT: SA, AI_DAILY_LIMIT: '30', GEMINI_API_KEY: 'g', ...extra })

const ADMIN = { method: 'GET', authorization: 'Bearer tok-admin' }
const OTHER_USER = { method: 'GET', authorization: 'Bearer tok-user' }
const NOT_LOGGED_IN = { method: 'GET' }
const BAD_TOKEN = { method: 'GET', authorization: 'Bearer bad' }

describe('관리자 페이지 서버', () => {
  it.each([
    ['로그인 안 함', NOT_LOGGED_IN],
    ['깨진 토큰', BAD_TOKEN],
  ])('%s 이면 401 로 거절한다', async (_case, request) => {
    const result = await handleAdmin(request, env(), fakeGoogle())

    expect(result.status).toBe(401)
  })

  it('관리자가 아닌 사람은 403 이고, 서비스 계정은 쓰지도 않는다', async () => {
    const log: string[] = []

    const result = await handleAdmin(OTHER_USER, env(), fakeGoogle(log))

    expect(result.status).toBe(403)
    expect(log.some((url) => url.includes('oauth2'))).toBe(false) // 서비스 계정 토큰을 받으러 가지 않았는지 확인
  })

  it('관리자 메일 설정이 비어 있으면 403 과 ADMIN_EMAILS 설정 안내를 준다', async () => {
    const noAdminEmails = env({ ADMIN_EMAILS: '' })

    const result = await handleAdmin(ADMIN, noAdminEmails, fakeGoogle())

    expect(result).toMatchObject({ status: 403, body: { setup: 'ADMIN_EMAILS' } })
  })

  it.each([
    [ADMIN, true],
    [OTHER_USER, false],
  ])('check=1 이면 관리자인지만 알려 준다 (관리자 여부 $1)', async (request, isAdmin) => {
    const result = await handleAdmin({ ...request, check: true }, env(), fakeGoogle())

    expect(result.body).toEqual({ admin: isAdmin })
  })

  it('서비스 계정 설정이 비어 있으면 503 과 설정 안내를 준다', async () => {
    const noAccount = env({ FIREBASE_SERVICE_ACCOUNT: '' })

    const result = await handleAdmin(ADMIN, noAccount, fakeGoogle())

    expect(result).toMatchObject({ status: 503, body: { setup: 'FIREBASE_SERVICE_ACCOUNT' } })
  })

  it('서비스 계정 값이 깨진 JSON 이면 503 을 준다', async () => {
    const brokenAccount = env({ FIREBASE_SERVICE_ACCOUNT: '{nope' })

    const result = await handleAdmin(ADMIN, brokenAccount, fakeGoogle())

    expect(result).toMatchObject({ status: 503 })
  })

  it('관리자가 열면 사용자 목록 · 기록 수 · 기기 수를 모아 준다', async () => {
    const result = await handleAdmin(ADMIN, env(), fakeGoogle(), NOW)

    expect(result.status).toBe(200)
    const report = result.body as AdminReport
    expect(report.today).toBe('2026-11-18')
    expect(report.users.map((user) => user.email)).toEqual(['boss@gmail.com', 'friend@gmail.com'])
    const [boss, friend] = report.users
    expect(boss).toMatchObject({ name: '주인', admin: true, rows: 820, files: 5, devices: 2, lastSyncAt: Date.parse('2026-11-18T01:30:00Z'), lastActiveAt: Date.parse('2026-11-18T02:00:00Z') })
    expect(friend).toMatchObject({ admin: false, rows: 40, devices: 0 })
    expect(report.warnings).toEqual([])
  })

  it('관리자가 열면 사람별 · 날짜별 AI 사용량을 7일치 모아 준다', async () => {
    const result = await handleAdmin(ADMIN, env(), fakeGoogle(), NOW)

    const report = result.body as AdminReport
    const [boss, friend] = report.users
    expect(boss.ai[0]).toEqual({ day: '2026-11-18', count: 12, tokens: 3400 })
    expect(friend.ai[1]).toEqual({ day: '2026-11-17', count: 3, tokens: 900 })
    expect(report.ai).toMatchObject({ limit: 30, gemini: true, groq: false })
    expect(report.ai.days).toHaveLength(7)
    expect(report.ai.days[0]).toEqual({ day: '2026-11-18', count: 12, tokens: 3400, users: 1 })
  })

  it('서비스 계정 값은 JSON 이나 base64 둘 다 받는다', () => {
    const base64 = Buffer.from(SA).toString('base64')

    expect(parseServiceAccount(SA)).toMatchObject({ client_email: 'admin@tidy-b0d8d.iam.gserviceaccount.com' })
    expect(parseServiceAccount(base64)).toMatchObject({ project_id: 'tidy-b0d8d' })
  })

  it('서비스 계정 값이 깨졌으면 broken, 없으면 null 을 준다', () => {
    expect(parseServiceAccount('x')).toBe('broken')
    expect(parseServiceAccount(undefined)).toBeNull()
  })

  it('날짜는 한국 시간으로 센다 (UTC 15:30 = 한국 다음 날 0:30)', () => {
    expect(kstDay(new Date('2026-11-17T15:30:00Z'))).toBe('2026-11-18')
    expect(lastDays(3, NOW)).toEqual(['2026-11-18', '2026-11-17', '2026-11-16'])
  })

  const SECOND = 1000
  const MINUTE = 60 * SECOND
  const HOUR = 60 * MINUTE
  const now = NOW.getTime()

  it.each([
    ['기록 없음', '—', undefined],
    ['30초 전', '방금', now - 30 * SECOND],
    ['5분 전', '5분 전', now - 5 * MINUTE],
    ['3시간 전', '3시간 전', now - 3 * HOUR],
    ['30시간 전', '어제', now - 30 * HOUR],
    ['한 달 넘게 전', '10월 2일', Date.parse('2026-10-02T03:00:00Z')],
  ])('%s 이면 "%s" 라고 보여 준다', (_case, label, time) => {
    expect(ago(time, now)).toBe(label)
  })
})

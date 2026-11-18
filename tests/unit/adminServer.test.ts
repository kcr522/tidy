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

describe('관리자 페이지 서버', () => {
  it('관리자 확인은 서버에서: 로그인 안 함 401, 다른 사람 403, 관리자 메일이 없으면 403', async () => {
    expect((await handleAdmin({ method: 'GET' }, env(), fakeGoogle())).status).toBe(401)
    expect((await handleAdmin({ method: 'GET', authorization: 'Bearer bad' }, env(), fakeGoogle())).status).toBe(401)
    const log: string[] = []
    const other = await handleAdmin({ method: 'GET', authorization: 'Bearer tok-user' }, env(), fakeGoogle(log))
    expect(other.status).toBe(403)
    expect(log.some((u) => u.includes('oauth2'))).toBe(false) // 다른 사람이면 서비스 계정을 쓰지도 않는다
    const noAdmin = await handleAdmin({ method: 'GET', authorization: 'Bearer tok-admin' }, env({ ADMIN_EMAILS: '' }), fakeGoogle())
    expect(noAdmin).toMatchObject({ status: 403, body: { setup: 'ADMIN_EMAILS' } })
  })

  it('check=1 은 관리자인지만 알려 준다', async () => {
    expect((await handleAdmin({ method: 'GET', authorization: 'Bearer tok-admin', check: true }, env(), fakeGoogle())).body).toEqual({ admin: true })
    expect((await handleAdmin({ method: 'GET', authorization: 'Bearer tok-user', check: true }, env(), fakeGoogle())).body).toEqual({ admin: false })
  })

  it('서비스 계정이 없거나 깨졌으면 설정 안내', async () => {
    expect(await handleAdmin({ method: 'GET', authorization: 'Bearer tok-admin' }, env({ FIREBASE_SERVICE_ACCOUNT: '' }), fakeGoogle())).toMatchObject({ status: 503, body: { setup: 'FIREBASE_SERVICE_ACCOUNT' } })
    expect(await handleAdmin({ method: 'GET', authorization: 'Bearer tok-admin' }, env({ FIREBASE_SERVICE_ACCOUNT: '{nope' }), fakeGoogle())).toMatchObject({ status: 503 })
  })

  it('사용자 목록 · AI 사용량 · 기록 수를 모은다', async () => {
    const r = await handleAdmin({ method: 'GET', authorization: 'Bearer tok-admin' }, env(), fakeGoogle(), NOW)
    expect(r.status).toBe(200)
    const rep = r.body as AdminReport
    expect(rep.today).toBe('2026-11-18')
    expect(rep.users.map((u) => u.email)).toEqual(['boss@gmail.com', 'friend@gmail.com'])
    const [boss, friend] = rep.users
    expect(boss).toMatchObject({ name: '주인', admin: true, rows: 820, files: 5, devices: 2, lastSyncAt: Date.parse('2026-11-18T01:30:00Z'), lastActiveAt: Date.parse('2026-11-18T02:00:00Z') })
    expect(boss.ai[0]).toEqual({ day: '2026-11-18', count: 12, tokens: 3400 })
    expect(friend).toMatchObject({ admin: false, rows: 40, devices: 0 })
    expect(friend.ai[1]).toEqual({ day: '2026-11-17', count: 3, tokens: 900 })
    expect(rep.ai).toMatchObject({ limit: 30, gemini: true, groq: false })
    expect(rep.ai.days).toHaveLength(7)
    expect(rep.ai.days[0]).toEqual({ day: '2026-11-18', count: 12, tokens: 3400, users: 1 })
    expect(rep.warnings).toEqual([])
  })

  it('서비스 계정 값은 JSON 이나 base64 둘 다 받는다', () => {
    expect(parseServiceAccount(SA)).toMatchObject({ client_email: 'admin@tidy-b0d8d.iam.gserviceaccount.com' })
    expect(parseServiceAccount(Buffer.from(SA).toString('base64'))).toMatchObject({ project_id: 'tidy-b0d8d' })
    expect(parseServiceAccount('x')).toBe('broken')
    expect(parseServiceAccount(undefined)).toBeNull()
  })

  it('날짜는 한국 시간', () => {
    expect(kstDay(new Date('2026-11-17T15:30:00Z'))).toBe('2026-11-18')
    expect(lastDays(3, NOW)).toEqual(['2026-11-18', '2026-11-17', '2026-11-16'])
  })

  it('얼마 전인지 쉽게', () => {
    const now = NOW.getTime()
    expect(ago(undefined, now)).toBe('—')
    expect(ago(now - 30_000, now)).toBe('방금')
    expect(ago(now - 5 * 60_000, now)).toBe('5분 전')
    expect(ago(now - 3 * 3600_000, now)).toBe('3시간 전')
    expect(ago(now - 30 * 3600_000, now)).toBe('어제')
    expect(ago(Date.parse('2026-10-02T03:00:00Z'), now)).toBe('10월 2일')
  })
})

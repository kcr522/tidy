/**
 * Tidy 관리자 서버 (api/admin.ts, 개발 서버가 같이 쓴다) (사용자 요청 2026-11-18)
 * 주인 계정 한 곳에서 "누가 쓰는지, AI 를 얼마나 쓰는지, 지금 몇 버전인지"를 본다.
 * - 관리자 확인은 서버에서 한다: 로그인 토큰을 구글에 확인하고, 메일이 ADMIN_EMAILS 에 있고 인증된 메일일 때만 통과
 * - 모든 사람 목록과 기록 수는 Firebase 서비스 계정(FIREBASE_SERVICE_ACCOUNT, Vercel 환경 변수에만)으로 읽는다
 *   Firestore 보안 규칙(본인 자리만)은 그대로 둔다. 서비스 계정은 서버에만 있고 앱으로는 절대 보내지 않는다
 * - 일기·가계부 같은 내용은 읽지 않는다. 개수와 시각만 센다
 * 이 파일은 서버에서도 돌아서 다른 파일을 import 하지 않는다 (node:crypto 만).
 */
import { createSign } from 'node:crypto'

const FIREBASE_API_KEY = 'AIzaSyAlkxWKQPttsDaUo4Obe_nX36mz1IsKM7o'
const PROJECT_ID = 'tidy-b0d8d'
const DEFAULT_DAILY_LIMIT = 50
/** AI 사용량을 며칠치 보여 줄지 */
export const USAGE_DAYS = 7

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id?: string
}

export interface AdminEnv {
  firebaseApiKey: string
  projectId: string
  adminEmails: string[]
  serviceAccount: ServiceAccount | null
  /** 서비스 계정 값이 있는데 JSON 모양이 아닐 때 */
  serviceAccountBroken: boolean
  dailyLimit: number
  allowedEmails: number
  gemini: boolean
  groq: boolean
  kakao: boolean
  releaseToken: boolean
  commit: string
  branch: string
  vercelEnv: string
}

type Env = Record<string, string | undefined>

/** 환경 변수 값: JSON 그대로 또는 base64 로 넣은 JSON 둘 다 받는다 */
export function parseServiceAccount(raw: string | undefined): ServiceAccount | null | 'broken' {
  const v = raw?.trim()
  if (!v) return null
  const tryParse = (s: string): ServiceAccount | null => {
    try {
      const j = JSON.parse(s) as Partial<ServiceAccount>
      if (typeof j.client_email === 'string' && typeof j.private_key === 'string') return { client_email: j.client_email, private_key: j.private_key.replace(/\\n/g, '\n'), project_id: j.project_id }
    } catch {
      /* 아래에서 base64 로 */
    }
    return null
  }
  return tryParse(v) ?? tryParse(Buffer.from(v, 'base64').toString('utf8')) ?? 'broken'
}

export function adminEnvFrom(env: Env): AdminEnv {
  const sa = parseServiceAccount(env.FIREBASE_SERVICE_ACCOUNT)
  const limit = Number(env.AI_DAILY_LIMIT)
  return {
    firebaseApiKey: env.FIREBASE_API_KEY?.trim() || env.VITE_FIREBASE_API_KEY?.trim() || FIREBASE_API_KEY,
    projectId: env.FIREBASE_PROJECT_ID?.trim() || env.VITE_FIREBASE_PROJECT_ID?.trim() || (sa && sa !== 'broken' ? sa.project_id : undefined) || PROJECT_ID,
    adminEmails: (env.ADMIN_EMAILS ?? '')
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
    serviceAccount: sa && sa !== 'broken' ? sa : null,
    serviceAccountBroken: sa === 'broken',
    dailyLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_DAILY_LIMIT,
    allowedEmails: (env.AI_ALLOWED_EMAILS ?? '').split(/[,\s]+/).filter(Boolean).length,
    gemini: Boolean(env.GEMINI_API_KEY?.trim()),
    groq: Boolean(env.GROQ_API_KEY?.trim()),
    kakao: Boolean(env.KAKAO_REST_API_KEY?.trim()),
    releaseToken: Boolean(env.GITHUB_RELEASE_TOKEN?.trim()),
    commit: env.VERCEL_GIT_COMMIT_SHA ?? '',
    branch: env.VERCEL_GIT_COMMIT_REF ?? '',
    vercelEnv: env.VERCEL_ENV ?? '',
  }
}

/** 한국 시간 날짜 (YYYY-MM-DD) */
export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

/** 오늘부터 거꾸로 n일 (오늘이 먼저) */
export function lastDays(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => kstDay(new Date(now.getTime() - i * 86400_000)))
}

// ---------- 답 모양 ----------

export interface AdminUser {
  uid: string
  email: string
  name: string
  photoUrl?: string
  /** 가입 (ms) */
  createdAt?: number
  /** 마지막 로그인 (ms) */
  lastLoginAt?: number
  /** 마지막으로 앱을 연 때 (로그인 토큰을 새로 받은 때, ms) */
  lastActiveAt?: number
  /** 마지막으로 기록을 올린 때 (ms) */
  lastSyncAt?: number
  disabled: boolean
  /** 클라우드에 있는 기록 수 (지운 표시 포함) */
  rows: number | null
  /** 사진·첨부 파일 수 */
  files: number | null
  /** 이 계정으로 동기화한 기기 수 */
  devices: number | null
  /** 날짜별 AI 사용량 (오늘이 먼저, USAGE_DAYS 일) */
  ai: { day: string; count: number; tokens: number }[]
  admin: boolean
}

export interface AdminReport {
  generatedAt: string
  today: string
  users: AdminUser[]
  ai: {
    limit: number
    gemini: boolean
    groq: boolean
    /** 날짜별 전체 사용량 (오늘이 먼저) */
    days: { day: string; count: number; tokens: number; users: number }[]
  }
  server: {
    commit: string
    branch: string
    vercelEnv: string
    kakao: boolean
    releaseToken: boolean
    allowedEmails: number
  }
  /** 일부를 못 읽었을 때 알려 줄 말 */
  warnings: string[]
}

export interface AdminReply {
  status: number
  body: unknown
}

const err = (status: number, message: string, extra: Record<string, unknown> = {}): AdminReply => ({ status, body: { error: message, ...extra } })

// ---------- 관리자 확인 ----------

interface Who {
  uid: string
  email: string
}

async function verifyCaller(authorization: string | null | undefined, env: AdminEnv, fetcher: typeof fetch): Promise<Who | AdminReply> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return err(401, '구글로 로그인해야 볼 수 있어요')
  let res: Response
  try {
    res = await fetcher(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(env.firebaseApiKey)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
    })
  } catch {
    return err(502, '로그인을 확인하지 못했어요. 잠시 뒤에 다시 해 주세요')
  }
  const data = (await res.json().catch(() => ({}))) as { users?: { localId?: string; email?: string; emailVerified?: boolean }[] }
  const user = data.users?.[0]
  if (!res.ok || !user?.localId) return err(401, '로그인이 끝났어요. 다시 로그인해 주세요')
  const email = (user.email ?? '').toLowerCase()
  if (!env.adminEmails.length) return err(403, '관리자 메일(ADMIN_EMAILS)이 서버에 아직 없어요', { admin: false, setup: 'ADMIN_EMAILS' })
  if (!user.emailVerified || !env.adminEmails.includes(email)) return err(403, '관리자만 볼 수 있어요', { admin: false })
  return { uid: user.localId, email }
}

// ---------- 서비스 계정으로 구글 API 부르기 ----------

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')

let cachedToken: { key: string; token: string; until: number } | null = null

/** 서비스 계정 → 1시간짜리 구글 접근 토큰 (50분 동안 기억) */
export async function serviceToken(sa: ServiceAccount, fetcher: typeof fetch, now = Date.now()): Promise<string> {
  if (cachedToken && cachedToken.key === sa.client_email && cachedToken.until > now) return cachedToken.token
  const iat = Math.floor(now / 1000)
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat,
      exp: iat + 3600,
    }),
  )
  const signer = createSign('RSA-SHA256')
  signer.update(`${head}.${claim}`)
  const jwt = `${head}.${claim}.${b64url(signer.sign(sa.private_key))}`
  const res = await fetcher('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error_description?: string }
  if (!res.ok || !data.access_token) throw new Error(`서비스 계정으로 로그인하지 못했어요${data.error_description ? ` (${data.error_description})` : ''}`)
  cachedToken = { key: sa.client_email, token: data.access_token, until: now + 50 * 60_000 }
  return data.access_token
}

interface AuthUser {
  localId: string
  email?: string
  displayName?: string
  photoUrl?: string
  createdAt?: string
  lastLoginAt?: string
  lastRefreshAt?: string
  disabled?: boolean
}

/** Firebase 로그인한 모든 사람 (1000명씩) */
async function listAuthUsers(env: AdminEnv, token: string, fetcher: typeof fetch): Promise<AuthUser[]> {
  const out: AuthUser[] = []
  let next = ''
  for (let page = 0; page < 10; page++) {
    const url = `https://identitytoolkit.googleapis.com/v1/projects/${env.projectId}/accounts:batchGet?maxResults=1000${next ? `&nextPageToken=${encodeURIComponent(next)}` : ''}`
    const res = await fetcher(url, { headers: { authorization: `Bearer ${token}` } })
    const data = (await res.json().catch(() => ({}))) as { users?: AuthUser[]; nextPageToken?: string; error?: { message?: string } }
    if (!res.ok) throw new Error(`사용자 목록을 읽지 못했어요 (${res.status}${data.error?.message ? ` ${data.error.message}` : ''})`)
    out.push(...(data.users ?? []))
    if (!data.nextPageToken) break
    next = data.nextPageToken
  }
  return out
}

const docsRoot = (env: AdminEnv) => `projects/${env.projectId}/databases/(default)/documents`
const fsUrl = (env: AdminEnv, tail: string) => `https://firestore.googleapis.com/v1/${docsRoot(env)}${tail}`

interface FsValue {
  integerValue?: string
  doubleValue?: number
  stringValue?: string
  timestampValue?: string
}
interface FsDoc {
  name: string
  fields?: Record<string, FsValue>
  updateTime?: string
}

const num = (v: FsValue | undefined): number => Number(v?.integerValue ?? v?.doubleValue ?? 0) || 0

/** 여러 사람의 날짜별 AI 사용량 문서를 한 번에 */
async function readAiUsage(env: AdminEnv, token: string, uids: string[], days: string[], fetcher: typeof fetch): Promise<Map<string, { count: number; tokens: number }>> {
  const map = new Map<string, { count: number; tokens: number }>()
  const names = uids.flatMap((u) => days.map((d) => `${docsRoot(env)}/users/${u}/aiUsage/${d}`))
  for (let i = 0; i < names.length; i += 100) {
    const res = await fetcher(`https://firestore.googleapis.com/v1/${docsRoot(env)}:batchGet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ documents: names.slice(i, i + 100) }),
    })
    if (!res.ok) throw new Error(`AI 사용량을 읽지 못했어요 (${res.status})`)
    const rows = (await res.json().catch(() => [])) as { found?: FsDoc }[]
    for (const r of rows) {
      const m = r.found?.name.match(/users\/([^/]+)\/aiUsage\/([^/]+)$/)
      if (m && r.found) map.set(`${m[1]}/${m[2]}`, { count: num(r.found.fields?.count), tokens: num(r.found.fields?.tokens) })
    }
  }
  return map
}

/** users/{uid}/{collection} 문서 수 */
async function countDocs(env: AdminEnv, token: string, uid: string, collection: string, fetcher: typeof fetch): Promise<number | null> {
  const res = await fetcher(fsUrl(env, `/users/${uid}:runAggregationQuery`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredAggregationQuery: { structuredQuery: { from: [{ collectionId: collection }] }, aggregations: [{ alias: 'n', count: {} }] } }),
  })
  if (!res.ok) return null
  const rows = (await res.json().catch(() => [])) as { result?: { aggregateFields?: { n?: FsValue } } }[]
  return num(rows.find((r) => r.result)?.result?.aggregateFields?.n)
}

/** 마지막으로 올린 기록 시각 (rows 의 u 가 가장 큰 것) */
async function lastSync(env: AdminEnv, token: string, uid: string, fetcher: typeof fetch): Promise<number | undefined> {
  const res = await fetcher(fsUrl(env, `/users/${uid}:runQuery`), {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'rows' }], select: { fields: [{ fieldPath: 'u' }] }, orderBy: [{ field: { fieldPath: 'u' }, direction: 'DESCENDING' }], limit: 1 } }),
  })
  if (!res.ok) return undefined
  const rows = (await res.json().catch(() => [])) as { document?: FsDoc }[]
  const d = rows.find((r) => r.document)?.document
  const t = d?.fields?.u?.timestampValue ?? d?.updateTime
  const ms = t ? Date.parse(t) : NaN
  return Number.isFinite(ms) ? ms : undefined
}

/** 동기화한 기기 수 (meta/devices 의 next 는 "다음 기기 번호") */
async function deviceCount(env: AdminEnv, token: string, uid: string, fetcher: typeof fetch): Promise<number | null> {
  const res = await fetcher(fsUrl(env, `/users/${uid}/meta/devices`), { headers: { authorization: `Bearer ${token}` } })
  if (res.status === 404) return 0
  if (!res.ok) return null
  const d = (await res.json().catch(() => ({}))) as FsDoc
  const next = num(d.fields?.next)
  return next > 0 ? next - 1 : 0
}

const ms = (v: string | undefined): number | undefined => {
  if (!v) return undefined
  const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v)
  return Number.isFinite(n) ? n : undefined
}

/** 사람마다 나눠 읽는 것은 한꺼번에 너무 많이 보내지 않게 4명씩 */
async function eachLimited<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k])
      }
    }),
  )
  return out
}

export async function buildReport(env: AdminEnv, me: Who, fetcher: typeof fetch, now = new Date()): Promise<AdminReport> {
  const sa = env.serviceAccount
  if (!sa) throw new Error('no service account')
  const token = await serviceToken(sa, fetcher, now.getTime())
  const days = lastDays(USAGE_DAYS, now)
  const warnings: string[] = []
  const auth = await listAuthUsers(env, token, fetcher)
  const uids = auth.map((u) => u.localId)
  let usage = new Map<string, { count: number; tokens: number }>()
  try {
    usage = await readAiUsage(env, token, uids, days, fetcher)
  } catch (e) {
    warnings.push(e instanceof Error ? e.message : 'AI 사용량을 읽지 못했어요')
  }
  const extra = await eachLimited(auth, 4, async (u) => {
    const safe = <T>(p: Promise<T>, fallback: T) => p.catch(() => fallback)
    const [rows, files, devices, sync] = await Promise.all([
      safe(countDocs(env, token, u.localId, 'rows', fetcher), null),
      safe(countDocs(env, token, u.localId, 'files', fetcher), null),
      safe(deviceCount(env, token, u.localId, fetcher), null),
      safe(lastSync(env, token, u.localId, fetcher), undefined),
    ])
    return { rows, files, devices, sync }
  })
  if (extra.some((x) => x.rows === null)) warnings.push('일부 사람의 기록 수를 읽지 못했어요')

  const users: AdminUser[] = auth.map((u, i) => {
    const email = (u.email ?? '').toLowerCase()
    return {
      uid: u.localId,
      email,
      name: u.displayName ?? '',
      ...(u.photoUrl ? { photoUrl: u.photoUrl } : {}),
      createdAt: ms(u.createdAt),
      lastLoginAt: ms(u.lastLoginAt),
      lastActiveAt: ms(u.lastRefreshAt) ?? ms(u.lastLoginAt),
      lastSyncAt: extra[i].sync,
      disabled: Boolean(u.disabled),
      rows: extra[i].rows,
      files: extra[i].files,
      devices: extra[i].devices,
      ai: days.map((day) => ({ day, ...(usage.get(`${u.localId}/${day}`) ?? { count: 0, tokens: 0 }) })),
      admin: u.localId === me.uid || env.adminEmails.includes(email),
    }
  })
  // 최근에 쓴 사람이 위로
  users.sort((a, b) => Math.max(b.lastActiveAt ?? 0, b.lastSyncAt ?? 0) - Math.max(a.lastActiveAt ?? 0, a.lastSyncAt ?? 0))

  return {
    generatedAt: now.toISOString(),
    today: days[0],
    users,
    ai: {
      limit: env.dailyLimit,
      gemini: env.gemini,
      groq: env.groq,
      days: days.map((day) => {
        const per = users.map((u) => u.ai.find((a) => a.day === day)!)
        return { day, count: per.reduce((s, a) => s + a.count, 0), tokens: per.reduce((s, a) => s + a.tokens, 0), users: per.filter((a) => a.count > 0).length }
      }),
    },
    server: { commit: env.commit, branch: env.branch, vercelEnv: env.vercelEnv, kakao: env.kakao, releaseToken: env.releaseToken, allowedEmails: env.allowedEmails },
    warnings,
  }
}

/**
 * /api/admin 한 번 처리
 *  GET ?check=1 → { admin: boolean }  (설정 화면에 "관리자" 칸을 보여 줄지)
 *  GET          → AdminReport (관리자만)
 */
export async function handleAdmin(req: { method: string; authorization?: string | null; check?: boolean }, env: AdminEnv, fetcher: typeof fetch = fetch, now = new Date()): Promise<AdminReply> {
  if (req.method !== 'GET') return err(405, '지원하지 않는 요청이에요')
  const who = await verifyCaller(req.authorization, env, fetcher)
  if (req.check) return { status: 200, body: { admin: 'uid' in who } }
  if (!('uid' in who)) return who
  if (env.serviceAccountBroken) return err(503, '서비스 계정 값(FIREBASE_SERVICE_ACCOUNT)이 JSON 모양이 아니에요. 받은 파일 내용을 그대로 붙여 넣어 주세요', { setup: 'FIREBASE_SERVICE_ACCOUNT' })
  if (!env.serviceAccount) return err(503, '서버에 Firebase 서비스 계정(FIREBASE_SERVICE_ACCOUNT)이 아직 없어요', { setup: 'FIREBASE_SERVICE_ACCOUNT' })
  try {
    return { status: 200, body: await buildReport(env, who, fetcher, now) }
  } catch (e) {
    return err(502, e instanceof Error ? e.message : '정보를 모으지 못했어요')
  }
}

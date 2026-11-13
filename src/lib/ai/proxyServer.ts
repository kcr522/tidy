/**
 * Tidy AI 서버 (api/ai.ts, 개발 서버가 같이 쓴다) (사용자 요청 2026-11-13)
 * 사용자가 키를 넣지 않아도 AI를 쓸 수 있게, Vercel 환경 변수에 넣어 둔 무료 Gemini·Groq 키로 대신 묻는다.
 * - 구글 로그인한 사람만 쓸 수 있다 (Firebase 로그인 토큰을 확인한다). AI_ALLOWED_EMAILS 를 넣으면 그 메일만
 * - 한 사람이 하루에 쓸 수 있는 횟수(AI_DAILY_LIMIT, 기본 50번)를 정하고, 쓴 횟수와 토큰은
 *   그 사람의 Firestore 자리(users/내 uid/aiUsage/날짜)에 센다. 그래서 답할 때마다 "오늘 몇 번 남았는지"를 같이 돌려준다
 * - 키는 서버에만 있고 앱으로는 절대 보내지 않는다
 * 이 파일은 서버에서도 돌아서 다른 파일을 import 하지 않는다.
 */

export interface AiProxyEnv {
  geminiKey?: string
  groqKey?: string
  /** Firebase 웹 API 키 (공개 값). 로그인 토큰 확인과 Firestore 에 쓴다 */
  firebaseApiKey: string
  projectId: string
  /** 한 사람이 하루에 쓸 수 있는 횟수 */
  dailyLimit: number
  /** 비어 있으면 로그인한 누구나 */
  allowedEmails: string[]
}

const FIREBASE_API_KEY = 'AIzaSyAlkxWKQPttsDaUo4Obe_nX36mz1IsKM7o'
const PROJECT_ID = 'tidy-b0d8d'
export const DEFAULT_DAILY_LIMIT = 50

type Env = Record<string, string | undefined>

export function proxyEnvFrom(env: Env): AiProxyEnv {
  const limit = Number(env.AI_DAILY_LIMIT)
  return {
    geminiKey: env.GEMINI_API_KEY?.trim() || undefined,
    groqKey: env.GROQ_API_KEY?.trim() || undefined,
    firebaseApiKey: env.FIREBASE_API_KEY?.trim() || env.VITE_FIREBASE_API_KEY?.trim() || FIREBASE_API_KEY,
    projectId: env.FIREBASE_PROJECT_ID?.trim() || env.VITE_FIREBASE_PROJECT_ID?.trim() || PROJECT_ID,
    dailyLimit: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : DEFAULT_DAILY_LIMIT,
    allowedEmails: (env.AI_ALLOWED_EMAILS ?? '')
      .split(/[,\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  }
}

/** 답할 때마다 같이 돌려주는 사용량 */
export interface AiUsage {
  /** 오늘(한국 시간) 쓴 횟수 */
  used: number
  limit: number
  remaining: number
  /** 이번 한 번에 쓴 토큰 (모르면 0) */
  tokens: number
  /** 오늘 쓴 토큰 합계 */
  tokensToday: number
  provider: 'gemini' | 'groq'
  /** Groq 가 알려 주는 키 전체의 남은 횟수 (Gemini 는 알려 주지 않는다) */
  providerRemaining?: number
}

/** GET 으로 묻는 서버 상태 */
export interface AiServerStatus {
  gemini: boolean
  groq: boolean
  limit: number
  /** 로그인 토큰을 같이 보냈으면 오늘 사용량 */
  today?: { used: number; tokens: number; remaining: number }
}

export interface ProxyReply {
  status: number
  body: unknown
}

export interface ProxyRequest {
  method: string
  authorization?: string | null
  body?: unknown
}

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/'

/** 앱이 보내도 되는 Gemini 주소: 모델 목록(GET), 답 만들기(POST) */
const GEMINI_LIST = /^models(\?pageSize=\d{1,3})?$/
const GEMINI_GENERATE = /^models\/gemini-[\w.-]+:generateContent$/

const err = (status: number, message: string, extra: Record<string, unknown> = {}): ProxyReply => ({ status, body: { tidyError: message, ...extra } })

/** 한국 시간 오늘 날짜 (YYYY-MM-DD) */
export function kstDay(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

interface Who {
  uid: string
  email: string
  token: string
}

/** 확인한 로그인 토큰을 잠깐 기억 (같은 사람이 연달아 물을 때 빠르게) */
const verified = new Map<string, { who: Who; until: number }>()

async function verifyUser(authorization: string | null | undefined, env: AiProxyEnv, fetcher: typeof fetch): Promise<Who | ProxyReply> {
  const token = authorization?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return err(401, 'Tidy AI는 구글 로그인하면 쓸 수 있어요')
  const hit = verified.get(token)
  if (hit && hit.until > Date.now()) return hit.who
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
  const data = (await res.json().catch(() => ({}))) as { users?: { localId?: string; email?: string }[] }
  const user = data.users?.[0]
  if (!res.ok || !user?.localId) return err(401, '로그인이 끝났어요. 다시 로그인해 주세요')
  const who = { uid: user.localId, email: (user.email ?? '').toLowerCase(), token }
  if (env.allowedEmails.length && !env.allowedEmails.includes(who.email)) return err(403, '이 계정은 Tidy AI를 쓸 수 없어요')
  if (verified.size > 200) verified.clear()
  verified.set(token, { who, until: Date.now() + 5 * 60_000 })
  return who
}

/** 그 사람의 오늘 사용량 문서 */
const usageDoc = (env: AiProxyEnv, uid: string, day: string) => `projects/${env.projectId}/databases/(default)/documents/users/${uid}/aiUsage/${day}`

/**
 * 오늘 사용량에 횟수·토큰을 더하고 더한 뒤의 값을 돌려준다.
 * 그 사람의 로그인 토큰으로 쓰기 때문에 Firestore 보안 규칙(본인 자리만)이 그대로 지켜 준다. 못 세면 null
 */
async function addUsage(env: AiProxyEnv, who: Who, day: string, count: number, tokens: number, fetcher: typeof fetch): Promise<{ used: number; tokens: number } | null> {
  const name = usageDoc(env, who.uid, day)
  try {
    const res = await fetcher(`https://firestore.googleapis.com/v1/projects/${env.projectId}/databases/(default)/documents:commit`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${who.token}` },
      body: JSON.stringify({
        writes: [
          {
            update: { name, fields: { day: { stringValue: day } } },
            updateMask: { fieldPaths: ['day'] },
            updateTransforms: [
              { fieldPath: 'count', increment: { integerValue: String(count) } },
              { fieldPath: 'tokens', increment: { integerValue: String(tokens) } },
              { fieldPath: 'at', setToServerValue: 'REQUEST_TIME' },
            ],
          },
        ],
      }),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => ({}))) as { writeResults?: { transformResults?: { integerValue?: string }[] }[] }
    const r = data.writeResults?.[0]?.transformResults ?? []
    return { used: Number(r[0]?.integerValue ?? 0), tokens: Number(r[1]?.integerValue ?? 0) }
  } catch {
    return null
  }
}

async function readUsage(env: AiProxyEnv, who: Who, day: string, fetcher: typeof fetch): Promise<{ used: number; tokens: number }> {
  try {
    const res = await fetcher(`https://firestore.googleapis.com/v1/${usageDoc(env, who.uid, day)}`, { headers: { authorization: `Bearer ${who.token}` } })
    if (!res.ok) return { used: 0, tokens: 0 }
    const data = (await res.json().catch(() => ({}))) as { fields?: { count?: { integerValue?: string }; tokens?: { integerValue?: string } } }
    return { used: Number(data.fields?.count?.integerValue ?? 0), tokens: Number(data.fields?.tokens?.integerValue ?? 0) }
  } catch {
    return { used: 0, tokens: 0 }
  }
}

/** 답에서 이번에 쓴 토큰 수 */
export function tokensOf(provider: 'gemini' | 'groq', data: unknown): number {
  const d = data as { usageMetadata?: { totalTokenCount?: number }; usage?: { total_tokens?: number } } | null
  const n = provider === 'gemini' ? d?.usageMetadata?.totalTokenCount : d?.usage?.total_tokens
  return typeof n === 'number' && n > 0 ? Math.round(n) : 0
}

interface AiCall {
  provider: 'gemini' | 'groq'
  /** Gemini 주소 뒤쪽 (models/…:generateContent) */
  path?: string
  method?: string
  payload?: unknown
}

function parseCall(body: unknown): AiCall | null {
  const b = body as Partial<AiCall> | null
  if (!b || (b.provider !== 'gemini' && b.provider !== 'groq')) return null
  return { provider: b.provider, path: typeof b.path === 'string' ? b.path : undefined, method: b.method === 'GET' ? 'GET' : 'POST', payload: b.payload }
}

/** /api/ai 한 번 처리 */
export async function handleAiProxy(req: ProxyRequest, env: AiProxyEnv, fetcher: typeof fetch = fetch, now = new Date()): Promise<ProxyReply> {
  const day = kstDay(now)
  if (req.method === 'GET') {
    const status: AiServerStatus = { gemini: Boolean(env.geminiKey), groq: Boolean(env.groqKey), limit: env.dailyLimit }
    if (req.authorization) {
      const who = await verifyUser(req.authorization, env, fetcher)
      if ('uid' in who) {
        const u = await readUsage(env, who, day, fetcher)
        status.today = { used: u.used, tokens: u.tokens, remaining: Math.max(0, env.dailyLimit - u.used) }
      }
    }
    return { status: 200, body: status }
  }
  if (req.method !== 'POST') return err(405, '지원하지 않는 요청이에요')

  const call = parseCall(req.body)
  if (!call) return err(400, '요청 형식이 맞지 않아요')
  const key = call.provider === 'gemini' ? env.geminiKey : env.groqKey
  if (!key) return err(503, call.provider === 'gemini' ? '서버에 Gemini 키가 아직 없어요' : '서버에 예비 AI(Groq) 키가 없어요')

  // 어디로 보낼지 정한다 (정해 둔 주소만)
  let url: string
  let method = 'POST'
  let counts = true
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (call.provider === 'gemini') {
    const path = call.path ?? ''
    if (call.method === 'GET' && GEMINI_LIST.test(path)) {
      method = 'GET'
      counts = false
    } else if (!GEMINI_GENERATE.test(path)) return err(400, '요청 형식이 맞지 않아요')
    url = GEMINI_BASE + path
    headers['x-goog-api-key'] = key
  } else {
    const model = (call.payload as { model?: unknown } | null)?.model
    if (typeof model !== 'string' || !GROQ_MODELS.includes(model)) return err(400, '요청 형식이 맞지 않아요')
    url = GROQ_ENDPOINT
    headers.authorization = `Bearer ${key}`
  }

  const who = await verifyUser(req.authorization, env, fetcher)
  if (!('uid' in who)) return who

  // 하루 횟수: 먼저 한 번 세고, 넘었으면 묻지 않는다
  let counted: { used: number; tokens: number } | null = null
  if (counts) {
    counted = await addUsage(env, who, day, 1, 0, fetcher)
    if (counted && counted.used > env.dailyLimit) {
      await addUsage(env, who, day, -1, 0, fetcher)
      const usage: AiUsage = { used: env.dailyLimit, limit: env.dailyLimit, remaining: 0, tokens: 0, tokensToday: counted.tokens, provider: call.provider }
      return err(429, `오늘 Tidy AI를 ${env.dailyLimit}번 다 썼어요. 내일 다시 쓸 수 있어요`, { usage, tidyLimit: true })
    }
  }

  let res: Response
  try {
    res = await fetcher(url, { method, headers, ...(method === 'POST' ? { body: JSON.stringify(call.payload ?? {}) } : {}) })
  } catch {
    if (counted) await addUsage(env, who, day, -1, 0, fetcher)
    return err(502, call.provider === 'gemini' ? 'Gemini에 연결하지 못했어요' : 'Groq에 연결하지 못했어요')
  }
  const data = (await res.json().catch(() => ({}))) as unknown
  if (!counts) return { status: 200, body: { status: res.status, data } }

  // 실패한 건(한도 초과, 서버 붐빔 등) 횟수에서 뺀다
  if (!res.ok) {
    if (counted) await addUsage(env, who, day, -1, 0, fetcher)
    return { status: 200, body: { status: res.status, data } }
  }
  const tokens = tokensOf(call.provider, data)
  const after = counted ? ((tokens ? await addUsage(env, who, day, 0, tokens, fetcher) : null) ?? counted) : null
  const providerRemaining = Number(res.headers.get('x-ratelimit-remaining-requests') ?? NaN)
  const usage: AiUsage | null = after
    ? {
        used: after.used,
        limit: env.dailyLimit,
        remaining: Math.max(0, env.dailyLimit - after.used),
        tokens,
        tokensToday: after.tokens,
        provider: call.provider,
        ...(Number.isFinite(providerRemaining) ? { providerRemaining } : {}),
      }
    : null
  return { status: 200, body: { status: res.status, data, usage } }
}

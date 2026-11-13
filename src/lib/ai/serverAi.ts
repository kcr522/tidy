/**
 * Tidy AI (앱 쪽): 키를 넣지 않아도 Tidy 서버(api/ai.ts)가 미리 넣어 둔 무료 Gemini·Groq 키로 대신 묻는다.
 * callGemini / callGroq 에 키 대신 SERVER_KEY 를 주면, 구글·Groq 로 가던 요청을 그대로 Tidy 서버로 돌려 보낸다.
 * 그래서 AI 를 쓰는 기능(한마디, AI 비서, 스크랩 요약, 음식 사진)은 따로 고치지 않아도 된다.
 * 답할 때마다 서버가 알려 주는 "오늘 남은 횟수·토큰"은 usage.ts 로 넘겨서 화면에 보여 준다.
 */
import { appFetch } from '../../platform/nativeFetch'
import { isNativeApp } from '../../platform/native'
import type { AiServerStatus, AiUsage } from './proxyServer'
import { reportAiUsage } from './usage'

/** 키 자리에 넣는 표시: "Tidy 서버의 키를 써 줘" */
export const SERVER_KEY = 'tidy-server'

/** 폰 앱은 웹 주소가 따로 없어서 배포한 사이트로 묻는다 */
const SITE = (import.meta.env.VITE_TIDY_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'

export const aiServerUrl = (): string => `${isNativeApp() ? SITE : ''}/api/ai`

/** Tidy 서버가 직접 막았을 때 (로그인 안 함, 오늘 횟수 다 씀, 서버에 키 없음 …). 키 탓이 아니라 이 글을 그대로 보여 준다 */
export class ServerAiError extends Error {
  readonly limit: boolean
  constructor(message: string, limit = false) {
    super(message)
    this.limit = limit
  }
}

/** 지금 로그인한 사람의 Firebase 로그인 토큰. 로그인하지 않았으면 null */
async function idToken(): Promise<string | null> {
  // 개발할 때 화면 확인용 (배포본에는 들어가지 않는다)
  if (import.meta.env.DEV && import.meta.env.VITE_AI_TEST_TOKEN) return import.meta.env.VITE_AI_TEST_TOKEN as string
  try {
    const { currentUser } = await import('../../platform/firebase')
    const user = await currentUser()
    return user ? await user.getIdToken() : null
  } catch {
    return null
  }
}

function target(url: string): { provider: 'gemini' | 'groq'; path?: string } | null {
  const g = url.match(/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/(.+)$/)
  if (g) return { provider: 'gemini', path: g[1] }
  if (url.startsWith('https://api.groq.com/')) return { provider: 'groq' }
  return null
}

/**
 * fetch 와 같은 모양: 구글·Groq 로 보내려던 요청을 Tidy 서버로 돌린다.
 * 서버는 { status, data, usage } 로 답하고, 여기서 원래 모양(status + data)의 Response 로 되돌린다.
 */
export function serverAiFetch(base: typeof fetch = appFetch()): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const to = target(url)
    if (!to) throw new ServerAiError('Tidy AI가 알 수 없는 요청이에요')
    const token = await idToken()
    if (!token) throw new ServerAiError('Tidy AI는 구글 로그인하면 쓸 수 있어요. 설정에서 로그인해 주세요')
    const payload = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined
    let res: Response
    try {
      res = await base(aiServerUrl(), {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...to, method: init?.method ?? 'POST', payload }),
        signal: init?.signal,
      })
    } catch (err) {
      if (init?.signal?.aborted) throw err
      throw new ServerAiError('Tidy 서버에 연결하지 못했어요. 인터넷을 확인해 주세요')
    }
    const body = (await res.json().catch(() => ({}))) as { tidyError?: string; tidyLimit?: boolean; usage?: AiUsage | null; status?: number; data?: unknown }
    if (body.usage) reportAiUsage(body.usage)
    if (body.tidyError || typeof body.status !== 'number') throw new ServerAiError(body.tidyError ?? 'Tidy 서버에서 답을 받지 못했어요', Boolean(body.tidyLimit))
    return new Response(JSON.stringify(body.data ?? {}), { status: body.status, headers: { 'content-type': 'application/json' } })
  }
}

/** 서버에 키가 있는지와 (로그인했으면) 오늘 사용량 */
export async function fetchAiServerStatus(signal?: AbortSignal): Promise<AiServerStatus | null> {
  try {
    const token = await idToken()
    const res = await appFetch()(aiServerUrl(), { headers: token ? { authorization: `Bearer ${token}` } : {}, signal })
    if (!res.ok) return null
    return (await res.json()) as AiServerStatus
  } catch {
    return null
  }
}

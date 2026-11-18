/**
 * 관리자 페이지 (앱 쪽): Tidy 서버(api/admin.ts)에 내 로그인 토큰을 보내서 묻는다.
 * 관리자인지는 서버가 정한다. 앱은 서버가 "관리자"라고 한 사람에게만 설정에 칸을 보여 줄 뿐이다.
 */
import { appFetch } from '../../platform/nativeFetch'
import { isNativeApp } from '../../platform/native'
import type { AdminReport } from './adminServer'

const SITE = (import.meta.env.VITE_TIDY_SERVER as string | undefined) || 'https://tidy-gules.vercel.app'
const adminUrl = (q = '') => `${isNativeApp() ? SITE : ''}/api/admin${q}`

export class AdminError extends Error {
  readonly status: number
  /** 서버에 넣어야 할 환경 변수 이름 (설정 안내용) */
  readonly setup?: string
  constructor(message: string, status: number, setup?: string) {
    super(message)
    this.status = status
    this.setup = setup
  }
}

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

const CHECK_KEY = 'tidy.isAdmin'

/** 지금 로그인한 사람이 관리자인지 (한 번 확인하면 이 창을 닫을 때까지 기억) */
export async function checkAdmin(uid: string): Promise<boolean> {
  try {
    const saved = sessionStorage.getItem(CHECK_KEY)
    if (saved?.startsWith(`${uid}:`)) return saved.endsWith(':1')
  } catch {
    /* 기억 못 해도 괜찮다 */
  }
  const token = await idToken()
  if (!token) return false
  try {
    const res = await appFetch()(adminUrl('?check=1'), { headers: { authorization: `Bearer ${token}` } })
    const ok = res.ok && ((await res.json()) as { admin?: boolean }).admin === true
    try {
      sessionStorage.setItem(CHECK_KEY, `${uid}:${ok ? 1 : 0}`)
    } catch {
      /* 기억 못 해도 괜찮다 */
    }
    return ok
  } catch {
    return false
  }
}

export async function fetchAdminReport(): Promise<AdminReport> {
  const token = await idToken()
  if (!token) throw new AdminError('구글로 로그인해야 볼 수 있어요', 401)
  let res: Response
  try {
    res = await appFetch()(adminUrl(), { headers: { authorization: `Bearer ${token}` } })
  } catch {
    throw new AdminError('Tidy 서버에 연결하지 못했어요. 인터넷을 확인해 주세요', 0)
  }
  const body = (await res.json().catch(() => ({}))) as AdminReport & { error?: string; setup?: string }
  if (!res.ok || body.error) throw new AdminError(body.error ?? `정보를 받지 못했어요 (${res.status})`, res.status, body.setup)
  return body
}

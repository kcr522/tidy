import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './native'

/** Tidy 가 만든 캘린더만 다룰 수 있는 권한 (사용자의 다른 캘린더는 못 본다) + 이메일 */
export const CALENDAR_SCOPES = ['https://www.googleapis.com/auth/calendar.app.created', 'email']

/** 웹에서 쓰는 구글 OAuth 클라이언트 id (비밀 값 아님). 없으면 웹에서는 연결할 수 없다 */
export const WEB_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ?? ''

export class GoogleAuthError extends Error {
  /** 사용자가 창을 닫았다 */
  cancelled: boolean
  constructor(message: string, cancelled = false) {
    super(message)
    this.cancelled = cancelled
  }
}

interface GoogleAuthPlugin {
  authorize(o: { scopes: string[]; interactive: boolean }): Promise<{ accessToken?: string; needsConsent?: boolean; cancelled?: boolean }>
}
const NativeAuth = registerPlugin<GoogleAuthPlugin>('GoogleAuth')

let cached: { token: string; until: number } | null = null

/** 웹에서 한 번 받은 토큰은 1시간쯤 쓸 수 있다 (만료 1분 전까지) */
function fresh(): string | null {
  return cached && cached.until > Date.now() + 60_000 ? cached.token : null
}

/**
 * 구글 접근 토큰.
 * - interactive=false: 창을 띄우지 않는다. 폰 앱은 이미 허락했으면 바로 받고, 웹은 이번에 받아 둔 토큰만 쓴다. 없으면 null
 * - interactive=true: 필요하면 구글 계정 고르기/허락 창을 띄운다 (버튼을 눌렀을 때만)
 */
export async function getGoogleToken(interactive: boolean): Promise<string | null> {
  const hit = fresh()
  if (hit) return hit
  if (isNativeApp()) {
    let r
    try {
      r = await NativeAuth.authorize({ scopes: CALENDAR_SCOPES, interactive })
    } catch (err) {
      throw new GoogleAuthError(err instanceof Error ? err.message : '구글 로그인 오류')
    }
    if (r.cancelled) throw new GoogleAuthError('구글 로그인을 취소했어요', true)
    if (!r.accessToken) return null
    // 폰 앱은 플레이 서비스가 토큰을 관리해서, 여기서는 50분만 기억한다
    cached = { token: r.accessToken, until: Date.now() + 50 * 60_000 }
    return r.accessToken
  }
  if (!interactive) return null
  return webToken()
}

export function forgetGoogleToken() {
  cached = null
}

/** 구글이 이 토큰을 더는 받지 않을 때 (401) */
export function dropGoogleToken(token: string) {
  if (cached?.token === token) cached = null
}

// ---- 웹: Google Identity Services (accounts.google.com/gsi/client) ----

interface TokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
}
interface GsiOAuth2 {
  initTokenClient(c: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { type: string }) => void }): { requestAccessToken(o?: { prompt?: string }): void }
}
declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GsiOAuth2 } }
  }
}

let gsi: Promise<GsiOAuth2> | null = null
function loadGsi(): Promise<GsiOAuth2> {
  gsi ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new GoogleAuthError('구글 로그인을 불러오지 못했어요')))
    s.onerror = () => {
      gsi = null
      reject(new GoogleAuthError('구글 로그인을 불러오지 못했어요. 인터넷을 확인해 주세요'))
    }
    document.head.appendChild(s)
  })
  return gsi
}

async function webToken(): Promise<string> {
  if (!WEB_CLIENT_ID) throw new GoogleAuthError('웹에서는 아직 구글 연결을 쓸 수 없어요. 갤럭시 앱에서 연결해 주세요')
  const oauth2 = await loadGsi()
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: WEB_CLIENT_ID,
      scope: CALENDAR_SCOPES.join(' '),
      callback: (r) => {
        if (!r.access_token) return reject(new GoogleAuthError(r.error === 'access_denied' ? '구글에서 허락하지 않았어요' : '구글 로그인 오류', r.error === 'access_denied'))
        cached = { token: r.access_token, until: Date.now() + (r.expires_in ?? 3600) * 1000 }
        resolve(r.access_token)
      },
      error_callback: (e) => reject(new GoogleAuthError(e.type === 'popup_closed' ? '구글 로그인을 취소했어요' : '구글 로그인 창을 열지 못했어요', e.type === 'popup_closed')),
    })
    client.requestAccessToken({ prompt: '' })
  })
}

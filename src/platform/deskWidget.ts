/**
 * 컴퓨터용 'Tidy 달력' 위젯 앱 (desktop-widget/, Tauri) 안에서 열렸는지.
 * 위젯 앱은 /widget?desk=1 을 테두리 없는 투명한 창에 띄운다.
 */

const KEY = 'tidy-desk-widget'

type TauriInternals = { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> }

export function isDeskWidget(): boolean {
  if (typeof window === 'undefined') return false
  if (new URLSearchParams(window.location.search).has('desk')) {
    try {
      sessionStorage.setItem(KEY, '1')
    } catch {
      /* 무시 */
    }
    return true
  }
  try {
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

const tauri = (): TauriInternals | undefined => (window as unknown as { __TAURI_INTERNALS__?: TauriInternals }).__TAURI_INTERNALS__

/** 위젯 창 닫기 (앱이 꺼진다. 다음에 컴퓨터를 켜면 다시 뜬다) */
export function closeDeskWidget(): void {
  void tauri()?.invoke('plugin:window|close', { label: 'main' }).catch(() => undefined)
}

/** 컴퓨터 위젯 바탕 투명도 (%). 폰 위젯 투명도와 따로 이 위젯 앱 안에 저장한다 */
const OPACITY_KEY = 'tidy-desk-opacity'
export const DESK_DEFAULT_OPACITY = 85

export function loadDeskOpacity(): number {
  try {
    const n = Number(localStorage.getItem(OPACITY_KEY))
    return localStorage.getItem(OPACITY_KEY) != null && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : DESK_DEFAULT_OPACITY
  } catch {
    return DESK_DEFAULT_OPACITY
  }
}

export function saveDeskOpacity(n: number): void {
  try {
    localStorage.setItem(OPACITY_KEY, String(n))
  } catch {
    /* 무시 */
  }
}

/**
 * 위젯 앱에서 구글 로그인: 앱 안에서는 구글 로그인을 할 수 없어서 기본 브라우저로 /widget-login 을 연다.
 * 브라우저에서 로그인하면 tidy-widget://login#<ID 토큰> 링크로 앱이 받아 window.__tidyDeskLogin(토큰)을 부른다.
 */
export function waitForDeskLogin(timeoutMs = 10 * 60_000): Promise<string | null> {
  return new Promise((resolve) => {
    const w = window as unknown as { __tidyDeskLogin?: (t: string) => void }
    const timer = window.setTimeout(() => done(null), timeoutMs)
    function done(t: string | null) {
      window.clearTimeout(timer)
      delete w.__tidyDeskLogin
      resolve(t)
    }
    w.__tidyDeskLogin = (t: string) => done(t)
    window.open(`${window.location.origin}/widget-login`, '_blank')
  })
}

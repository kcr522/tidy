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

/** 위젯 창 크기 한계 (화면 기준 px). 최소는 desktop-widget/src/main.rs 의 min_inner_size 와 같다 */
export const DESK_MIN_SIZE = { width: 260, height: 240 }
export const DESK_MAX_SIZE = { width: 1400, height: 1400 }

/** − / + 버튼 한 번에 바뀌는 창 크기. 가로세로 비율은 그대로 둔다 */
export function nextDeskSize(width: number, height: number, step: 1 | -1): { width: number; height: number } {
  const f = step > 0 ? 1.15 : 1 / 1.15
  const max = Math.min(DESK_MAX_SIZE.width / width, DESK_MAX_SIZE.height / height)
  const min = Math.max(DESK_MIN_SIZE.width / width, DESK_MIN_SIZE.height / height)
  const k = Math.min(max, Math.max(min, f))
  return { width: Math.round(width * k), height: Math.round(height * k) }
}

/**
 * 위젯 창 크기 바꾸기. 크기는 위젯 앱이 기억해서 다음에 켤 때도 그대로다 (tauri-plugin-window-state).
 * 예전에 받은 위젯 앱은 이 권한이 없어서 false 를 돌려준다 (새로 받아야 한다).
 */
export async function resizeDeskWidget(step: 1 | -1): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  const value = { Logical: nextDeskSize(window.innerWidth, window.innerHeight, step) }
  return t.invoke('plugin:window|set_size', { label: 'main', value }).then(
    () => true,
    () => false,
  )
}

/** 오른쪽 아래 손잡이를 끌어 창 크기를 마음대로 바꾸기 */
export async function startDeskResize(): Promise<boolean> {
  const t = tauri()
  if (!t) return false
  return t.invoke('plugin:window|start_resize_dragging', { label: 'main', value: 'SouthEast' }).then(
    () => true,
    () => false,
  )
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

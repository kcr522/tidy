/**
 * 화면 밝기: 라이트 / 다크 / 자동 (사용자 요청 2026-11-10)
 * - 고른 값은 이 기기에 저장한다 (localStorage, 기본값: 자동)
 * - 자동이면 폰·컴퓨터 설정(prefers-color-scheme)을 따라가고, 설정이 바뀌면 바로 바뀐다
 * - <html>에 .dark 클래스를 붙이면 index.css의 다크 색이 켜진다
 */

export type ColorMode = 'light' | 'dark' | 'auto'
export const COLOR_MODES: ColorMode[] = ['auto', 'light', 'dark']

const KEY = 'tidy-color-mode'
const media = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null)

export function getColorMode(): ColorMode {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'light' || v === 'dark' || v === 'auto') return v
  } catch {
    // 저장소를 못 쓰는 환경(사생활 보호 모드 등)이면 자동
  }
  return 'auto'
}

export function resolveDark(mode: ColorMode, systemDark = media()?.matches ?? false): boolean {
  return mode === 'dark' || (mode === 'auto' && systemDark)
}

type Listener = (dark: boolean) => void
const listeners = new Set<Listener>()

/** 다크인지 바뀔 때마다 불린다 (그라데이션 색을 다시 계산할 때 쓴다) */
export function onDarkChange(fn: Listener): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function isDark(): boolean {
  return document.documentElement.classList.contains('dark')
}

function applyDark(dark: boolean) {
  const root = document.documentElement
  const changed = root.classList.contains('dark') !== dark
  root.classList.toggle('dark', dark)
  root.style.colorScheme = dark ? 'dark' : 'light'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#101217' : '#f2f4f6')
  if (changed) listeners.forEach((fn) => fn(dark))
}

export function setColorMode(mode: ColorMode) {
  try {
    localStorage.setItem(KEY, mode)
  } catch {
    // 저장 못 해도 이번에는 바꿔 준다
  }
  applyDark(resolveDark(mode))
  window.dispatchEvent(new CustomEvent('tidy:color-mode', { detail: mode }))
}

/** 앱을 켤 때 한 번: 저장된 값을 적용하고, 자동일 때 시스템 설정 변화를 따라간다 */
export function initColorMode() {
  applyDark(resolveDark(getColorMode()))
  media()?.addEventListener?.('change', (e) => {
    if (getColorMode() === 'auto') applyDark(e.matches)
  })
}

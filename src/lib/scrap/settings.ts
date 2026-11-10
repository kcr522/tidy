import { useSyncExternalStore } from 'react'

// 스크랩 설정은 이 기기에만 저장한다

const ASK_KEY = 'tidy.scrap.askCapture'
const LAST_CAT_KEY = 'tidy.scrap.lastCategory.'
const EVENT = 'tidy-scrap-settings'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    // 저장이 막힌 브라우저에서는 이번 실행 동안만
  }
  window.dispatchEvent(new Event(EVENT))
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

/** 새 링크를 저장할 때 "캡처본도 같이 저장할까요?"를 물어볼지 (기본: 묻는다) */
export const askCaptureEnabled = () => read(ASK_KEY) !== 'off'
export const setAskCapture = (on: boolean) => write(ASK_KEY, on ? null : 'off')

export function useAskCapture(): [boolean, (on: boolean) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(ASK_KEY))
  return [raw !== 'off', setAskCapture]
}

/** 인스타그램 링크는 지난번에 고른 카테고리로 … 처럼 어디서 온 링크인지에 따라 마지막 카테고리를 기억한다 */
export function lastCategoryFor(source: string): number | null {
  const v = Number(read(LAST_CAT_KEY + source))
  return Number.isInteger(v) && v > 0 ? v : null
}

export function rememberCategory(source: string, categoryId: number | null) {
  write(LAST_CAT_KEY + source, categoryId == null ? null : String(categoryId))
}

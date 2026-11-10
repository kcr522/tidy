import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { AiSettings } from './engines'
import { isFeedbackMode, type FeedbackMode } from './prompts'

// AI 설정과 고른 모드는 이 기기에만 저장한다 (백업 파일에는 들어가지 않는다: 키가 새지 않게)

const SETTINGS_KEY = 'tidy.ai.settings'
const MODE_KEY = 'tidy.ai.mode'
const LAST_KEY = 'tidy.ai.last'
const EVENT = 'tidy-ai-change'

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
    // 저장이 막힌 브라우저(사생활 보호 모드 등)에서는 이번 실행 동안만 유지
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

function parseSettings(raw: string | null): AiSettings {
  try {
    const v = JSON.parse(raw ?? 'null') as Partial<AiSettings> | null
    if (v && (v.engine === 'local' || v.engine === 'server' || v.engine === 'key')) return { ...v, engine: v.engine }
  } catch {
    // 깨진 값이면 기본으로
  }
  return { engine: 'local' }
}

export const loadAiSettings = () => parseSettings(read(SETTINGS_KEY))

export function saveAiSettings(s: AiSettings) {
  write(SETTINGS_KEY, JSON.stringify(s))
  write(LAST_KEY, null)
}

export function useAiSettings(): [AiSettings, (s: AiSettings) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(SETTINGS_KEY))
  const settings = useMemo(() => parseSettings(raw), [raw])
  return [settings, saveAiSettings]
}

export function useFeedbackMode(): [FeedbackMode, (m: FeedbackMode) => void] {
  const raw = useSyncExternalStore(subscribe, () => read(MODE_KEY))
  const set = useCallback((m: FeedbackMode) => write(MODE_KEY, m), [])
  return [isFeedbackMode(raw) ? raw : 'feedback', set]
}

/** 모드별로 마지막에 받은 한마디: 같은 내역이면 다시 묻지 않는다 (API 비용 절약) */
export interface CachedFeedback {
  key: string
  engine: string
  text: string
}

type Cache = Partial<Record<FeedbackMode, CachedFeedback>>

function loadCache(): Cache {
  try {
    return (JSON.parse(read(LAST_KEY) ?? 'null') as Cache | null) ?? {}
  } catch {
    return {}
  }
}

export function cachedFeedback(mode: FeedbackMode): CachedFeedback | null {
  return loadCache()[mode] ?? null
}

export function saveCachedFeedback(mode: FeedbackMode, v: CachedFeedback) {
  try {
    localStorage.setItem(LAST_KEY, JSON.stringify({ ...loadCache(), [mode]: v }))
  } catch {
    // 무시
  }
}

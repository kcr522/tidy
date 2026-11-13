import { useSyncExternalStore } from 'react'
import type { AiUsage } from './proxyServer'

/** Tidy AI 를 쓸 때마다 서버가 알려 준 마지막 사용량 (앱을 켜 둔 동안만 기억) */
let last: { usage: AiUsage; at: number } | null = null
const listeners = new Set<() => void>()

export function reportAiUsage(usage: AiUsage) {
  last = { usage, at: Date.now() }
  for (const l of listeners) l()
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** 마지막 사용량. 아직 안 썼으면 null */
export function useLastAiUsage() {
  return useSyncExternalStore(subscribe, () => last)
}

/** "오늘 38번 남았어요 (50번 중) · 이번 1,203토큰" */
export function usageLine(u: AiUsage): string {
  const parts = [`오늘 ${u.remaining}번 남았어요 (${u.limit}번 중)`]
  if (u.tokens) parts.push(`이번 ${u.tokens.toLocaleString('ko-KR')}토큰`)
  return parts.join(' · ')
}

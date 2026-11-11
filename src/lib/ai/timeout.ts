/**
 * AI 가 너무 오래 걸리면 멈추고 다음 방법(예비 AI → 기본 모드)으로 넘어가게 하는 시간 제한.
 * 사용자가 멈춘 것(signal)과 시간이 다 된 것을 구분한다.
 */
export class AiTimeoutError extends Error {}

export interface Deadline {
  /** fetch 에 넘길 신호: 사용자가 멈추거나 시간이 다 되면 멈춘다 */
  signal: AbortSignal
  /** 시간이 다 돼서 멈췄다 (사용자가 멈춘 게 아니라) */
  timedOut: () => boolean
  /** 다 썼으면 타이머를 치운다 */
  done: () => void
}

export function deadline(ms: number, signal?: AbortSignal): Deadline {
  const ctrl = new AbortController()
  let late = false
  const timer = setTimeout(() => {
    late = true
    ctrl.abort()
  }, ms)
  const onAbort = () => ctrl.abort()
  if (signal?.aborted) ctrl.abort()
  else signal?.addEventListener('abort', onAbort, { once: true })
  return {
    signal: ctrl.signal,
    timedOut: () => late && !signal?.aborted,
    done: () => {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    },
  }
}

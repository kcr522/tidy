/**
 * 시작 화면(사진)이 끝났는지 알려 준다.
 * 잠금 화면이 지문 창을 시작 화면 위에 띄우지 않고, 사진이 지나간 뒤에 띄우려고 쓴다.
 */
const EVENT = 'tidy:splash-done'
let finished = false

export function markSplashDone() {
  if (finished) return
  finished = true
  window.dispatchEvent(new Event(EVENT))
}

/** 시작 화면이 끝나면(이미 끝났으면 바로) fn 을 부른다. 돌려준 함수로 취소 */
export function afterSplash(fn: () => void): () => void {
  if (finished) {
    fn()
    return () => {}
  }
  const on = () => fn()
  window.addEventListener(EVENT, on, { once: true })
  return () => window.removeEventListener(EVENT, on)
}

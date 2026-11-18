/**
 * 처음 쓸 때 나오는 사용 가이드.
 * 한 번 보거나 건너뛰면 이 기기에 표시해 두고 다시 띄우지 않는다. 설정 > 사용 가이드에서 다시 볼 수 있다.
 */
const KEY = 'tidy.guideSeen'
const EVENT = 'tidy:open-guide'

export function guideSeen(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return true
  }
}

export function markGuideSeen() {
  try {
    localStorage.setItem(KEY, '1')
  } catch {
    // 저장이 막힌 기기면 다음에 또 나올 뿐이다
  }
}

/** 설정 등에서 가이드를 다시 연다 */
export function openGuide() {
  window.dispatchEvent(new Event(EVENT))
}

/** 다시 열어 달라는 신호를 듣는다. 돌려준 함수로 그만 듣기 */
export function onOpenGuide(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

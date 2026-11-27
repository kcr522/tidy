/** 위쪽 머리줄의 ⋮ 버튼 → 가계부 화면에 "메뉴 열어 줘" 알리기 */
const EVENT = 'tidy:money-menu'

export function openMoneyMenu() {
  window.dispatchEvent(new Event(EVENT))
}

/** 가계부 화면이 듣는다. 돌려준 함수로 그만 듣는다 */
export function onMoneyMenu(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

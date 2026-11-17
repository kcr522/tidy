// 결제 알림 → 가계부: 기록하지 않을 알림 거르기 (사용자가 설정에서 정한다)
// 폰 쪽(PayNotifyService.java)에도 같은 규칙을 보내서, 걸리는 알림은 모으지도 "기록할까요?" 알림을 띄우지도 않는다
import type { PaymentGuess } from './ai/assistant'
import type { PayNotification } from './payNotify'

export interface PayFilter {
  /** 가게 이름이나 알림 글에 이 낱말이 있으면 빼기 (띄어쓰기·대소문자 무시) */
  words: string[]
  /** 이 앱 알림은 빼기 */
  apps: { pkg: string; name: string }[]
  /** 이 금액보다 적으면 빼기 (0 = 끔) */
  minAmount: number
  /** 입금 알림은 빼기 */
  skipDeposit: boolean
}

export const EMPTY_FILTER: PayFilter = { words: [], apps: [], minAmount: 0, skipDeposit: false }

const KEY = 'tidy:pay-notify-filter'
const EVENT = 'tidy:pay-notify-filter'

export function loadPayFilter(): PayFilter {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<PayFilter> | null
    if (!v) return EMPTY_FILTER
    return {
      words: Array.isArray(v.words) ? v.words.filter((w) => typeof w === 'string' && w.trim()) : [],
      apps: Array.isArray(v.apps) ? v.apps.filter((a) => a && typeof a.pkg === 'string') : [],
      minAmount: typeof v.minAmount === 'number' && v.minAmount > 0 ? Math.floor(v.minAmount) : 0,
      skipDeposit: v.skipDeposit === true,
    }
  } catch {
    return EMPTY_FILTER
  }
}

export function savePayFilter(f: PayFilter) {
  try {
    localStorage.setItem(KEY, JSON.stringify(f))
  } catch {
    /* 저장 못 해도 지금 화면에는 적용 */
  }
  window.dispatchEvent(new Event(EVENT))
}

export function onPayFilterChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb)
  return () => window.removeEventListener(EVENT, cb)
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

export function addWord(f: PayFilter, word: string): PayFilter {
  const w = word.trim().slice(0, 30)
  if (!w || f.words.some((x) => norm(x) === norm(w))) return f
  return { ...f, words: [...f.words, w] }
}

export function addApp(f: PayFilter, pkg: string, name: string): PayFilter {
  if (!pkg || f.apps.some((a) => a.pkg === pkg)) return f
  return { ...f, apps: [...f.apps, { pkg, name: name || pkg }] }
}

/** 입금 알림 (출금·승인·결제가 아닌) — PayNotifyService.java 의 isDeposit 과 같은 규칙 */
export const isDeposit = (text: string) => /입금/.test(text) && !/출금|승인|결제/.test(text)

/** 이 알림을 뺄 이유 (빼지 않으면 null) */
export function blockReason(f: PayFilter, n: PayNotification, g: PaymentGuess): string | null {
  if (f.apps.some((a) => a.pkg === n.pkg)) return '앱'
  const all = norm(`${n.title} ${n.text} ${g.merchant}`)
  const word = f.words.find((w) => norm(w) && all.includes(norm(w)))
  if (word) return `낱말 '${word}'`
  if (f.minAmount > 0 && g.amount < f.minAmount) return '금액'
  if (f.skipDeposit && isDeposit(`${n.title} ${n.text}`)) return '입금'
  return null
}

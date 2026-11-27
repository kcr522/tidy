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

export function removeApp(f: PayFilter, pkg: string): PayFilter {
  return { ...f, apps: f.apps.filter((a) => a.pkg !== pkg) }
}

/** 뺄 앱 고르기 목록 한 줄 */
export interface PayAppRow {
  pkg: string
  name: string
  icon?: string
  /** 마지막 결제 알림 시각 (ms, 온 적 없으면 0) */
  seen: number
  /** 그동안 온 결제 알림 수 */
  count: number
  blocked: boolean
}

/**
 * 뺄 앱 고르기 목록 만들기: 폰이 알려 준 앱(옛 앱이면 null) + 모아 둔 알림을 보낸 앱 + 이미 뺀 앱.
 * 결제 알림이 온 앱이 먼저(많이 온 순), 나머지는 이름 순.
 */
export function payAppRows(
  f: PayFilter,
  phoneApps: { pkg: string; name: string; icon?: string; seen?: number; count?: number }[] | null,
  notifications: Pick<PayNotification, 'pkg' | 'app' | 'postedAt'>[],
): PayAppRow[] {
  const rows = new Map<string, PayAppRow>()
  const blocked = new Set(f.apps.map((a) => a.pkg))
  const row = (pkg: string, name: string) => {
    let r = rows.get(pkg)
    if (!r) {
      r = { pkg, name: name || pkg, seen: 0, count: 0, blocked: blocked.has(pkg) }
      rows.set(pkg, r)
    } else if (r.name === pkg && name) r.name = name
    return r
  }
  for (const a of phoneApps ?? []) {
    if (!a?.pkg) continue
    const r = row(a.pkg, a.name)
    if (a.icon) r.icon = a.icon
    r.seen = Math.max(r.seen, a.seen ?? 0)
    r.count = Math.max(r.count, a.count ?? 0)
  }
  // 옛 앱은 폰이 세어 주지 않으니 모아 둔 알림으로 센다
  const counted = new Map<string, number>()
  for (const n of notifications) {
    if (!n.pkg) continue
    const r = row(n.pkg, n.app)
    r.seen = Math.max(r.seen, n.postedAt || 0)
    counted.set(n.pkg, (counted.get(n.pkg) ?? 0) + 1)
  }
  for (const [pkg, c] of counted) {
    const r = rows.get(pkg)!
    r.count = Math.max(r.count, c)
  }
  for (const a of f.apps) row(a.pkg, a.name)
  return [...rows.values()].sort((a, b) => b.count - a.count || b.seen - a.seen || a.name.localeCompare(b.name, 'ko'))
}

// 이전 기록에서 배우기: 같은 가게는 늘 고르던 카테고리·결제 수단으로, 이미 있는 내역은 다시 넣지 않게
import type { CalendarEvent, MerchantAlias, PayMethod, Transaction } from '../../db/types'
import type { TransactionInput } from '../../repositories/transactionRepo'
import { eventMemo, type AssistantContext, type EventGuess, type PaymentGuess } from '../ai/assistant'
import { categoriesFor } from '../categories'
import { matchMerchant, normalizeName } from '../merchants'
import { methodLabel, pickPayMethod } from '../payMethods'

/** 내역의 실제 가게 이름 (알려 준 이름이 있으면 그 이름) */
const shownName = (t: Pick<Transaction, 'memo'>) => t.memo.trim()

interface MerchantStat {
  name: string
  count: number
  /** 카테고리별 횟수 */
  categories: Map<string, number>
  accounts: Map<string, number>
  type: Transaction['type']
}

const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

function stats(transactions: Transaction[]): Map<string, MerchantStat> {
  const out = new Map<string, MerchantStat>()
  for (const t of transactions) {
    const names = new Set([normalizeName(shownName(t)), t.originalMemo ? normalizeName(t.originalMemo) : ''].filter(Boolean))
    for (const k of names) {
      const s = out.get(k) ?? { name: shownName(t), count: 0, categories: new Map(), accounts: new Map(), type: t.type }
      s.count++
      s.categories.set(t.category, (s.categories.get(t.category) ?? 0) + 1)
      if (t.account?.trim()) s.accounts.set(t.account.trim(), (s.accounts.get(t.account.trim()) ?? 0) + 1)
      out.set(k, s)
    }
  }
  return out
}

/** AI에게 보낼 이전 기록 요약 (자주 간 가게 40곳, 알려 준 이름 30개, 결제 수단 10개) */
export function buildContext(transactions: Transaction[], aliases: MerchantAlias[]): AssistantContext {
  const byName = new Map<string, MerchantStat>()
  for (const [k, s] of stats(transactions)) if (normalizeName(s.name) === k) byName.set(k, s)
  const merchants = [...byName.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 40)
    .map((s) => ({ name: s.name, category: top(s.categories)!, ...(top(s.accounts) ? { account: top(s.accounts) } : {}) }))
  const accounts = new Map<string, number>()
  for (const t of transactions) if (t.account?.trim()) accounts.set(t.account.trim(), (accounts.get(t.account.trim()) ?? 0) + 1)
  return {
    aliases: aliases.slice(0, 30).map((a) => ({ original: a.original, name: a.name })),
    merchants,
    accounts: [...accounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([a]) => a),
  }
}

/** 대화창 카드에 보일 결제 내역 하나 */
export interface PaymentDraft {
  input: TransactionInput
  /** 화면에 보일 가게 이름 (알려 준 이름, 브랜드 지점 이름) */
  display: string
  /** 이미 가계부에 있는 내역 */
  duplicate: boolean
  /** 이전 기록을 보고 맞춘 것 (예: "카테고리: 전에 고른 식비") */
  learned: string[]
}

/** 결제 수단 이름을 전에 쓰던 글자로 맞춘다 ("신한 카드" → "신한카드") */
export function matchAccount(account: string | null, used: string[]): string | undefined {
  const a = account?.trim()
  if (!a) return undefined
  const n = normalizeName(a)
  const same = used.find((u) => normalizeName(u) === n) ?? used.find((u) => normalizeName(u).length >= 2 && (n.includes(normalizeName(u)) || normalizeName(u).includes(n)))
  return same ?? a
}

/** AI가 찾은 결제 내역을 이전 기록에 맞춰 다듬고, 이미 있는 내역을 표시한다 */
export function refinePayments(payments: PaymentGuess[], transactions: Transaction[], aliases: MerchantAlias[], methods: PayMethod[] = []): PaymentDraft[] {
  const st = stats(transactions)
  const aliasMap = new Map(aliases.map((a) => [a.raw, a.name]))
  const used = buildContext(transactions, []).accounts
  const seen: TransactionInput[] = []

  return payments.map((p) => {
    const raw = normalizeName(p.merchant)
    const alias = aliasMap.get(raw)
    const brand = matchMerchant(alias ?? p.merchant)
    const display = alias ?? brand?.display ?? p.merchant
    const hist = st.get(normalizeName(display)) ?? st.get(raw)
    const learned: string[] = []
    if (alias) learned.push(`전에 알려 준 이름: ${alias}`)

    const cats = categoriesFor(p.type)
    let category = p.category
    const histCat = hist && hist.type === p.type ? top(hist.categories) : undefined
    if (histCat && cats.includes(histCat)) {
      if (histCat !== category) learned.push(`카테고리: 전에 고른 ${histCat}`)
      category = histCat
    } else if (p.type === 'EXPENSE' && brand && cats.includes(brand.brand.category) && category === '기타') {
      category = brand.brand.category
    }

    // 내 카드 · 계좌에 등록한 것 (끝 4자리 · 같은 카드사) → 늘 쓰던 이름 → 알림에 적힌 이름
    const mine = pickPayMethod(methods, p.account, p.last4)
    if (mine) learned.push(`내 카드 · 계좌: ${methodLabel(mine)}`)
    let account = mine?.name ?? matchAccount(p.account, [...methods.map((m) => m.name), ...used])
    if (!account && hist && top(hist.accounts)) {
      account = top(hist.accounts)
      learned.push(`결제 수단: 늘 쓰던 ${account}`)
    }

    const input: TransactionInput = {
      type: p.type,
      amount: p.amount,
      category,
      date: p.date,
      memo: p.merchant.slice(0, 200),
      ...(p.time ? { time: p.time } : {}),
      ...(account ? { account } : {}),
    }
    const names = new Set([raw, normalizeName(display)])
    const sameAs = (t: Pick<Transaction, 'type' | 'amount' | 'date' | 'memo' | 'time'> & { originalMemo?: string }) =>
      t.type === input.type &&
      t.amount === input.amount &&
      t.date === input.date &&
      (names.has(normalizeName(t.memo)) || (!!t.originalMemo && names.has(normalizeName(t.originalMemo))) || (!!t.time && t.time === input.time))
    const duplicate = transactions.some(sameAs) || seen.some((s) => sameAs(s))
    seen.push(input)
    return { input, display, duplicate, learned }
  })
}

export interface EventDraft {
  input: { title: string; startDate: string; endDate: string; color: CalendarEvent['color']; memo: string }
  duplicate: boolean
}

const EVENT_PALETTE: CalendarEvent['color'][] = ['pink', 'blue', 'green', 'orange', 'purple']

/** AI가 찾은 일정에 색을 정하고, 이미 캘린더에 있는 일정을 표시한다 */
export function refineEvents(events: EventGuess[], existing: CalendarEvent[]): EventDraft[] {
  return events.map((e, i) => ({
    input: { title: e.title, startDate: e.startDate, endDate: e.endDate, color: EVENT_PALETTE[i % EVENT_PALETTE.length], memo: eventMemo(e) },
    duplicate: existing.some((x) => x.startDate === e.startDate && normalizeName(x.title) === normalizeName(e.title)),
  }))
}

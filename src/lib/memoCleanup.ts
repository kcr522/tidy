// 예전에 결제 알림 · 은행 화면에서 자동으로 들어간 가계부 이름 정리: "가맹점: GS25 운남점" → "GS25 운남점"
// 새 알림은 readPayText 가 출금처만 남기지만(onlyName), 그 전에 저장된 내역은 이름에 군더더기가 남아 있다.
// 사용자가 직접 쓴 메모는 건드리지 않게, 알림에서만 나오는 흔적이 있을 때만 고친다.
import type { Transaction } from '../db/types'
import { normalizeName } from './merchants'
import { onlyName } from './payNotifyText'

/** 알림 글에서만 나오는 흔적: 칸 이름, (주), 카드 · 계좌 번호 괄호, "결제가 완료되었습니다" 같은 말끝 */
const SIGNS = [
  /^\s*(이용\s*)?(가맹점(\s*명)?|사용처|결제처|거래처|출금처|입금처|상호(\s*명)?|받는\s*(분|사람|곳)|보낸\s*(분|사람))\s*[:：]?\s/,
  /\(\s*(주|유)\s*\)|㈜|주식\s*회사/,
  /\(\s*[\d*\s-]{3,}\s*\)|\([^()]*(카드|체크|은행|뱅크|페이)[^()]*\d[^()]*\)/,
  /(결제|승인|이체|송금|출금|입금)?\s*(가|이)?\s*(완료\s*)?(되었습니다|되었어요|됐어요|했어요|했습니다|하였습니다)[.!]?\s*$|에서\s*$/,
]
/** 사용자가 쓴 듯한 괄호 ("커피 (2잔)") 가 있으면 통째로 건드리지 않는다 */
const OWN_PAREN = /\((?![^()]*(카드|체크|은행|뱅크|페이))[^()]*\d[^()]*[가-힣][^()]*\)/

const hasName = (t: string) => /[가-힣a-zA-Z]{2,}/.test(t.replace(/\s/g, ''))

/** 고칠 이름. 고칠 게 없거나 사용자가 쓴 것 같으면 null */
export function cleanStoredMemo(memo: string): string | null {
  const m = memo.trim()
  if (!m || !SIGNS.some((re) => re.test(m)) || OWN_PAREN.test(m)) return null
  const name = onlyName(m).replace(/에서$/, '').trim()
  if (!hasName(name) || name === m) return null
  return name
}

/** 고칠 내역들: 직접 알려 준 이름(originalMemo, 가게 이름 기억)이 있는 내역은 빼고 */
export function memoFixes(list: Transaction[], aliasRaws: Set<string>): { id: number; memo: string }[] {
  const out: { id: number; memo: string }[] = []
  for (const t of list) {
    if (t.id == null || t.originalMemo || t.recurringId != null || t.savingsId != null) continue
    if (aliasRaws.has(normalizeName(t.memo))) continue
    const memo = cleanStoredMemo(t.memo)
    if (memo) out.push({ id: t.id, memo })
  }
  return out
}

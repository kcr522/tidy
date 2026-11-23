// 결제 · 입출금 알림 한 개의 글 → 종류(수입/지출), 금액, 가게(보낸 사람), 날짜, 시각. AI 없이 규칙으로만.
// 알림 하나에는 거래가 하나라서, 글 전체를 한 줄로 이어 붙인 뒤
// 1) 잔액 · 누적 · 한도 · 계좌번호 · 날짜 · 시각을 먼저 걷어 내고
// 2) "출금/입금/승인/결제…" 낱말 가까이에 있는 금액을 거래 금액으로 고르고
// 3) 금액 뒤(없으면 앞)에 남은 글을 가게 이름으로 쓴다
import { findDates, findTime } from './ai/assistantLocal'

export interface PayText {
  type: 'EXPENSE' | 'INCOME'
  amount: number
  /** 가게나 보낸/받는 사람. 못 찾으면 "출금", "입금" 같은 낱말 */
  merchant: string
  date: string | null
  time: string | null
  /** 급여 · 이자 · 환불 같은 수입 종류를 고를 때 쓰는 낱말 */
  hint: string
}

/** 외화 결제: 원으로 얼마인지 알 수 없어서 빼고, 사용자가 직접 적게 한다 */
const FOREIGN = /(USD|EUR|JPY|CNY|GBP|US\$|\$|€|£|¥|달러|유로|엔화)\s*[\d.,]+|[\d.,]+\s*(USD|EUR|JPY|CNY|달러|유로|엔)(?![가-힣])/i
/** 내 돈을 옮긴 것 (충전, 내 계좌끼리) */
const OWN_MOVE = /충전(?!소)|내\s*계좌로\s*옮|저금통|모으기\s*통장으로|세이프박스/

const CANCEL = /승인\s*취소|결제\s*취소|취소\s*(승인|완료|되었|됐)|환불|매출\s*취소/
/** 들어온 돈 */
const IN_WORDS = /입금|받았|받음|받은\s*돈|들어왔|님이\s*[\d,]+\s*원[을를]?\s*보냈|보낸\s*분|이자|캐시백\s*지급|급여|월급|환급/
/** 나간 돈 */
const OUT_WORDS = /출금|승인|결제|사용|구매|이체|송금|보냈|납부|자동\s*이체|인출/
/** 거래 금액 가까이에 오는 낱말 (금액 고를 때 기준) */
const VERB = /승인\s*취소|결제\s*취소|이체\s*출금|이체\s*입금|자동\s*이체|출금|입금|승인|결제|사용|이체|송금|보냈|받았|들어왔|환불|취소|인출|납부/g

/** 잔액 · 누적 · 한도 (원이 있든 없든). 가게 이름이 여기서 끊기게 ‖ 로 바꾼다 */
const BALANCE = /(잔\s*액|잔\s*고|누\s*적(\s*금액)?|잔여\s*한도|이용\s*가능(\s*(금액|한도))?|사용\s*가능(\s*(금액|한도))?|한\s*도|총\s*사용\s*금액|합\s*계)\s*[:：]?\s*[+\-−]?\s*[\d,]+\s*원?/g
/** 계좌번호 · 카드번호 (가린 것 포함): 123-***456-78901, 110-***-123456, 123456**789, *1234, (1234) */
const ACCOUNT_NO = /\d{2,6}(?:-[\d*]{2,8}){1,4}|\d*\*{2,}\d+|\*\d{3,4}|\(\s*\d{3,4}\s*\)|\d{4}-\*{4}-\*{4}-\d{4}/g
const MASKED_NAME = /[가-힣]\*[가-힣]{0,2}\s*님?/g
const TAG = /\[[^\]\d]{1,12}\]|\[?web\s*발신\]?/gi
const DATE = /(?<![\d,])(\d{2,4}[./-])?\d{1,2}[./]\d{1,2}(?![\d,])|\d{1,2}\s*월\s*\d{1,2}\s*일/g
const TIME = /(?<![\d,])([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?(?![\d,])|(오전|오후)\s*\d{1,2}\s*시(\s*\d{1,2}\s*분)?/g

/** 은행 · 카드 · 간편결제 이름과 거래 낱말: 가게 이름에서 지운다 */
const NOISE: RegExp[] = [
  /(신한|kb\s*국민|국민|삼성|현대|롯데|우리|하나|nh\s*농협|농협|bc|비씨|ibk\s*기업|기업|씨티|sc\s*제일|제일|카카오|토스|케이|k|새마을|우체국|수협|부산|대구|경남|광주|전북|제주)\s*(카드|은행|뱅크|뱅킹|체크|페이|금고|sol\s*페이|sol)/gi,
  /\b(kb|ibk|nh|sc|bnk|dgb|kdb)\b/gi,
  /^\s*(신한|국민|우리|하나|농협|기업|씨티|수협|새마을)\s+/g,
  /(삼성|네이버|카카오|토스|페이코|애플|구글|스마일|L)\s*(페이|pay|월렛|wallet)(\s*머니)?/gi,
  /samsung\s*wallet|samsung\s*pay|toss|kakao\s*pay/gi,
  /체크\s*카드|신용\s*카드|체크|신용/g,
  /승인\s*취소|결제\s*취소|이체\s*출금|이체\s*입금|자동\s*이체|매출\s*취소/g,
  /(출금|입금|승인|결제|사용|이체|송금|인출|납부|환불|취소|구매)(\s*(완료|되었습니다|됐어요|했어요|했습니다|하였습니다|내역|알림|안내|금액))*/g,
  /(일시불|할부\s*\d*\s*(개월)?|\d{1,2}\s*개월|무이자)/g,
  /(돈이\s*)?(들어왔어요|보냈어요|받았어요|보냈습니다|받았습니다)/g,
  /(보낸|받는|받은)\s*(분|사람)\s*[:：]?/g,
  /내\s*[가-힣]*\s*통장|입출금\s*통장|통장/g,
  /(고객|회원)\s*님|님께|님이|님에게|님/g,
  /(→|->|=>|[|·•>›<‹:：,])/g,
]

const pad = (n: number) => String(n).padStart(2, '0')
const hasName = (t: string) => /[가-힣a-zA-Z]{2,}/.test(t.replace(/\s/g, ''))

function clean(t: string): string {
  let s = t
  for (const re of NOISE) s = s.replace(re, ' ')
  return s
    .replace(/[()[\]{}]\s*[()[\]{}]/g, ' ')
    .replace(/^[\s\-–.~]+|[\s\-–.~]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 이름 앞에 붙는 칸 이름 ("가맹점: 다이소", "받는 분 홍길동") */
const LABEL = /(이용\s*)?(가맹점(\s*명)?|사용처|결제처|거래처|출금처|입금처|상호(\s*명)?|받는\s*(분|사람|곳)|보낸\s*(분|사람)|적요|내용|메모)\s*[:：]?/g
/** 이름 뒤에 남은 말끝 ("가 완료되었습니다", "에서 결제했어요") */
const TAIL = /\s*(이|가|을|를|은|는|에서|으로|로|에)?\s*(완료\s*)?(되었습니다|되었어요|됐습니다|됐어요|했어요|했습니다|하였습니다|합니다|완료|안내|알림|입니다|예요|이에요)[.!]?\s*$/

/** 가게(출금처) 이름만 남기기: 칸 이름, (주), 괄호 속 번호 · 덧말, 말끝을 지운다 */
export function onlyName(t: string): string {
  let s = t
    .replace(LABEL, ' ')
    .replace(/\(\s*(주|유|사|재)\s*\)|㈜|주식\s*회사|유한\s*회사/g, ' ')
    .replace(/\([^()]*\d[^()]*\)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  for (let i = 0; i < 3; i++) s = s.replace(TAIL, '').trim()
  s = s.replace(/^(이|가|을|를|은|는|에서|으로|로)\s+/, '').replace(/(에서|으로)$/, '')
  // 괄호 밖에 이름이 있으면 괄호 속 덧말("쿠팡(쿠페이)")은 뺀다
  const outside = s.replace(/\([^()]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (hasName(outside)) s = outside
  return s.replace(/^[\s\-–.~()]+|[\s\-–.~(]+$/g, '').replace(/\s+/g, ' ').trim()
}

/** 금액 후보: "6,100원", "6100원", "50,000"(쉼표), "출금50000"(낱말 바로 옆 숫자) */
interface Money {
  value: number
  index: number
  end: number
  won: boolean
}

function moneys(s: string): Money[] {
  const out: Money[] = []
  const re = /([+\-−])?\s*(\d{1,3}(?:,\d{3})+|\d{3,10})(\s*원)?/g
  for (const m of s.matchAll(re)) {
    const won = !!m[3]
    const comma = m[2].includes(',')
    const idx = m.index ?? 0
    const before = s.slice(Math.max(0, idx - 6), idx)
    const nextVerb = /^\s*(출금|입금|승인|결제|사용|이체)/.test(s.slice(idx + m[0].length))
    // 쉼표도 원도 없는 숫자는 거래 낱말 바로 옆일 때만 (계좌 뒷자리, 연도 같은 숫자 빼기)
    if (!won && !comma && !/(출금|입금|이체|승인|결제|사용)\s*$/.test(before) && !nextVerb) continue
    const value = Number(m[2].replace(/,/g, ''))
    if (!value || value > 9_999_999_999) continue
    out.push({ value, index: idx, end: idx + m[0].length, won })
  }
  return out
}

/** 알림 제목 + 글 → 거래 하나 (결제 · 입출금이 아니면 null) */
export function readPayText(title: string, text: string, today: string): PayText | null {
  // 문자 알림 제목은 보낸 번호 (예: 15881688, 1544-7200)
  const head = /^[\d\s+\-#]+$/.test(title.trim()) ? '' : title
  // "입출금 통장"의 입·출금은 거래 방향이 아니다
  const raw = `${head}\n${text}`.replace(/입출금/g, ' ')
  if (OWN_MOVE.test(raw)) return null
  let s = raw
    .replace(/\s*\n\s*/g, ' ‖ ')
    .replace(/[₩￦]\s*([\d,]+)/g, '$1원')
    .replace(/KRW\s*([\d,]+)/gi, '$1원')
    .replace(/(\d)\s*,\s*(\d{3})(?!\d)/g, '$1,$2')
    .replace(TAG, ' ')
  if (FOREIGN.test(s) && !/\d\s*원/.test(s)) return null

  const date = findDates(s, today, false)[0]?.date ?? null
  const time = findTime(s.replace(DATE, ' '))?.time ?? null
  s = s.replace(BALANCE, ' ‖ ').replace(DATE, ' ').replace(TIME, ' ').replace(ACCOUNT_NO, ' ').replace(MASKED_NAME, ' ')
  // 카드 뒷자리가 이름에 붙은 것 (KB국민카드1234승인)
  s = s.replace(/(카드|은행|뱅크|체크|페이)\s*\d{3,4}(?=\s*[가-힣])/g, '$1 ')

  const found = moneys(s)
  if (!found.length) return null
  const verbs = [...s.matchAll(VERB)].map((m) => m.index ?? 0)
  // 거래 낱말에 가장 가까운 금액, 같으면 "원"이 붙은 것, 그다음 앞쪽
  const score = (m: Money) => (verbs.length ? Math.min(...verbs.map((v) => Math.abs(v - m.index))) : 0) - (m.won ? 4 : 0)
  const money = [...found].sort((a, b) => score(a) - score(b) || a.index - b.index)[0]

  const cancel = CANCEL.test(raw)
  const income = cancel || (IN_WORDS.test(raw) && !/출금|승인(?!\s*취소)|결제(?!\s*취소)/.test(raw.replace(/님이\s*[\d,]+\s*원[을를]?\s*보냈/, '')))
  const outgoing = OUT_WORDS.test(raw)
  if (!income && !outgoing && !money.won) return null

  // 가게 이름: 금액 뒤 ‖ 까지, 없으면 금액 앞 (‖ 뒤부터)
  const after = clean(s.slice(money.end).replace(/^\s*[을를이가은는]\s/, ' ').split('‖').find((x) => hasName(clean(x))) ?? '')
  const beforeParts = s.slice(0, money.index).split('‖')
  const before = clean([...beforeParts].reverse().find((x) => hasName(clean(x))) ?? '')
  const marker = /님께|님이|님에게|보낸\s*분|받는\s*분/.test(raw)
  // 금액 앞의 사람 이름 하나는 보통 계좌 주인 (KB "김채림 출금 50,000") — 토스처럼 "님께/님이"가 있으면 상대방
  const holderOnly = /^[가-힣]{2,4}$/.test(before) && !marker && !/^(이자|급여|월급|상여|용돈|캐시백|환급|환불|보험금)/.test(before) && /[가-힣]{2,4}[\s‖]*(출금|입금|이체)/.test(s.slice(0, money.index))
  // "쿠팡이츠에서 23,000원 결제…"처럼 "○○에서" 가 있으면 그게 가게
  const at = /([가-힣A-Za-z0-9&'()\s]{2,30}?)에서\s*$/.exec(s.slice(0, money.index).split('‖').pop() ?? '')
  const atName = at && !/(계좌|통장|카드|머니|페이|잔액)\s*$/.test(at[1]) ? onlyName(clean(at[1])) : ''
  const afterName = onlyName(after)
  const beforeName = holderOnly ? '' : onlyName(before)
  let merchant = (hasName(atName) ? atName : '') || (hasName(afterName) ? afterName : '') || (hasName(beforeName) ? beforeName : '')
  merchant = merchant.slice(0, 40).trim()
  if (!hasName(merchant)) merchant = income ? '입금' : '출금'

  return { type: income ? 'INCOME' : 'EXPENSE', amount: money.value, merchant, date, time, hint: raw }
}

export const timeOf = (ms: number) => {
  const d = new Date(ms)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

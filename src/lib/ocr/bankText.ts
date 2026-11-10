// 은행·카드 앱 캡처에서 읽은 글자(OCR)를 가계부 내역으로 바꾼다. AI 없이 규칙으로만 찾는다.
// 지원하는 모양
// - 거래 내역 목록 (토스, 카카오뱅크, 은행 앱): "11월 10일" 날짜 줄 아래에 "가게 이름 / -5,000원 / 14:35"
// - 결제 알림 문자: "신한카드(1234)승인 김*림 5,000원(일시불)11/10 14:35 다이소운남점 누적123,000원"
import type { PaymentGuess } from '../ai/assistant'
import { findDates, findTime } from '../ai/assistantLocal'
import { matchMerchant } from '../merchants'

export interface BankParseResult {
  payments: PaymentGuess[]
  /** 캡처에 보인 잔액 (있으면) */
  balance: number | null
}

/** 은행·카드·간편결제 이름 (결제 수단으로 쓴다) */
const ACCOUNT_NAMES: [RegExp, string][] = [
  [/신한\s*카드/, '신한카드'],
  [/(kb|국민)\s*(국민)?\s*카드/i, 'KB국민카드'],
  [/삼성\s*카드/, '삼성카드'],
  [/현대\s*카드/, '현대카드'],
  [/롯데\s*카드/, '롯데카드'],
  [/우리\s*카드/, '우리카드'],
  [/하나\s*카드/, '하나카드'],
  [/(nh|농협)\s*(농협)?\s*카드/i, 'NH농협카드'],
  [/bc\s*카드|비씨\s*카드/i, 'BC카드'],
  [/토스\s*뱅크/, '토스뱅크'],
  [/카카오\s*뱅크/, '카카오뱅크'],
  [/케이\s*뱅크|k\s*bank/i, '케이뱅크'],
  [/카카오\s*페이/, '카카오페이'],
  [/네이버\s*페이/, '네이버페이'],
  [/토스\s*페이(?!먼츠)/, '토스'],
  [/신한\s*(은행|sol)/i, '신한은행'],
  [/(kb|국민)\s*(은행|스타뱅킹)/i, 'KB국민은행'],
  [/우리\s*(은행|won)/i, '우리은행'],
  [/하나\s*(은행|원큐)/, '하나은행'],
  [/(nh|농협)\s*(은행|올원)?뱅크?/i, 'NH농협'],
  [/(ibk|기업)\s*은행/i, 'IBK기업은행'],
  [/새마을\s*금고/, '새마을금고'],
  [/우체국/, '우체국'],
]

export function findAccount(text: string): string | null {
  for (const [re, name] of ACCOUNT_NAMES) if (re.test(text)) return name
  return null
}

const BALANCE = /(잔액|잔고|누적|한도|이용\s*가능|총\s*액|합계|예상)\s*:?\s*[+\-−]?\s*[\d,.]+\s*원?/g
const MONEY = /([+\-−])?\s*(\d{1,3}(?:[,.]\d{3})+|\d{3,9})\s*원/
const SIGNED = /(?<![\d,])([+\-−])\s*(\d{1,3}(?:,\d{3})+|\d{3,9})(?![\d,])/
const INCOME_WORDS = /입금|받은|받음|환불|취소|캐시백|이자|급여|월급|용돈|송금\s*받/
const NOISE = [
  /\[?web\s*발신\]?/gi,
  /\(\s*\d{3,4}\s*\)/g,
  /\d{4}\s*[-*]\s*\*{2,}/g,
  /승인\s*취소|승인|일시불|할부\s*\d*\s*개?월?|체크|신용|결제\s*완료|결제|출금|입금|이체|사용|해외|국내/g,
  /[가-힣]\*[가-힣]\s*님?/g,
  /님(?=\s|$)/g,
  /(오전|오후)/g,
  /[|·•>›<‹]/g,
]

/** OCR이 한 글자씩 띄어 읽은 한글을 붙인다 ("다 이 소" → "다이소") */
export function joinSpacedHangul(line: string): string {
  return line.replace(/(?:^|(?<=\s))((?:[가-힣]\s){2,}[가-힣])(?=\s|$)/g, (m) => m.replace(/\s/g, ''))
}

/** OCR이 자주 틀리는 글자 고치기 */
function fixLine(raw: string): string {
  return joinSpacedHangul(
    raw
      .replace(/[₩￦]/g, '')
      .replace(/(\d)\s*(윈|웬|월(?=\s*$))/g, '$1원')
      .replace(/(\d)\s+,\s*(\d{3})/g, '$1,$2')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

const isDateHeader = (line: string, today: string) => {
  const d = findDates(line, today, false)[0]
  if (!d) return null
  const rest = line.replace(d.text, '').replace(/[()\s월화수목금토일요오늘어제]/g, '')
  return rest.length <= 2 ? d.date : null
}

function cleanMerchant(text: string, account: string | null): string {
  let t = text
  for (const re of NOISE) t = t.replace(re, ' ')
  if (account) t = t.replace(new RegExp(account.replace(/\s/g, '\\s*'), 'gi'), ' ')
  for (const [re] of ACCOUNT_NAMES) t = t.replace(new RegExp(re.source, re.flags.includes('i') ? 'gi' : 'g'), ' ')
  return t
    .replace(/(?<![가-힣a-z])\d{1,2}[./]\d{1,2}(?![\d])/gi, ' ')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, ' ')
    .replace(/\(\s*\)|\[\s*\]/g, ' ')
    .replace(/^[\s\-–:,.]+|[\s\-–:,.]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

const hasName = (t: string) => /[가-힣a-zA-Z]{2,}/.test(t.replace(/\s/g, ''))

/** 캡처 글자 → 결제 내역들 */
export function parseBankText(text: string, today: string): BankParseResult {
  const lines = text.split(/\r?\n/).map(fixLine).filter(Boolean)
  const account = findAccount(text)
  const payments: PaymentGuess[] = []
  const used = new Set<number>()
  let balance: number | null = null
  let current = today

  lines.forEach((line, i) => {
    const header = isDateHeader(line, today)
    if (header) {
      current = header
      used.add(i)
      return
    }
    const bal = line.match(/(잔액|잔고)\s*:?\s*([\d,]+)\s*원?/)
    if (bal && balance === null) balance = Number(bal[2].replace(/,/g, ''))

    const body = line.replace(BALANCE, ' ')
    const m = body.match(MONEY) ?? body.match(SIGNED)
    if (!m || m.index === undefined) return
    const amount = Number(m[2].replace(/[,.]/g, ''))
    if (!amount || amount > 999_999_999) return
    used.add(i)

    // 시각만 있는 줄은 보통 금액 바로 아래(없으면 위)에 있다
    const timeOnly = (j: number) => {
      const l = lines[j]?.replace(BALANCE, ' ')
      if (!l || used.has(j)) return null
      const t = findTime(l)
      if (!t || l.replace(t.text, '').replace(/[\s\-–|·]/g, '').length > 4) return null
      used.add(j)
      return t.time
    }
    const sign = m[1]
    const income = sign === '+' || (!sign && INCOME_WORDS.test(line))
    const date = findDates(body, today, false)[0]?.date ?? current
    const time = findTime(body)?.time ?? timeOnly(i + 1) ?? timeOnly(i - 1)

    let merchant = cleanMerchant(body.replace(m[0], ' '), account)
    // 같은 줄에 이름이 없으면 바로 위(없으면 아래) 줄에서 찾는다
    if (!hasName(merchant)) {
      for (const j of [i - 1, i + 1, i - 2]) {
        const cand = lines[j]
        if (!cand || used.has(j) || isDateHeader(cand, today) || MONEY.test(cand.replace(BALANCE, ' '))) continue
        const c = cleanMerchant(cand, account)
        if (hasName(c)) {
          merchant = c
          used.add(j)
          break
        }
      }
    }
    if (!hasName(merchant)) merchant = income ? '입금' : '결제'
    merchant = merchant.slice(0, 60)

    const brand = matchMerchant(merchant)
    payments.push({
      type: income ? 'INCOME' : 'EXPENSE',
      merchant,
      amount,
      date,
      time,
      account,
      category: income ? (/급여|월급/.test(line) ? '월급' : /용돈/.test(line) ? '용돈' : '기타') : (brand?.brand.category ?? guessCategory(merchant)),
    })
  })

  // 같은 내역이 두 번 읽힌 것 지우기
  const seen = new Set<string>()
  const unique = payments.filter((p) => {
    const k = `${p.type}|${p.amount}|${p.date}|${p.time}|${p.merchant}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  return { payments: unique, balance }
}

/** 브랜드 목록에 없는 가게: 이름에 든 낱말로 카테고리를 고른다 */
export function guessCategory(name: string): string {
  const n = name.replace(/\s/g, '')
  if (/택시|버스|지하철|철도|주유|충전|주차|톨게이트|하이패스|교통|따릉이|킥보드/.test(n)) return '교통'
  if (/식당|분식|김밥|치킨|피자|카페|커피|베이커리|빵|제과|떡|국밥|고기|횟집|초밥|마라|식품|마트|편의점|푸드|키친|반찬|도시락|버거/.test(n)) return '식비'
  if (/약국|병원|의원|치과|한의원|안과|피부과|헬스|필라테스|요가/.test(n)) return '의료/건강'
  if (/영화|시네마|cgv|노래|pc방|게임|공연|티켓|넷플릭스|왓챠|티빙|멜론|스포티파이|도서|서점/i.test(n)) return '문화/여가'
  if (/학원|교육|강의|클래스|인강|스터디/.test(n)) return '교육'
  if (/통신|관리비|월세|전기|가스|수도|인터넷/.test(n)) return '주거/통신'
  if (/쇼핑|몰|스토어|마켓|옷|의류|화장품|잡화|문구|생활/.test(n)) return '쇼핑'
  return '기타'
}

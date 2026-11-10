/**
 * 가게(브랜드) 인식: 메모나 결제처 이름에서 브랜드와 지점을 찾는다.
 * "다이소 운남점" → { brand: 다이소, branch: "운남", display: "운남 다이소" }
 *
 * 로고는 브랜드 홈페이지 아이콘을 인터넷에서 받아 보여 주고(한 번 받으면 기기에 저장),
 * 못 받으면 브랜드 색 동그라미에 짧은 이름을 보여 준다.
 */

export interface Brand {
  /** 화면에 보일 이름 */
  name: string
  /** 메모/결제처에서 찾을 이름들 (띄어쓰기, 대소문자 무시) */
  aliases: string[]
  /** 로고를 받아 올 홈페이지 주소 */
  domain: string
  /** 로고를 못 받았을 때 동그라미 색 */
  color: string
  /** 동그라미 안 짧은 글자 (없으면 이름 앞 두 글자) */
  short?: string
  /** 추천 카테고리 (지출) */
  category: string
}

const b = (name: string, domain: string, color: string, category: string, aliases: string[] = [], short?: string): Brand => ({
  name,
  domain,
  color,
  category,
  aliases: [name, ...aliases],
  short,
})

export const BRANDS: Brand[] = [
  // 생활·쇼핑
  b('다이소', 'daiso.co.kr', '#E60012', '쇼핑', ['daiso', '아성다이소']),
  b('올리브영', 'oliveyoung.co.kr', '#9BCB3C', '쇼핑', ['oliveyoung', 'cj올리브영', '올영'], '올영'),
  b('이마트', 'emart.com', '#FFB300', '쇼핑', ['emart', '이마트에브리데이']),
  b('홈플러스', 'homeplus.co.kr', '#E2001A', '쇼핑', ['homeplus']),
  b('롯데마트', 'lottemart.com', '#E60012', '쇼핑', ['lottemart']),
  b('코스트코', 'costco.co.kr', '#005DAA', '쇼핑', ['costco']),
  b('쿠팡', 'coupang.com', '#E52528', '쇼핑', ['coupang']),
  b('무신사', 'musinsa.com', '#111111', '쇼핑', ['musinsa']),
  b('유니클로', 'uniqlo.com', '#FF0000', '쇼핑', ['uniqlo']),
  b('무인양품', 'mujikorea.net', '#7F0019', '쇼핑', ['muji']),
  b('아트박스', 'artbox.co.kr', '#E4007F', '쇼핑', ['artbox']),
  b('네이버페이', 'naver.com', '#03C75A', '쇼핑', ['naverpay', '네이버'], 'N'),
  // 편의점
  b('CU', 'cu.bgfretail.com', '#652F8D', '식비', ['씨유', 'bgf리테일']),
  b('GS25', 'gs25.gsretail.com', '#00A0E2', '식비', ['지에스25', 'gs리테일'], 'GS25'),
  b('세븐일레븐', '7-eleven.co.kr', '#008061', '식비', ['7eleven', '7-eleven', '코리아세븐'], '7'),
  b('이마트24', 'emart24.co.kr', '#FFB81C', '식비', ['emart24']),
  // 카페·디저트
  b('스타벅스', 'starbucks.co.kr', '#00704A', '식비', ['starbucks', '스벅']),
  b('투썸플레이스', 'twosome.co.kr', '#D6001C', '식비', ['투썸', 'twosome']),
  b('이디야', 'ediya.com', '#1E2D5B', '식비', ['ediya', '이디야커피']),
  b('메가커피', 'mega-mgccoffee.com', '#FFD400', '식비', ['메가엠지씨커피', '메가mgc커피', 'megacoffee']),
  b('컴포즈커피', 'composecoffee.com', '#FFC400', '식비', ['컴포즈', 'composecoffee']),
  b('빽다방', 'paikdabang.com', '#FFE600', '식비', ['paik']),
  b('할리스', 'hollys.co.kr', '#A6192E', '식비', ['할리스커피', 'hollys']),
  b('폴바셋', 'baristapaulbassett.co.kr', '#1A1A1A', '식비', ['paulbassett']),
  b('배스킨라빈스', 'baskinrobbins.co.kr', '#FF1F8E', '식비', ['베스킨라빈스', 'baskinrobbins', '배라']),
  b('던킨', 'dunkindonuts.co.kr', '#FF671F', '식비', ['던킨도너츠', 'dunkin']),
  b('파리바게뜨', 'paris.co.kr', '#1F3B73', '식비', ['파리바게트', 'parisbaguette']),
  b('뚜레쥬르', 'tlj.co.kr', '#00704A', '식비', ['touslesjours']),
  // 음식점·배달
  b('맥도날드', 'mcdonalds.co.kr', '#DA291C', '식비', ['mcdonalds', '맥날']),
  b('버거킹', 'burgerking.co.kr', '#D62300', '식비', ['burgerking']),
  b('롯데리아', 'lotteeatz.com', '#E60012', '식비', ['lotteria']),
  b('맘스터치', 'momstouch.co.kr', '#E3001B', '식비', ['momstouch']),
  b('써브웨이', 'subway.co.kr', '#008938', '식비', ['서브웨이', 'subway']),
  b('교촌치킨', 'kyochon.com', '#B8860B', '식비', ['교촌']),
  b('배달의민족', 'baemin.com', '#2AC1BC', '식비', ['배민', '우아한형제들', 'baemin']),
  b('쿠팡이츠', 'coupangeats.com', '#00A5E6', '식비', ['coupangeats']),
  b('요기요', 'yogiyo.co.kr', '#FA0050', '식비', ['yogiyo']),
  // 교통
  b('카카오T', 'kakaomobility.com', '#FEE500', '교통', ['카카오택시', '카카오모빌리티', 'kakaot'], 'T'),
  b('티머니', 'tmoney.co.kr', '#E6007E', '교통', ['tmoney', '교통카드']),
  b('코레일', 'letskorail.com', '#004EA2', '교통', ['korail', '한국철도']),
  b('SRT', 'etk.srail.kr', '#5B2C83', '교통', ['에스알', '수서고속철도']),
  // 문화·여가·구독
  b('CGV', 'cgv.co.kr', '#E71A0F', '문화/여가', ['씨지브이']),
  b('메가박스', 'megabox.co.kr', '#503396', '문화/여가', ['megabox']),
  b('롯데시네마', 'lottecinema.co.kr', '#ED1C24', '문화/여가', ['lottecinema']),
  b('넷플릭스', 'netflix.com', '#E50914', '문화/여가', ['netflix'], 'N'),
  b('유튜브', 'youtube.com', '#FF0000', '문화/여가', ['youtube', '유튜브프리미엄', 'google*youtube']),
  b('교보문고', 'kyobobook.co.kr', '#4A2C82', '교육', ['kyobo']),
  // 통신
  b('SKT', 'tworld.co.kr', '#EA002C', '주거/통신', ['sk텔레콤', 'sktelecom']),
  b('KT', 'kt.com', '#E60012', '주거/통신', ['케이티']),
  b('LG U+', 'lguplus.com', '#E6007E', '주거/통신', ['lgu+', '엘지유플러스', 'lg유플러스'], 'U+'),
]

/** 비교용: 띄어쓰기, (주), ㈜ 같은 것을 지우고 소문자로 */
export function normalizeName(text: string): string {
  return text
    .toLowerCase()
    .replace(/\(주\)|㈜|주식회사|\(유\)/g, '')
    .replace(/[\s_·.,]/g, '')
}

interface AliasEntry {
  alias: string
  brand: Brand
}

// 긴 이름부터 찾아야 "쿠팡이츠"가 "쿠팡"으로 잡히지 않는다
const ALIASES: AliasEntry[] = BRANDS.flatMap((brand) => brand.aliases.map((a) => ({ alias: normalizeName(a), brand })))
  .sort((x, y) => y.alias.length - x.alias.length)

export interface MerchantMatch {
  brand: Brand
  /** "운남" 같은 지점 이름 (없으면 null) */
  branch: string | null
  /** "운남 다이소" */
  display: string
}

/** 메모나 결제처 이름에서 브랜드를 찾는다. 없으면 null */
export function matchMerchant(text: string): MerchantMatch | null {
  const raw = text.trim()
  if (!raw) return null
  const norm = normalizeName(raw)
  const lower = raw.toLowerCase()
  const hit = ALIASES.find((e) => (isShortLatin(e.alias) ? standsAlone(lower, e.alias) : norm.includes(e.alias)))
  if (!hit) return null
  const branch = findBranch(raw, hit.alias)
  return { brand: hit.brand, branch, display: branch ? `${branch} ${hit.brand.name}` : hit.brand.name }
}

/** "CU", "KT" 같은 짧은 영어 이름은 다른 단어 안에 섞여 있으면 안 된다 (KTX ≠ KT) */
function isShortLatin(alias: string): boolean {
  return alias.length <= 3 && /^[a-z0-9+]+$/.test(alias)
}

function standsAlone(lower: string, alias: string): boolean {
  const esc = alias.replace(/[+]/g, '\\+')
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(lower)
}

/** 브랜드 이름 뒤에 오는 "운남점", "강남R점", "(홍대점)" 에서 지점 이름만 뽑는다 */
function findBranch(raw: string, alias: string): string | null {
  // 원래 글자에서 브랜드 이름이 끝나는 위치를 찾는다 (띄어쓰기를 건너뛰며 비교)
  const lower = raw.toLowerCase()
  for (let start = 0; start < lower.length; start++) {
    let i = start
    let j = 0
    while (i < lower.length && j < alias.length) {
      const c = lower[i]
      if (/[\s_·.,]/.test(c) && j > 0) {
        i++
        continue
      }
      if (c !== alias[j]) break
      i++
      j++
    }
    if (j === alias.length) {
      const rest = raw
        .slice(i)
        .replace(/[()[\]{}]/g, ' ')
        .trim()
      const m = rest.match(/^[-_·\s]*([0-9A-Za-z가-힣]+?)\s*(?:직영점|지점|점)(?:\s|$)/)
      return m && m[1] ? m[1] : null
    }
  }
  return null
}

// 결제 대행사(PG)나 간편결제 이름: 이것만 찍히면 실제로 어디서 썼는지 알 수 없다
const UNCLEAR_PATTERNS = [
  /kcp/i,
  /nice|나이스/i,
  /inicis|이니시스/i,
  /토스페이먼츠|tosspayments/i,
  /다날|danal/i,
  /kicc|한국정보통신/i,
  /smartro|스마트로/i,
  /ksnet/i,
  /세틀뱅크|settlebank/i,
  /헥토|hecto/i,
  /페이레터|payletter/i,
  /갤럭시아|galaxia/i,
  /paypal|페이팔/i,
  /결제대행|전자결제|pg사/i,
]

/** 결제 대행사 이름처럼 보여서 어디서 썼는지 물어봐야 하는지 */
export function isUnclearMerchant(text: string): boolean {
  const t = text.trim()
  if (!t || matchMerchant(t)) return false
  return UNCLEAR_PATTERNS.some((p) => p.test(t)) || /^[A-Z0-9*\-_ ]{2,}\*/.test(t)
}

/** 로고 이미지 주소 (브랜드 홈페이지 아이콘) */
export function logoUrl(brand: Brand): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(brand.domain)}&sz=128`
}

/** 로고를 못 받았을 때 동그라미 안 글자 */
export function brandShort(brand: Brand): string {
  return brand.short ?? brand.name.slice(0, brand.name.length <= 3 ? 3 : 2)
}

/** 배경색 위에 흰 글자가 잘 보이는지 (노란 브랜드는 검은 글자) */
export function brandTextColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, bl] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * bl > 170 ? '#191f28' : '#ffffff'
}

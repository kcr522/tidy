/**
 * 가게(브랜드) 인식: 메모나 결제처 이름에서 브랜드와 지점을 찾는다.
 * "다이소 운남점" → { brand: 다이소, branch: "운남", display: "운남 다이소" }
 *
 * 로고는 브랜드 공식 앱 아이콘을 앱 안에 넣어 둔 것(public/brands/<app>.webp, scripts/brand-logos.mjs 로 받음)을 먼저 쓰고,
 * 없으면 브랜드 홈페이지 아이콘을 인터넷에서 받아 보여 주고, 그것도 없으면 브랜드 색 동그라미에 짧은 이름을 보여 준다.
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
  /** 공식 앱 패키지 (Google Play). 로고는 public/brands/<app>.webp */
  app?: string
  /** 앱이 없거나 앱 아이콘이 다른 브랜드 것일 때: 위키백과 문서의 로고 그림 ('롯데리아|en:Lotteria'). public/brands/<domain>.png */
  wiki?: string
}

const b = (name: string, domain: string, color: string, category: string, aliases: string[] = [], short?: string): Brand => ({
  name,
  domain,
  color,
  category,
  aliases: [name, ...aliases],
  short,
})

/** 공식 앱 아이콘(public/brands/<app>.webp)을 로고로 쓰는 브랜드 */
const withApp = (app: string, brand: Brand): Brand => ({ ...brand, app })
/** 위키백과 문서의 로고 그림(public/brands/<domain>.png)을 쓰는 브랜드 */
const withWiki = (title: string, brand: Brand): Brand => ({ ...brand, wiki: title })

export const BRANDS: Brand[] = [
  // 생활·쇼핑
  withApp('com.uxlayer.wipoint', b('다이소', 'daiso.co.kr', '#E60012', '쇼핑', ['daiso', '아성다이소'])),
  withApp('com.oliveyoung', b('올리브영', 'oliveyoung.co.kr', '#9BCB3C', '쇼핑', ['oliveyoung', 'cj올리브영', '올영'], '올영')),
  withApp('com.emart.today', b('이마트', 'emart.com', '#FFB300', '쇼핑', ['emart', '이마트에브리데이'])),
  withApp('com.socialapps.homeplus', b('홈플러스', 'homeplus.co.kr', '#E2001A', '쇼핑', ['homeplus'])),
  withApp('com.lottemart.lmscp', b('롯데마트', 'lottemart.com', '#E60012', '쇼핑', ['lottemart', '롯데슈퍼'])),
  withApp('com.costco.dmc.store', b('코스트코', 'costco.co.kr', '#005DAA', '쇼핑', ['costco'])),
  withApp('com.coupang.mobile', b('쿠팡', 'coupang.com', '#E52528', '쇼핑', ['coupang'])),
  withApp('com.musinsa.store', b('무신사', 'musinsa.com', '#111111', '쇼핑', ['musinsa'])),
  withApp('com.uniqlo.kr.catalogue', b('유니클로', 'uniqlo.com', '#FF0000', '쇼핑', ['uniqlo'])),
  withApp('com.muji', b('무인양품', 'mujikorea.net', '#7F0019', '쇼핑', ['muji'])),
  b('아트박스', 'artbox.co.kr', '#E4007F', '쇼핑', ['artbox']),
  withApp('com.himart.main', b('롯데하이마트', 'e-himart.co.kr', '#E60012', '쇼핑', ['하이마트', 'himart'])),
  withApp('com.innov.lottecoupon', b('롯데백화점', 'lotteshopping.com', '#ED1C24', '쇼핑', ['lottedepartment'])),
  withApp('com.F1.ShinSG', b('신세계백화점', 'shinsegae.com', '#222222', '쇼핑', ['신세계', 'shinsegae'])),
  withApp('com.ehyundai.mcard', b('현대백화점', 'ehyundai.com', '#1F7A5A', '쇼핑', ['더현대', 'thehyundai'])),
  withApp('com.elevenst', b('11번가', '11st.co.kr', '#FF0038', '쇼핑', ['11st', '십일번가'], '11')),
  withApp('com.ebay.kr.gmarket', b('G마켓', 'gmarket.co.kr', '#00A650', '쇼핑', ['gmarket', '지마켓'], 'G')),
  withApp('kr.co.ssg', b('SSG.COM', 'ssg.com', '#FF5452', '쇼핑', ['ssg', '쓱닷컴', '에스에스지'], 'SSG')),
  withApp('com.dbs.kurly.m2', b('컬리', 'kurly.com', '#5F0080', '쇼핑', ['마켓컬리', 'kurly', '뷰티컬리'])),
  withApp('net.bucketplace', b('오늘의집', 'ohou.se', '#35C5F0', '쇼핑', ['버킷플레이스', 'bucketplace'])),
  withApp('com.croquis.zigzag', b('지그재그', 'zigzag.kr', '#FA6EE3', '쇼핑', ['zigzag', '카카오스타일'])),
  withApp('com.banhala.android', b('에이블리', 'a-bly.com', '#FF5A5A', '쇼핑', ['ably'])),
  withApp('com.the29cm.app29cm', b('29CM', '29cm.co.kr', '#111111', '쇼핑', ['29씨엠'], '29')),
  withApp('com.alibaba.aliexpresshd', b('알리익스프레스', 'aliexpress.com', '#E62E04', '쇼핑', ['aliexpress', '알리익스프레스코리아'])),
  withApp('com.einnovation.temu', b('테무', 'temu.com', '#FB7701', '쇼핑', ['temu'])),
  withApp('com.towneers.www', b('당근마켓', 'daangn.com', '#FF6F0F', '쇼핑', ['당근페이', 'daangn'], '당근')),
  withApp('com.naverfin.payapp', b('네이버페이', 'naver.com', '#03C75A', '쇼핑', ['naverpay', '네이버'], 'N')),
  // 편의점
  withApp('com.bgfcu.membership', b('CU', 'cu.bgfretail.com', '#652F8D', '식비', ['씨유', 'bgf리테일'])),
  withWiki('commons:GS25 logo|ko:GS25', b('GS25', 'gs25.gsretail.com', '#00A0E2', '식비', ['지에스25', 'gs리테일'], 'GS25')),
  withApp('kr.co.kork7app', b('세븐일레븐', '7-eleven.co.kr', '#008061', '식비', ['7eleven', '7-eleven', '코리아세븐'], '7')),
  withApp('kr.co.emart24.everse', b('이마트24', 'emart24.co.kr', '#FFB81C', '식비', ['emart24'])),
  // 카페·디저트
  withApp('com.starbucks.co', b('스타벅스', 'starbucks.co.kr', '#00704A', '식비', ['starbucks', '스벅'])),
  withApp('com.cj.twosome', b('투썸플레이스', 'twosome.co.kr', '#D6001C', '식비', ['투썸', 'twosome'])),
  withApp('com.ediya.coupon', b('이디야', 'ediya.com', '#1E2D5B', '식비', ['ediya', '이디야커피'])),
  withApp('co.kr.waldlust.megacoffee', b('메가커피', 'mega-mgccoffee.com', '#FFD400', '식비', ['메가엠지씨커피', '메가mgc커피', 'megacoffee'])),
  withApp('ci.dvn.composecoffee.app', b('컴포즈커피', 'composecoffee.com', '#FFC400', '식비', ['컴포즈', 'composecoffee'])),
  withApp('air.kr.paikdabang.android.membership', b('빽다방', 'paikdabang.com', '#FFE600', '식비', ['paik'])),
  withApp('com.kr.hollyscoffee', b('할리스', 'hollys.co.kr', '#A6192E', '식비', ['할리스커피', 'hollys'])),
  withApp('com.msseed.membership', b('폴바셋', 'baristapaulbassett.co.kr', '#1A1A1A', '식비', ['paulbassett'])),
  withApp('kr.co.baskinrobbins.client', b('배스킨라빈스', 'baskinrobbins.co.kr', '#FF1F8E', '식비', ['베스킨라빈스', 'baskinrobbins', '배라'])),
  withWiki('던킨|en:Dunkin Donuts', b('던킨', 'dunkindonuts.co.kr', '#FF671F', '식비', ['던킨도너츠', 'dunkin'])),
  withApp('com.pb.android', b('파리바게뜨', 'paris.co.kr', '#1F3B73', '식비', ['파리바게트', 'parisbaguette'])),
  withApp('kr.co.tlj.app', b('뚜레쥬르', 'tlj.co.kr', '#00704A', '식비', ['touslesjours'])),
  withApp('com.easymembership.gongcha', b('공차', 'gong-cha.co.kr', '#B5121B', '식비', ['gongcha'])),
  withApp('com.coffeebeankorea.purpleorder', b('커피빈', 'coffeebeankorea.com', '#5F259F', '식비', ['coffeebean', '커피빈앤티리프'])),
  withApp('com.sulbing.mobile.app', b('설빙', 'sulbing.com', '#E4E1D9', '식비', ['sulbing'])),
  withApp('kr.co.theventi', b('더벤티', 'theventi.co.kr', '#4B2A85', '식비', ['theventi'])),
  withApp('co.kr.waldlust.mmthcoffee', b('매머드커피', 'mmthcoffee.com', '#E2231A', '식비', ['매머드익스프레스', 'mammoth'])),
  // 음식점·배달
  withApp('com.mcdonalds.mobileapp', b('맥도날드', 'mcdonalds.co.kr', '#DA291C', '식비', ['mcdonalds', '맥날'])),
  withApp('kr.co.burgerkinghybrid', b('버거킹', 'burgerking.co.kr', '#D62300', '식비', ['burgerking'])),
  withWiki('롯데리아|en:Lotteria', b('롯데리아', 'lotteria.com', '#E60012', '식비', ['lotteria', '롯데리아'])),
  withApp('kr.co.momstouch.moms', b('맘스터치', 'momstouch.co.kr', '#E3001B', '식비', ['momstouch'])),
  withApp('kr.co.subway.preorder', b('써브웨이', 'subway.co.kr', '#008938', '식비', ['서브웨이', 'subway'])),
  withApp('com.order.kyochonchicken', b('교촌치킨', 'kyochon.com', '#B8860B', '식비', ['교촌'])),
  withApp('com.sampleapp', b('배달의민족', 'baemin.com', '#2AC1BC', '식비', ['배민', '우아한형제들', 'baemin'])),
  withApp('com.coupang.mobile.eats', b('쿠팡이츠', 'coupangeats.com', '#00A5E6', '식비', ['coupangeats'])),
  withApp('com.fineapp.yogiyo', b('요기요', 'yogiyo.co.kr', '#FA0050', '식비', ['yogiyo'])),
  withApp('kfc_ko.kore.kg.kfc_korea', b('KFC', 'kfckorea.com', '#E4002B', '식비', ['케이에프씨', '케이에프씨코리아'])),
  withApp('com.nbbmobileorder.shinsegaefood', b('노브랜드버거', 'shinsegaefood.com', '#FFD400', '식비', ['노브랜드 버거'])),
  withApp('com.frankfnb.frankburger', b('프랭크버거', 'frankburger.co.kr', '#E2231A', '식비', ['프랭크 버거', 'frankburger'])),
  withApp('kr.co.d2.dominos', b('도미노피자', 'dominos.co.kr', '#006491', '식비', ['도미노', 'dominos'])),
  withApp('com.pizzahut.android', b('피자헛', 'pizzahut.co.kr', '#EE3A43', '식비', ['pizzahut'])),
  withApp('kr.co.genesiskorea.bbqchicken', b('BBQ', 'bbq.co.kr', '#E4002B', '식비', ['비비큐', 'bbq치킨', '제너시스비비큐'])),
  withApp('com.foodtechkorea.bhc', b('bhc', 'bhc.co.kr', '#E31837', '식비', ['비에이치씨', 'bhc치킨'])),
  withApp('kr.co.goobne.chicken', b('굽네치킨', 'goobne.co.kr', '#E60012', '식비', ['굽네', 'goobne'])),
  withApp('co.kr.bonif.bonmembership', b('본죽', 'bonif.co.kr', '#8C1D18', '식비', ['본죽&비빔밥', '본도시락', '본아이에프'])),
  // 교통
  withApp('com.kakao.taxi', b('카카오T', 'kakaomobility.com', '#FEE500', '교통', ['카카오택시', '카카오모빌리티', 'kakaot'], 'T')),
  withApp('com.lgt.tmoney', b('티머니', 'tmoney.co.kr', '#E6007E', '교통', ['tmoney', '교통카드'])),
  withApp('com.korail.talk', b('코레일', 'letskorail.com', '#004EA2', '교통', ['korail', '한국철도'])),
  withApp('kr.co.srail.newapp', b('SRT', 'etk.srail.kr', '#5B2C83', '교통', ['에스알', '수서고속철도'])),
  withApp('socar.Socar', b('쏘카', 'socar.kr', '#00B8FF', '교통', ['socar'])),
  withApp('com.skt.tmap.ku', b('티맵', 'tmapmobility.com', '#3D6AFE', '교통', ['tmap', 't맵', '티맵모빌리티'])),
  // 문화·여가·구독
  withApp('com.cultsotry.yanolja.nativeapp', b('야놀자', 'yanolja.com', '#FF3478', '문화/여가', ['yanolja', '놀유니버스'])),
  withApp('kr.goodchoice.abouthere', b('여기어때', 'goodchoice.kr', '#F7323F', '문화/여가', ['goodchoice', '여기어때컴퍼니'])),
  withApp('co.kr.cgv.cjcgv', b('CGV', 'cgv.co.kr', '#E71A0F', '문화/여가', ['씨지브이'])),
  withApp('com.megabox.mop', b('메가박스', 'megabox.co.kr', '#503396', '문화/여가', ['megabox'])),
  withApp('kr.co.lottecinema.lcm', b('롯데시네마', 'lottecinema.co.kr', '#ED1C24', '문화/여가', ['lottecinema'])),
  withApp('com.netflix.mediaclient', b('넷플릭스', 'netflix.com', '#E50914', '문화/여가', ['netflix'], 'N')),
  withApp('com.google.android.youtube', b('유튜브', 'youtube.com', '#FF0000', '문화/여가', ['youtube', '유튜브프리미엄', 'google*youtube'])),
  withApp('mok.android', b('교보문고', 'kyobobook.co.kr', '#4A2C82', '교육', ['kyobo'])),
  // 통신
  withApp('com.sktelecom.minit', b('SKT', 'tworld.co.kr', '#EA002C', '주거/통신', ['sk텔레콤', 'sktelecom'])),
  withApp('com.ktshow.cs', b('KT', 'kt.com', '#E60012', '주거/통신', ['케이티'])),
  withApp('com.lguplus.mobile.cs', b('LG U+', 'lguplus.com', '#E6007E', '주거/통신', ['lgu+', '엘지유플러스', 'lg유플러스'], 'U+')),
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

/** 로고 이미지 주소들 (앞에서부터 써 보고, 안 되면 다음): 앱에 넣어 둔 공식 앱 아이콘 → 홈페이지 아이콘 */
export function logoUrls(brand: Brand): string[] {
  const favicon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(brand.domain)}&sz=128`
  if (brand.app) return [`/brands/${brand.app}.webp`, favicon]
  if (brand.wiki) return [`/brands/${brand.domain}.png`, favicon]
  return [favicon]
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

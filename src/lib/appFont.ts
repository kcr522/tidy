/**
 * 앱 글꼴 고르기 (사용자 요청 2026-11-25)
 * 많이 쓰는 무료 한글 글꼴 5개 중에서 고르면 앱 전체(웹 · 폰 앱) 글씨가 바뀐다.
 * - 기본은 지금처럼 앱에 들어 있는 Pretendard. 다른 글꼴은 앱에 넣지 않고(앱 크기 그대로) 고를 때 인터넷에서 받는다
 * - 구글 폰트는 CSS 를 받아 이름만 'Tidy Font' 로 바꾼다 (글자 묶음별 조각이라 화면에 나온 글자의 조각만 받는다)
 * - 나머지는 jsDelivr 의 굵기별 파일로 @font-face 를 직접 만든다 (쓰는 굵기만 받는다)
 * - 받은 CSS 는 이 기기에 저장해 두고, 글꼴 파일은 웹은 서비스 워커(tidy-fonts), 폰 앱은 WebView 캐시에 남는다
 * - 인터넷이 안 될 때 처음 고르면 받을 때까지 Pretendard 로 보인다
 * 이 기기에만 저장한다 (localStorage 'tidy-font').
 */

export interface FontFile {
  /** 굵기 하나(400) 또는 범위('600 800') */
  weight: string
  url: string
}

export interface AppFont {
  id: string
  name: string
  /** 어떤 글꼴인지 한 줄 */
  desc: string
  /** 구글 폰트 CSS 주소 (글자 묶음별 조각이라 쓰는 글자만 받는다) */
  css?: string
  /** 구글 폰트에 없는 글꼴: 굵기별 파일 (jsDelivr) */
  faces?: FontFile[]
}

const JSD = 'https://cdn.jsdelivr.net'
const NSN = `${JSD}/npm/nanumsquareneo@0.0.5/woff2/NanumSquareNeoTTF-`
const GM = `${JSD}/gh/projectnoonnu/noonfonts_2001@1.1/GmarketSans`
const SC = `${JSD}/gh/projectnoonnu/noonfonts_six@1.2/S-CoreDream-`
const SP = `${JSD}/npm/spoqa-han-sans@3.3.0/Subset/SpoqaHanSansNeo/SpoqaHanSansNeo-`

export const DEFAULT_FONT = 'pretendard'

/** 많이 쓰는 무료 한글 글꼴 (사용자 요청 2026-11-25: 여러 개 말고 인기 글꼴로) */
export const APP_FONTS: AppFont[] = [
  { id: DEFAULT_FONT, name: 'Pretendard', desc: '기본 · 요즘 앱에서 가장 많이 써요' },
  { id: 'noto-sans-kr', name: 'Noto Sans KR', desc: '구글 기본 한글 · 어디서나 무난해요', css: 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap' },
  {
    id: 'nanum-square-neo',
    name: '나눔스퀘어 네오',
    desc: '네이버 · 반듯하고 또렷해요',
    faces: [
      { weight: '300', url: `${NSN}aLt.woff2` },
      { weight: '400 500', url: `${NSN}bRg.woff2` },
      { weight: '600 700', url: `${NSN}cBd.woff2` },
      { weight: '800', url: `${NSN}dEb.woff2` },
      { weight: '900', url: `${NSN}eHv.woff2` },
    ],
  },
  {
    id: 'gmarket-sans',
    name: 'G마켓 산스',
    desc: '광고 · 배너에서 자주 보는 글꼴',
    faces: [
      { weight: '300', url: `${GM}Light.woff` },
      { weight: '400 500', url: `${GM}Medium.woff` },
      { weight: '600 900', url: `${GM}Bold.woff` },
    ],
  },
  {
    id: 's-core-dream',
    name: '에스코어 드림',
    desc: '가늘고 세련된 느낌',
    faces: [
      { weight: '300', url: `${SC}3Light.woff` },
      { weight: '400', url: `${SC}4Regular.woff` },
      { weight: '500', url: `${SC}5Medium.woff` },
      { weight: '600 700', url: `${SC}6Bold.woff` },
      { weight: '800 900', url: `${SC}7ExtraBold.woff` },
    ],
  },
  {
    id: 'spoqa-han-sans-neo',
    name: '스포카 한 산스 네오',
    desc: '숫자가 깔끔해서 앱 화면에 많이 써요',
    faces: [
      { weight: '300', url: `${SP}Light.woff2` },
      { weight: '400', url: `${SP}Regular.woff2` },
      { weight: '500', url: `${SP}Medium.woff2` },
      { weight: '600 900', url: `${SP}Bold.woff2` },
    ],
  },
]

export const fontById = (id: string | null | undefined) => APP_FONTS.find((f) => f.id === id)

const KEY = 'tidy-font'
const CSS_KEY = 'tidy-font-css'
const FAMILY = 'Tidy Font'
const STYLE_ID = 'tidy-font-face'
const FALLBACK = '"Pretendard Variable", "Pretendard", -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif'

export function getFontId(): string {
  try {
    const v = localStorage.getItem(KEY)
    if (fontById(v)) return v!
  } catch {
    // 저장소를 못 쓰면 기본
  }
  return DEFAULT_FONT
}

/**
 * 받은 구글 폰트 CSS 를 앱에서 쓸 모양으로 바꾼다
 * - 글꼴 이름을 family 로, 상대 주소는 CSS 주소 기준 절대 주소로
 * - local() 은 뺀다 (기기에 깔린 다른 판이 섞이지 않게)
 */
export function rewriteFontCss(css: string, base: string, family: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/font-family\s*:\s*[^;}]+/g, `font-family: '${family}'`)
    .replace(/local\((['"]?)[^)]*\1\)\s*,\s*/g, '')
    .replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, _q, u: string) => `url('${new URL(u, base).href}')`)
    .replace(/font-display\s*:\s*[^;}]+;?/g, '')
    .replace(/@font-face\s*{/g, '@font-face { font-display: swap;')
}

/** 굵기별 파일로 @font-face 를 만든다 */
export function facesCss(faces: FontFile[], family: string): string {
  return faces
    .map((f) => `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${f.weight}; font-display: swap; src: url('${f.url}') format('${f.url.endsWith('.woff2') ? 'woff2' : 'woff'}'); }`)
    .join('\n')
}

function putStyle(id: string, css: string) {
  let el = document.getElementById(id) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = id
    document.head.appendChild(el)
  }
  el.textContent = css
}

function readCachedCss(id: string): string | null {
  try {
    const raw = localStorage.getItem(CSS_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { id?: string; css?: string }
    return v.id === id && typeof v.css === 'string' ? v.css : null
  } catch {
    return null
  }
}

async function fetchCss(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`글꼴 CSS ${res.status}`)
  return res.text()
}

/** 글꼴 하나의 @font-face CSS (구글 폰트면 받아 온다) */
async function fontCss(font: AppFont, family: string, text?: string): Promise<string> {
  if (font.faces) return facesCss(font.faces, family)
  if (!font.css) return ''
  // 견본 글씨는 그 글자만 담은 아주 작은 조각만 받는다
  const url = text ? `${font.css}&text=${encodeURIComponent([...new Set(text)].join(''))}` : font.css
  return rewriteFontCss(await fetchCss(url), url, family)
}

function setRoot(font: AppFont | undefined) {
  const root = document.documentElement
  if (!font || font.id === DEFAULT_FONT) {
    root.style.removeProperty('--font-sans')
    delete root.dataset.font
    return
  }
  root.style.setProperty('--font-sans', `'${FAMILY}', ${FALLBACK}`)
  root.dataset.font = font.id
}

let loading = 0

/** 글꼴을 앱 전체에 입힌다. 저장해 둔 CSS 가 있으면 바로, 없으면 받아서 */
export async function applyFont(id: string): Promise<void> {
  const font = fontById(id)
  const turn = ++loading
  if (!font || font.id === DEFAULT_FONT) {
    putStyle(STYLE_ID, '')
    setRoot(undefined)
    return
  }
  const cached = readCachedCss(font.id)
  if (cached) {
    putStyle(STYLE_ID, cached)
    setRoot(font)
  }
  try {
    const css = await fontCss(font, FAMILY)
    if (turn !== loading) return
    putStyle(STYLE_ID, css)
    // 본문 굵기 파일을 받을 때까지 기다렸다가 바꾼다 (글씨가 번쩍 바뀌지 않게)
    await document.fonts?.load(`400 16px '${FAMILY}'`, '가1').catch(() => [])
    if (turn !== loading) return
    setRoot(font)
    try {
      localStorage.setItem(CSS_KEY, JSON.stringify({ id: font.id, css }))
    } catch {
      // 저장 못 해도 지금은 쓸 수 있다
    }
  } catch (e) {
    // 인터넷이 안 되면 저장해 둔 것으로 (없으면 기본 글꼴 그대로)
    if (!cached) throw e
  }
}

/** 고른 글꼴을 저장하고 입힌다 */
export async function setFont(id: string): Promise<void> {
  const font = fontById(id) ?? fontById(DEFAULT_FONT)!
  try {
    localStorage.setItem(KEY, font.id)
  } catch {
    // 이 기기에만 저장하는데 못 하면 이번에만 바뀐다
  }
  await applyFont(font.id)
}

/** 앱을 켤 때: 저장해 둔 글꼴을 입힌다 (실패하면 조용히 기본 글꼴) */
export function initFont() {
  const id = getFontId()
  if (id !== DEFAULT_FONT) void applyFont(id).catch(() => {})
}

/** 미리보기 이름 (글꼴마다 따로) */
export const previewFamily = (id: string) => `Tidy Preview ${id}`

const previewed = new Set<string>()

/** 고르기 화면의 견본 글씨용 글꼴을 넣는다 */
export async function loadPreviewFont(font: AppFont, text: string): Promise<void> {
  if (font.id === DEFAULT_FONT || previewed.has(font.id)) return
  previewed.add(font.id)
  try {
    putStyle(`tidy-font-preview-${font.id}`, await fontCss(font, previewFamily(font.id), text))
  } catch {
    previewed.delete(font.id)
  }
}

/** 견본 글씨에 쓸 font-family */
export const previewStack = (font: AppFont) => (font.id === DEFAULT_FONT ? FALLBACK : `'${previewFamily(font.id)}', ${FALLBACK}`)

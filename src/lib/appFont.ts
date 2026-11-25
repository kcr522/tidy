/**
 * 앱 글꼴 고르기 (사용자 요청 2026-11-25)
 * 무료(OFL) 한글 글꼴 12개를 종류별로 나눠 두고, 설정에서 고르면 앱 전체(웹 · 폰 앱) 글씨가 바뀐다.
 * - 기본은 지금처럼 앱에 들어 있는 Pretendard. 다른 글꼴은 앱에 넣지 않고(앱 크기 그대로) 고를 때 인터넷에서 받는다
 * - 구글 폰트 / jsDelivr 의 글꼴 CSS 를 받아서 이름을 'Tidy Font' 로 바꾸고 크기 맞춤(size-adjust)을 넣는다
 *   구글 폰트는 글자 묶음마다 조각 파일로 나뉘어 있어서, 화면에 나온 글자의 조각만 받는다
 * - 받은 CSS 는 이 기기에 저장해 두고, 글꼴 파일은 웹은 서비스 워커(tidy-fonts), 폰 앱은 WebView 캐시에 남는다
 * - 인터넷이 안 될 때 처음 고르면 받을 때까지 Pretendard 로 보인다
 * 이 기기에만 저장한다 (localStorage 'tidy-font').
 */

export type FontKind = 'basic' | 'round' | 'mood' | 'cute' | 'hand'

export interface AppFont {
  id: string
  name: string
  kind: FontKind
  /** 글꼴 CSS 주소 */
  css: string
  /** 구글 폰트면 미리보기 글자만 담은 작은 조각을 받을 수 있다 (&text=) */
  google?: boolean
  /** 같은 크기에서 작아 보이는 손글씨를 키운다 (%) */
  size?: number
  /** 굵기가 하나뿐인 글꼴: 굵은 글씨를 억지로 두껍게 만들지 않는다 (번져 보여서) */
  oneWeight?: boolean
}

export const FONT_KINDS: { kind: FontKind; label: string; desc: string }[] = [
  { kind: 'basic', label: '깔끔한 기본형', desc: '반듯하고 숫자가 잘 읽혀요' },
  { kind: 'round', label: '둥글고 부드러운', desc: '모서리가 동글동글, 순한 느낌' },
  { kind: 'mood', label: '분위기 있는', desc: '책 같거나 독특한 모양' },
  { kind: 'cute', label: '귀엽고 굵은', desc: '통통하고 눈에 잘 띄어요' },
  { kind: 'hand', label: '손글씨', desc: '직접 쓴 다이어리 느낌' },
]

const g = (family: string) => `https://fonts.googleapis.com/css2?family=${family}&display=swap`

export const DEFAULT_FONT = 'pretendard'

export const APP_FONTS: AppFont[] = [
  { id: DEFAULT_FONT, name: 'Pretendard (기본)', kind: 'basic', css: '' },
  { id: 'suit', name: 'SUIT', kind: 'basic', css: 'https://cdn.jsdelivr.net/npm/@sun-typeface/suit@2.0.5/fonts/static/woff2/SUIT.css' },
  { id: 'ibm-plex', name: 'IBM Plex Sans KR', kind: 'basic', css: g('IBM+Plex+Sans+KR:wght@300;400;500;600;700'), google: true },
  { id: 'nanum-square-round', name: '나눔스퀘어라운드', kind: 'round', css: 'https://cdn.jsdelivr.net/npm/@kfonts/nanum-square-round@0.2.0/index.css' },
  { id: 'gowun-dodum', name: '고운돋움', kind: 'round', css: g('Gowun+Dodum'), google: true, oneWeight: true },
  { id: 'orbit', name: '오르빗', kind: 'mood', css: g('Orbit'), google: true, oneWeight: true },
  { id: 'gowun-batang', name: '고운바탕', kind: 'mood', css: g('Gowun+Batang:wght@400;700'), google: true },
  { id: 'jua', name: '주아', kind: 'cute', css: g('Jua'), google: true, oneWeight: true },
  { id: 'do-hyeon', name: '도현', kind: 'cute', css: g('Do+Hyeon'), google: true, oneWeight: true },
  { id: 'gaegu', name: '개구', kind: 'hand', css: g('Gaegu:wght@300;400;700'), google: true, size: 112 },
  { id: 'nanum-pen', name: '나눔펜', kind: 'hand', css: g('Nanum+Pen+Script'), google: true, size: 128, oneWeight: true },
  { id: 'hi-melody', name: '하이멜로디', kind: 'hand', css: g('Hi+Melody'), google: true, size: 118, oneWeight: true },
  { id: 'gamja-flower', name: '감자꽃', kind: 'hand', css: g('Gamja+Flower'), google: true, size: 112, oneWeight: true },
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
 * 받은 글꼴 CSS 를 앱에서 쓸 모양으로 바꾼다
 * - 글꼴 이름을 family 로 (원래 이름이 무엇이든)
 * - ./파일 같은 상대 주소를 CSS 주소 기준 절대 주소로
 * - local() 은 뺀다 (기기에 깔린 다른 판이 섞이지 않게)
 * - 크기 맞춤과 font-display: swap 을 넣는다
 */
export function rewriteFontCss(css: string, base: string, family: string, size = 100): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/font-family\s*:\s*[^;}]+/g, `font-family: '${family}'`)
    .replace(/local\((['"]?)[^)]*\1\)\s*,\s*/g, '')
    .replace(/url\((['"]?)([^'")]+)\1\)/g, (_m, _q, u: string) => `url('${new URL(u, base).href}')`)
    .replace(/font-display\s*:\s*[^;}]+;?/g, '')
    .replace(/@font-face\s*{/g, `@font-face { font-display: swap;${size !== 100 ? ` size-adjust: ${size}%;` : ''}`)
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

function setRoot(font: AppFont | undefined) {
  const root = document.documentElement
  if (!font || font.id === DEFAULT_FONT) {
    root.style.removeProperty('--font-sans')
    root.style.removeProperty('font-synthesis-weight')
    delete root.dataset.font
    return
  }
  root.style.setProperty('--font-sans', `'${FAMILY}', ${FALLBACK}`)
  if (font.oneWeight) root.style.setProperty('font-synthesis-weight', 'none')
  else root.style.removeProperty('font-synthesis-weight')
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
    const css = rewriteFontCss(await fetchCss(font.css), font.css, FAMILY, font.size)
    if (turn !== loading) return
    putStyle(STYLE_ID, css)
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

/**
 * 고르기 화면의 견본 글씨용 글꼴을 받는다.
 * 구글 폰트는 견본 글자만 담은 아주 작은 파일(&text=)만 받는다
 */
export async function loadPreviewFont(font: AppFont, text: string): Promise<void> {
  if (!font.css || previewed.has(font.id)) return
  previewed.add(font.id)
  const url = font.google ? `${font.css}&text=${encodeURIComponent([...new Set(text)].join(''))}` : font.css
  try {
    const css = rewriteFontCss(await fetchCss(url), url, previewFamily(font.id), font.size)
    putStyle(`tidy-font-preview-${font.id}`, css)
  } catch {
    previewed.delete(font.id)
  }
}

/** 견본 글씨에 쓸 font-family */
export const previewStack = (font: AppFont) => (font.id === DEFAULT_FONT ? FALLBACK : `'${previewFamily(font.id)}', ${FALLBACK}`)

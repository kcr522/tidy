/**
 * 꾸미기 (사용자 요청 2026-11-10)
 * 앱 배경과 구역(대시보드, 가계부, 할 일, 스크랩)마다:
 * - 색: 랜덤(켤 때마다 바뀜) 또는 색깔표에서 고른 색으로 고정 (앱 배경은 '기본'도 있다)
 * - 사진: 고른 사진을 배경으로 (구역은 그라데이션 자리에, 앱 배경은 화면 전체에)
 * - 투명도: 0% = 또렷하게, 100% = 안 보이게
 * 이 기기에만 저장한다. 설정은 localStorage, 사진은 IndexedDB (customPhotos.ts).
 * 사진은 구역마다 여러 장 넣을 수 있고, 앱을 켤 때마다 그중 한 장을 고른다.
 */
import type { Section, Theme, Trio } from './palette'
import { isPhotoRef, photoSrc } from './customPhotos'
import { toDecodable } from './heic'
import { SECTIONS, textOn } from './palette'
import type { PhotoPalette } from './photoPalette'

export type ColorChoice = 'default' | 'random' | 'fixed'
/** 사진 맞춤: cover = 칸을 꽉 채움(넘치는 곳은 잘림) / contain = 사진 전체가 보이게(안 잘림, 남는 곳은 색으로) */
export type PhotoFit = 'cover' | 'contain'
/** 꽉 채울 때 사진의 어느 쪽을 보여 줄지 */
export type PhotoPos = 'top' | 'center' | 'bottom'

/**
 * 사진 위치 직접 맞추기 (사용자 요청 2026-11-18): 캐릭터가 원하는 곳에 보이게 사진을 끌어 옮기고 키운다.
 * x, y = 보여 줄 곳의 가운데 (사진 너비·높이에 대한 비율 0~1), zoom = 꽉 채운 크기의 몇 배 (1~4),
 * aspect = 맞출 때 칸 모양(가로/세로). 맞춘 부분은 잘라 낸 사진(crop)으로 따로 보관해서 어느 칸에서든 그대로 쓴다.
 */
export interface PhotoFrame {
  x: number
  y: number
  zoom: number
  aspect: number
  crop: string
}
export const MAX_ZOOM = 4

export interface SectionStyle {
  color: 'random' | 'fixed'
  colors: Trio
  /** 사진 이름들 ('idb:…' 또는 예전 data:image). 여러 장이면 켤 때마다 한 장을 고른다 */
  photos: string[]
  fit: PhotoFit
  pos: PhotoPos
  /** 원래 사진 이름 → 직접 맞춘 위치 */
  frames: Record<string, PhotoFrame>
  /** 사진 투명도 % (높을수록 사진이 옅어지고 그라데이션 색이 보인다) */
  clear: number
}

export interface BackgroundStyle {
  color: ColorChoice
  /** 고정 색 (하나) */
  fixed: string
  photos: string[]
  fit: PhotoFit
  pos: PhotoPos
  frames: Record<string, PhotoFrame>
  /** 색이나 사진의 투명도 % */
  clear: number
  /** 카드 투명도 % (배경이 카드 뒤로 비치는 정도) */
  cardClear: number
}

/** 완료 체크 표시 색 (할 일, 습관) */
export interface CheckStyle {
  /** section: 그 구역 그라데이션 그대로 / fixed: 고른 색 하나 */
  color: 'section' | 'fixed'
  fixed: string
}

/**
 * 시작 화면 (사용자 요청 2026-11-10): 앱을 켜면 고른 사진을 잘리지 않게 잠깐 보여 주고 저절로 넘어간다.
 * 사진 색 맞추기를 켜면 그날 고른 사진에서 뽑은 색으로 앱 바탕과 구역 색을 맞춘다.
 */
export interface SplashStyle {
  photos: string[]
  /** 보여 주는 시간 (초) */
  seconds: number
  matchColors: boolean
  /** 사진이 없을 때 기본 시작 화면(그날 랜덤 색 + 로고)을 잠깐 보여 줄지 */
  basic: boolean
  /** 사진 이름 → 뽑아 둔 색 (켤 때 사진을 다시 읽지 않아도 되게) */
  palettes: Record<string, PhotoPalette>
  /** 사진 위 TIDY: 로고 자리 (사용자 요청 2026-11-18: 아래로 밀려나지 않게, 자리를 고르게) */
  logoPos: SplashLogoPos
  /** 사진 위 로고 투명도 (%). 높을수록 사진이 비쳐 보인다 */
  logoClear: number
  /** 사진 위 로고가 나타나고 사라지는 효과 (사용자 요청 2026-11-18) */
  logoFx: SplashLogoFx
}

export type SplashLogoFx = 'none' | 'fade' | 'zoom' | 'rise' | 'blur' | 'letters' | 'shine'
export const SPLASH_LOGO_FX: [SplashLogoFx, string][] = [
  ['blur', '흐림 걷히기'],
  ['fade', '서서히'],
  ['zoom', '커졌다 작아지기'],
  ['rise', '떠오르기'],
  ['letters', '한 글자씩'],
  ['shine', '빛 지나가기'],
  ['none', '효과 없음'],
]

export type SplashLogoPos = 'top' | 'center' | 'bottom' | 'hide'
export const SPLASH_LOGO_POS: [SplashLogoPos, string][] = [
  ['top', '위'],
  ['center', '가운데'],
  ['bottom', '아래'],
  ['hide', '숨기기'],
]
/** 로고 투명도 최대값 (이보다 높으면 거의 안 보여서) */
export const SPLASH_LOGO_CLEAR_MAX = 90

export interface Customization {
  background: BackgroundStyle
  sections: Record<Section, SectionStyle>
  check: CheckStyle
  splash: SplashStyle
  /** 모든 메뉴(가계부, 할 일, 일기, 캘린더, 스크랩, 설정)를 대시보드와 같은 색으로 (사용자 요청 2026-11-16) */
  sameColor: boolean
}

const KEY = 'tidy-customize'
const EVENT = 'tidy:customize'

export const DEFAULT_CHECK: CheckStyle = { color: 'section', fixed: '#34c759' }
/** 구역마다 넣을 수 있는 사진 수 */
export const MAX_PHOTOS = 10

export const DEFAULT_SPLASH: SplashStyle = { photos: [], seconds: 2, matchColors: true, basic: true, palettes: {}, logoPos: 'center', logoClear: 50, logoFx: 'blur' }
/**
 * 기본 시작 화면은 앱을 누른 때부터 이 시간(ms)까지 보인다. 앱이 느려 보이지 않게 짧게.
 * 앱을 읽는 데 걸린 시간도 여기에 들어가서, 화면이 늦게 뜬 만큼 시작 화면은 짧아진다
 */
export const BASIC_SPLASH_MS = 1100
/** 그래도 시작 화면이 떴으면 이만큼(ms)은 보여 준다 (번쩍하고 사라지지 않게) */
export const BASIC_SPLASH_MIN_MS = 450

/** 기본 시작 화면을 앞으로 몇 ms 더 보여 줄지. now = 앱을 누른 뒤 지난 시간(ms) */
export const basicSplashDelay = (now: number) => Math.max(BASIC_SPLASH_MIN_MS, BASIC_SPLASH_MS - now)
export const SPLASH_SECONDS = [1, 2, 3, 5] as const

export const DEFAULT_BACKGROUND: BackgroundStyle = { color: 'default', fixed: '#c9e7ff', photos: [], fit: 'cover', pos: 'center', frames: {}, clear: 70, cardClear: 0 }
export const defaultSection = (colors: Trio = ['#4fd1ff', '#3b82f6', '#7c3aed']): SectionStyle => ({
  color: 'random',
  colors,
  photos: [],
  fit: 'cover',
  pos: 'center',
  frames: {},
  clear: 35,
})

export function defaultCustomization(): Customization {
  return {
    background: { ...DEFAULT_BACKGROUND, frames: {} },
    sections: Object.fromEntries(SECTIONS.map((s) => [s, defaultSection()])) as Record<Section, SectionStyle>,
    check: { ...DEFAULT_CHECK },
    splash: { ...DEFAULT_SPLASH, palettes: {} },
    sameColor: true,
  }
}

const clamp = (n: unknown, min: number, max: number, fallback: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v)
const readFit = (v: unknown): PhotoFit => (v === 'contain' ? 'contain' : 'cover')
const readPos = (v: unknown): PhotoPos => (v === 'top' || v === 'bottom' ? v : 'center')

/** 사진 목록 읽기 (예전 한 장짜리 photo 도 받아 준다) */
const readPhotos = (v: Record<string, unknown>): string[] => {
  const list = Array.isArray(v.photos) ? v.photos : v.photo ? [v.photo] : []
  return [...new Set(list.filter(isPhotoRef))].slice(0, MAX_PHOTOS)
}

const num = (v: unknown, min: number, max: number) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max

/** 맞춘 위치 읽기. 목록에 있는 사진 것만, 틀린 값은 버린다 */
export function readFrames(v: unknown, photos: string[]): Record<string, PhotoFrame> {
  const out: Record<string, PhotoFrame> = {}
  if (!v || typeof v !== 'object') return out
  for (const ref of photos) {
    const f = (v as Record<string, Partial<PhotoFrame> | undefined>)[ref]
    if (f && num(f.x, 0, 1) && num(f.y, 0, 1) && num(f.zoom, 1, MAX_ZOOM) && num(f.aspect, 0.2, 5) && isPhotoRef(f.crop))
      out[ref] = { x: f.x!, y: f.y!, zoom: f.zoom!, aspect: f.aspect!, crop: f.crop! }
  }
  return out
}

/** 저장된 값을 읽는다. 틀린 값은 기본값으로 */
export function parseCustomization(raw: unknown): Customization {
  const base = defaultCustomization()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<Record<keyof Customization, Record<string, unknown>>>
  const b = (r.background ?? {}) as Record<string, unknown>
  const bgPhotos = readPhotos(b)
  base.background = {
    color: b.color === 'random' || b.color === 'fixed' ? b.color : 'default',
    fixed: isHex(b.fixed) ? b.fixed : DEFAULT_BACKGROUND.fixed,
    photos: bgPhotos,
    fit: readFit(b.fit),
    pos: readPos(b.pos),
    frames: readFrames(b.frames, bgPhotos),
    clear: clamp(b.clear, 0, 100, DEFAULT_BACKGROUND.clear),
    cardClear: clamp(b.cardClear, 0, 70, 0),
  }
  base.sameColor = (raw as { sameColor?: unknown }).sameColor !== false
  const ch = (r.check ?? {}) as Record<string, unknown>
  base.check = { color: ch.color === 'fixed' ? 'fixed' : 'section', fixed: isHex(ch.fixed) ? ch.fixed : DEFAULT_CHECK.fixed }
  const sp = (r.splash ?? {}) as Record<string, unknown>
  const splashPhotos = readPhotos(sp)
  const rawPal = sp.palettes && typeof sp.palettes === 'object' ? (sp.palettes as Record<string, unknown>) : {}
  const palettes: Record<string, PhotoPalette> = {}
  for (const ref of splashPhotos) {
    const v = rawPal[ref] as Partial<PhotoPalette> | undefined
    if (v && isHex(v.bg) && Array.isArray(v.colors) && v.colors.length === 3 && v.colors.every(isHex)) palettes[ref] = { bg: v.bg, colors: v.colors as Trio }
  }
  base.splash = {
    photos: splashPhotos,
    seconds: (SPLASH_SECONDS as readonly number[]).includes(sp.seconds as number) ? (sp.seconds as number) : DEFAULT_SPLASH.seconds,
    matchColors: sp.matchColors !== false,
    basic: sp.basic !== false,
    palettes,
    logoPos: SPLASH_LOGO_POS.some(([k]) => k === sp.logoPos) ? (sp.logoPos as SplashLogoPos) : DEFAULT_SPLASH.logoPos,
    logoClear: clamp(sp.logoClear, 0, SPLASH_LOGO_CLEAR_MAX, DEFAULT_SPLASH.logoClear),
    logoFx: SPLASH_LOGO_FX.some(([k]) => k === sp.logoFx) ? (sp.logoFx as SplashLogoFx) : DEFAULT_SPLASH.logoFx,
  }
  const secs = (r.sections ?? {}) as Record<string, Record<string, unknown> | undefined>
  for (const s of SECTIONS) {
    const v = secs[s]
    if (!v) continue
    const colors = Array.isArray(v.colors) && v.colors.length === 3 && v.colors.every(isHex) ? (v.colors as Trio) : base.sections[s].colors
    const photos = readPhotos(v)
    base.sections[s] = {
      color: v.color === 'fixed' ? 'fixed' : 'random',
      colors,
      photos,
      fit: readFit(v.fit),
      pos: readPos(v.pos),
      frames: readFrames(v.frames, photos),
      clear: clamp(v.clear, 0, 100, 35),
    }
  }
  return base
}

export function loadCustomization(): Customization {
  try {
    const text = localStorage.getItem(KEY)
    return parseCustomization(text ? JSON.parse(text) : null)
  } catch {
    return defaultCustomization()
  }
}

/** 저장하고 화면에 바로 반영한다. 공간이 모자라면(사진이 너무 크면) 에러를 던진다 */
export function saveCustomization(c: Customization) {
  localStorage.setItem(KEY, JSON.stringify(c))
  window.dispatchEvent(new CustomEvent(EVENT))
}

/** 꾸미기에 쓰인 모든 사진 이름 */
export function photoRefs(c: Customization): string[] {
  const areas = [c.background, ...SECTIONS.map((s) => c.sections[s])]
  return [...areas.flatMap((a) => [...a.photos, ...Object.values(a.frames).map((f) => f.crop)]), ...c.splash.photos]
}

/** 화면에 쓸 사진: 위치를 맞춘 사진이면 잘라 낸 사진, 아니면 원래 사진 */
const framedPhoto = (area: { photos: string[]; frames: Record<string, PhotoFrame> }, key: string) => {
  const ref = sessionPhoto(area.photos, key)
  return { ref: ref ? (area.frames[ref]?.crop ?? ref) : null, framed: !!ref && !!area.frames[ref] }
}

/** 켤 때 구역마다 정한 무작위 수. 같은 화면에서는 같은 사진이 계속 보인다 */
const sessionPick = new Map<string, number>()
/** 이번에 보여 줄 사진 한 장 */
export function sessionPhoto(list: string[], key: string, random: () => number = Math.random): string | null {
  if (list.length === 0) return null
  if (!sessionPick.has(key)) sessionPick.set(key, random())
  return list[Math.floor(sessionPick.get(key)! * list.length) % list.length]
}

export function onCustomizationChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

/** 이번에 켤 때 보여 줄 시작 화면 사진 (없으면 null) */
export function splashPhoto(c: Customization): string | null {
  return sessionPhoto(c.splash.photos, 'splash')
}

/**
 * 시작 화면 사진 색 맞추기: 그 사진에서 뽑은 색으로 구역 색(모두)과 앱 바탕을 바꾼 꾸미기 값을 돌려준다.
 * 배경 사진을 넣었으면 배경은 그대로 둔다. 어두운 화면에서는 연한 바탕색이 눈부셔서 바탕은 바꾸지 않는다.
 */
export function withSplashColors(c: Customization, dark: boolean): Customization {
  const ref = splashPhoto(c)
  const pal = ref ? c.splash.palettes[ref] : undefined
  if (!c.splash.matchColors || !pal) return c
  const sections = Object.fromEntries(SECTIONS.map((s) => [s, { ...c.sections[s], color: 'fixed' as const, colors: pal.colors }])) as Record<Section, SectionStyle>
  const background =
    dark || c.background.photos.length > 0 ? c.background : { ...c.background, color: 'fixed' as const, fixed: pal.bg, clear: 0 }
  return { ...c, sections, background }
}

/**
 * 켤 때 고른 랜덤 색에, 고정한 구역 색을 덮어쓴다.
 * 모든 메뉴 같은 색이면 대시보드 색(랜덤이든 고정이든)을 모든 구역에 똑같이 쓴다.
 */
export function withFixedColors(theme: Theme, c: Customization): Theme {
  const sections = { ...theme.sections }
  for (const s of SECTIONS) {
    if (c.sections[s].color === 'fixed') sections[s] = { colors: c.sections[s].colors, name: '내가 고른 색' }
  }
  if (c.sameColor) for (const s of SECTIONS) sections[s] = sections.main
  return { ...theme, sections }
}

const cssUrl = (data: string) => `url("${data.replace(/"/g, '%22')}")`

/** 사진, 투명도, 배경을 CSS 변수로 넣는다 (index.css의 bg-grad, body, card 가 읽는다) */
export function applyCustomization(c: Customization, theme: Theme, root: HTMLElement = document.documentElement) {
  for (const s of SECTIONS) {
    const st = c.sections[s]
    const shown = framedPhoto(st, s)
    const src = photoSrc(shown.ref)
    if (src) {
      root.style.setProperty(`--${s}-photo`, cssUrl(src))
      // 사진이 또렷할수록 그라데이션은 옅게
      root.style.setProperty(`--${s}-veil`, `${st.clear}%`)
      root.style.setProperty(`--${s}-photo-shadow`, '0 1px 3px rgb(0 0 0 / 0.35)')
      root.style.setProperty(`--${s}-photo-size`, st.fit)
      // 직접 맞춘 사진은 맞춘 곳이 가운데에 오게 잘라 두었다
      root.style.setProperty(`--${s}-photo-pos`, shown.framed ? 'center' : st.pos)
    } else {
      root.style.removeProperty(`--${s}-photo`)
      root.style.removeProperty(`--${s}-veil`)
      root.style.removeProperty(`--${s}-photo-shadow`)
      root.style.removeProperty(`--${s}-photo-size`)
      root.style.removeProperty(`--${s}-photo-pos`)
    }
  }

  const bg = c.background
  const alpha = 100 - bg.clear
  const page = 'var(--color-slate-100)'
  const layers: string[] = []
  const bgShown = framedPhoto(bg, 'background')
  const bgSrc = photoSrc(bgShown.ref)
  if (bgSrc) {
    // 사진 위에 바탕색을 덮어서 투명도를 낸다
    layers.push(`linear-gradient(color-mix(in srgb, ${page} ${bg.clear}%, transparent), color-mix(in srgb, ${page} ${bg.clear}%, transparent))`, cssUrl(bgSrc))
  } else if (bg.color === 'random') {
    const [a, b2, c3] = theme.sections.main.colors
    const mix = (x: string) => `color-mix(in srgb, ${x} ${alpha}%, ${page})`
    layers.push(`linear-gradient(var(--grad-angle), ${mix(a)}, ${mix(b2)} 52%, ${mix(c3)})`)
  } else if (bg.color === 'fixed') {
    const col = `color-mix(in srgb, ${bg.fixed} ${alpha}%, ${page})`
    layers.push(`linear-gradient(${col}, ${col})`)
  }
  if (bgSrc) {
    root.style.setProperty('--page-photo-size', bg.fit)
    root.style.setProperty('--page-photo-pos', bgShown.framed ? 'center' : bg.pos)
  } else {
    root.style.removeProperty('--page-photo-size')
    root.style.removeProperty('--page-photo-pos')
  }
  if (layers.length) root.style.setProperty('--page-image', layers.join(', '))
  else root.style.removeProperty('--page-image')
  root.style.setProperty('--card-clear', `${bg.cardClear}%`)

  // 체크 표시: 고른 색이면 그 색, 아니면 구역 그라데이션 (index.css의 bg-check)
  if (c.check.color === 'fixed') {
    root.style.setProperty('--check-image', `linear-gradient(${c.check.fixed}, ${c.check.fixed})`)
    root.style.setProperty('--check-on', textOn([c.check.fixed, c.check.fixed, c.check.fixed]))
  } else {
    root.style.removeProperty('--check-image')
    root.style.removeProperty('--check-on')
  }
  root.classList.toggle('has-page-image', layers.length > 0)
}

/** 고른 사진을 긴 쪽 2048px JPEG로 줄인다 (폰 화면에 충분히 또렷하고, 원본 수십 MB 사진도 넣을 수 있게) */
export async function shrinkPhoto(file: File, max = 2048): Promise<Blob> {
  const { source, width, height, done } = await decode(await toDecodable(file))
  try {
    const scale = Math.min(1, max / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    canvas.getContext('2d')!.drawImage(source, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진 변환 실패'))), 'image/jpeg', 0.85))
  } finally {
    done()
  }
}

const ASPECT_KEY = 'tidy-card-aspect'
/**
 * 대시보드에서 구역 사진이 크게 보이는 카드의 모양(가로/세로)을 기억해 둔다.
 * 사진 위치를 맞출 때 틀을 실제 카드와 같은 모양으로 보여 주려고. 카드 높이는 내용에 따라 바뀌어서 마지막 모양을 쓴다.
 */
export function rememberCardAspect(section: Section, width: number, height: number) {
  if (width < 50 || height < 50) return
  try {
    const all = JSON.parse(localStorage.getItem(ASPECT_KEY) || '{}') as Record<string, number>
    const wide = window.matchMedia('(min-width: 768px)').matches ? 'wide' : 'narrow'
    const v = Math.round((width / height) * 100) / 100
    if (all[`${section}:${wide}`] === v) return
    localStorage.setItem(ASPECT_KEY, JSON.stringify({ ...all, [`${section}:${wide}`]: v }))
  } catch {
    // 못 적어도 기본 모양으로 맞춘다
  }
}

/** 기억해 둔 카드 모양. 없으면 폰 4:3, 컴퓨터 4:5 */
export function cardAspect(section: Section): number {
  const wide = window.matchMedia('(min-width: 768px)').matches
  try {
    const v = (JSON.parse(localStorage.getItem(ASPECT_KEY) || '{}') as Record<string, unknown>)[`${section}:${wide ? 'wide' : 'narrow'}`]
    if (typeof v === 'number' && v >= 0.4 && v <= 4) return v
  } catch {
    // 기본 모양
  }
  return wide ? 4 / 5 : 4 / 3
}

/** 맞춘 위치에서 잘라 낼 네모 (원래 사진 픽셀). 칸 모양(aspect)으로 꽉 채운 크기를 zoom 배 키운 만큼 */
export function frameRect(w: number, h: number, f: Pick<PhotoFrame, 'x' | 'y' | 'zoom' | 'aspect'>) {
  const baseW = Math.min(w, h * f.aspect)
  const cw = baseW / f.zoom
  const ch = cw / f.aspect
  const cx = Math.min(w - cw / 2, Math.max(cw / 2, f.x * w))
  const cy = Math.min(h - ch / 2, Math.max(ch / 2, f.y * h))
  return { sx: cx - cw / 2, sy: cy - ch / 2, sw: cw, sh: ch, cx, cy }
}

/** 맞춘 부분만 잘라서 JPEG 로 (긴 쪽 최대 max px) */
export async function cropPhoto(src: string, f: Pick<PhotoFrame, 'x' | 'y' | 'zoom' | 'aspect'>, max = 2048): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = src
  })
  const r = frameRect(img.naturalWidth, img.naturalHeight, f)
  const scale = Math.min(1, max / Math.max(r.sw, r.sh))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(r.sw * scale))
  canvas.height = Math.max(1, Math.round(r.sh * scale))
  canvas.getContext('2d')!.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('사진 자르기 실패'))), 'image/jpeg', 0.9))
}

/** 사진 열기. createImageBitmap 이 큰 사진도 메모리를 덜 쓰고 회전 정보도 맞춰 준다. 안 되면 <img> 로 */
async function decode(file: Blob): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bmp, width: bmp.width, height: bmp.height, done: () => bmp.close() }
    } catch {
      // 아래 방법으로 다시
    }
  }
  const url = URL.createObjectURL(file)
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = url
  }).catch((err) => {
    URL.revokeObjectURL(url)
    throw err
  })
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) }
}

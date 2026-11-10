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

export type ColorChoice = 'default' | 'random' | 'fixed'
/** 사진 맞춤: cover = 칸을 꽉 채움(넘치는 곳은 잘림) / contain = 사진 전체가 보이게(안 잘림, 남는 곳은 색으로) */
export type PhotoFit = 'cover' | 'contain'
/** 꽉 채울 때 사진의 어느 쪽을 보여 줄지 */
export type PhotoPos = 'top' | 'center' | 'bottom'

export interface SectionStyle {
  color: 'random' | 'fixed'
  colors: Trio
  /** 사진 이름들 ('idb:…' 또는 예전 data:image). 여러 장이면 켤 때마다 한 장을 고른다 */
  photos: string[]
  fit: PhotoFit
  pos: PhotoPos
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

export interface Customization {
  background: BackgroundStyle
  sections: Record<Section, SectionStyle>
  check: CheckStyle
}

const KEY = 'tidy-customize'
const EVENT = 'tidy:customize'

export const DEFAULT_CHECK: CheckStyle = { color: 'section', fixed: '#34c759' }
/** 구역마다 넣을 수 있는 사진 수 */
export const MAX_PHOTOS = 10

export const DEFAULT_BACKGROUND: BackgroundStyle = { color: 'default', fixed: '#c9e7ff', photos: [], fit: 'cover', pos: 'center', clear: 70, cardClear: 0 }
export const defaultSection = (colors: Trio = ['#4fd1ff', '#3b82f6', '#7c3aed']): SectionStyle => ({
  color: 'random',
  colors,
  photos: [],
  fit: 'cover',
  pos: 'center',
  clear: 35,
})

export function defaultCustomization(): Customization {
  return {
    background: { ...DEFAULT_BACKGROUND },
    sections: Object.fromEntries(SECTIONS.map((s) => [s, defaultSection()])) as Record<Section, SectionStyle>,
    check: { ...DEFAULT_CHECK },
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

/** 저장된 값을 읽는다. 틀린 값은 기본값으로 */
export function parseCustomization(raw: unknown): Customization {
  const base = defaultCustomization()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<Record<keyof Customization, Record<string, unknown>>>
  const b = (r.background ?? {}) as Record<string, unknown>
  base.background = {
    color: b.color === 'random' || b.color === 'fixed' ? b.color : 'default',
    fixed: isHex(b.fixed) ? b.fixed : DEFAULT_BACKGROUND.fixed,
    photos: readPhotos(b),
    fit: readFit(b.fit),
    pos: readPos(b.pos),
    clear: clamp(b.clear, 0, 100, DEFAULT_BACKGROUND.clear),
    cardClear: clamp(b.cardClear, 0, 70, 0),
  }
  const ch = (r.check ?? {}) as Record<string, unknown>
  base.check = { color: ch.color === 'fixed' ? 'fixed' : 'section', fixed: isHex(ch.fixed) ? ch.fixed : DEFAULT_CHECK.fixed }
  const secs = (r.sections ?? {}) as Record<string, Record<string, unknown> | undefined>
  for (const s of SECTIONS) {
    const v = secs[s]
    if (!v) continue
    const colors = Array.isArray(v.colors) && v.colors.length === 3 && v.colors.every(isHex) ? (v.colors as Trio) : base.sections[s].colors
    base.sections[s] = {
      color: v.color === 'fixed' ? 'fixed' : 'random',
      colors,
      photos: readPhotos(v),
      fit: readFit(v.fit),
      pos: readPos(v.pos),
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
  return [...c.background.photos, ...SECTIONS.flatMap((s) => c.sections[s].photos)]
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

/** 켤 때 고른 랜덤 색에, 고정한 구역 색을 덮어쓴다 */
export function withFixedColors(theme: Theme, c: Customization): Theme {
  const sections = { ...theme.sections }
  for (const s of SECTIONS) {
    if (c.sections[s].color === 'fixed') sections[s] = { colors: c.sections[s].colors, name: '내가 고른 색' }
  }
  return { ...theme, sections }
}

const cssUrl = (data: string) => `url("${data.replace(/"/g, '%22')}")`

/** 사진, 투명도, 배경을 CSS 변수로 넣는다 (index.css의 bg-grad, body, card 가 읽는다) */
export function applyCustomization(c: Customization, theme: Theme, root: HTMLElement = document.documentElement) {
  for (const s of SECTIONS) {
    const st = c.sections[s]
    const src = photoSrc(sessionPhoto(st.photos, s))
    if (src) {
      root.style.setProperty(`--${s}-photo`, cssUrl(src))
      // 사진이 또렷할수록 그라데이션은 옅게
      root.style.setProperty(`--${s}-veil`, `${st.clear}%`)
      root.style.setProperty(`--${s}-photo-shadow`, '0 1px 3px rgb(0 0 0 / 0.35)')
      root.style.setProperty(`--${s}-photo-size`, st.fit)
      root.style.setProperty(`--${s}-photo-pos`, st.pos)
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
  const bgSrc = photoSrc(sessionPhoto(bg.photos, 'background'))
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
    root.style.setProperty('--page-photo-pos', bg.pos)
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

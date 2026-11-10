/**
 * 꾸미기 (사용자 요청 2026-11-10)
 * 앱 배경과 구역(대시보드, 가계부, 할 일, 스크랩)마다:
 * - 색: 랜덤(켤 때마다 바뀜) 또는 색깔표에서 고른 색으로 고정 (앱 배경은 '기본'도 있다)
 * - 사진: 고른 사진을 배경으로 (구역은 그라데이션 자리에, 앱 배경은 화면 전체에)
 * - 투명도: 0% = 또렷하게, 100% = 안 보이게
 * 이 기기에만 저장한다 (localStorage). 사진은 줄여서 저장한다.
 */
import type { Section, Theme, Trio } from './palette'
import { SECTIONS, textOn } from './palette'

export type ColorChoice = 'default' | 'random' | 'fixed'

export interface SectionStyle {
  color: 'random' | 'fixed'
  colors: Trio
  photo: string | null
  /** 사진 투명도 % (높을수록 사진이 옅어지고 그라데이션 색이 보인다) */
  clear: number
}

export interface BackgroundStyle {
  color: ColorChoice
  /** 고정 색 (하나) */
  fixed: string
  photo: string | null
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
export const DEFAULT_BACKGROUND: BackgroundStyle = { color: 'default', fixed: '#c9e7ff', photo: null, clear: 70, cardClear: 0 }
export const defaultSection = (colors: Trio = ['#4fd1ff', '#3b82f6', '#7c3aed']): SectionStyle => ({
  color: 'random',
  colors,
  photo: null,
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
const isPhoto = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:image/')

/** 저장된 값을 읽는다. 틀린 값은 기본값으로 */
export function parseCustomization(raw: unknown): Customization {
  const base = defaultCustomization()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<Record<keyof Customization, Record<string, unknown>>>
  const b = (r.background ?? {}) as Record<string, unknown>
  base.background = {
    color: b.color === 'random' || b.color === 'fixed' ? b.color : 'default',
    fixed: isHex(b.fixed) ? b.fixed : DEFAULT_BACKGROUND.fixed,
    photo: isPhoto(b.photo) ? b.photo : null,
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
      photo: isPhoto(v.photo) ? v.photo : null,
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
    if (st.photo) {
      root.style.setProperty(`--${s}-photo`, cssUrl(st.photo))
      // 사진이 또렷할수록 그라데이션은 옅게
      root.style.setProperty(`--${s}-veil`, `${st.clear}%`)
      root.style.setProperty(`--${s}-photo-shadow`, '0 1px 3px rgb(0 0 0 / 0.35)')
    } else {
      root.style.removeProperty(`--${s}-photo`)
      root.style.removeProperty(`--${s}-veil`)
      root.style.removeProperty(`--${s}-photo-shadow`)
    }
  }

  const bg = c.background
  const alpha = 100 - bg.clear
  const page = 'var(--color-slate-100)'
  const layers: string[] = []
  if (bg.photo) {
    // 사진 위에 바탕색을 덮어서 투명도를 낸다
    layers.push(`linear-gradient(color-mix(in srgb, ${page} ${bg.clear}%, transparent), color-mix(in srgb, ${page} ${bg.clear}%, transparent))`, cssUrl(bg.photo))
  } else if (bg.color === 'random') {
    const [a, b2, c3] = theme.sections.main.colors
    const mix = (x: string) => `color-mix(in srgb, ${x} ${alpha}%, ${page})`
    layers.push(`linear-gradient(var(--grad-angle), ${mix(a)}, ${mix(b2)} 52%, ${mix(c3)})`)
  } else if (bg.color === 'fixed') {
    const col = `color-mix(in srgb, ${bg.fixed} ${alpha}%, ${page})`
    layers.push(`linear-gradient(${col}, ${col})`)
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

/** 고른 사진을 긴 쪽 1280px JPEG로 줄인다 (저장 공간 아끼기) */
export async function shrinkPhoto(file: File, max = 1280): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image()
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.naturalWidth * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } finally {
    URL.revokeObjectURL(url)
  }
}

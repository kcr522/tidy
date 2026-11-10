/**
 * 켤 때마다 바뀌는 색 (사용자 요청 2026-11-10)
 * - 대시보드/설정, 가계부, 할 일, 스크랩이 각자 세 가지 색 그라데이션을 하나씩 받는다.
 * - 견본 18개(파스텔, 쨍한 색, 무채색) 중에서 고르거나, 어울리는 세 색을 새로 만든다.
 * - 밝은 그라데이션이면 그 위 글자를 검정으로, 진하면 흰색으로 바꾼다.
 */

export type Trio = [string, string, string]
export type Rand = () => number

export interface Preset {
  name: string
  group: '파스텔' | '쨍한 색' | '무채색'
  colors: Trio
}

/** 견본 페이지(Tidy 그라데이션 견본)의 18개 */
export const PRESETS: Preset[] = [
  { group: '파스텔', name: '솜사탕', colors: ['#8ec5fc', '#c9a7ff', '#fbc2eb'] },
  { group: '파스텔', name: '복숭아 하늘', colors: ['#ffc3a0', '#ffafbd', '#8ec5fc'] },
  { group: '파스텔', name: '민트 크림', colors: ['#a1f0d1', '#9fd8ff', '#c8b6ff'] },
  { group: '파스텔', name: '레몬 셔벗', colors: ['#fff3a3', '#c6f5a6', '#8fe3d0'] },
  { group: '파스텔', name: '라벤더 안개', colors: ['#a18cd1', '#c3a6ff', '#f7a6d8'] },
  { group: '파스텔', name: '벚꽃 노을', colors: ['#ffd1dc', '#ffa69e', '#ffe5b4'] },
  { group: '쨍한 색', name: '하늘 바다', colors: ['#4fd1ff', '#3b82f6', '#7c3aed'] },
  { group: '쨍한 색', name: '네온 선셋', colors: ['#ff8a00', '#ff2e7e', '#8a2be2'] },
  { group: '쨍한 색', name: '오로라', colors: ['#00e0b0', '#3a7bff', '#b44dff'] },
  { group: '쨍한 색', name: '트로피컬', colors: ['#ffd23f', '#ff7a59', '#ff3d8b'] },
  { group: '쨍한 색', name: '사이버 라임', colors: ['#c6ff3d', '#1de9b6', '#2979ff'] },
  { group: '쨍한 색', name: '베리 스무디', colors: ['#9d1aff', '#ff1f6b', '#ff9a3c'] },
  { group: '무채색', name: '실버 미스트', colors: ['#e9edf2', '#b8c1cc', '#7d8796'] },
  { group: '무채색', name: '차콜 나이트', colors: ['#5b6270', '#2f343d', '#111317'] },
  { group: '무채색', name: '모카 라떼', colors: ['#e3d3c3', '#b39b85', '#6b5546'] },
  { group: '무채색', name: '그레이 블루', colors: ['#d7e1ec', '#9aaec4', '#5e7288'] },
  { group: '무채색', name: '세이지', colors: ['#dfe6d5', '#a9b8a0', '#66775f'] },
  { group: '무채색', name: '흑백 필름', colors: ['#f5f5f5', '#9e9e9e', '#2b2b2b'] },
]

// ───────────── 색 계산 ─────────────

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + hue / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255)
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = d / (1 - Math.abs(2 * l - 1))
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  h *= 60
  return [(h + 360) % 360, s * 100, l * 100]
}

/** 상대 휘도 (WCAG) */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** 그라데이션 위 글자색: 평균이 밝으면 검정, 아니면 흰색 */
export function textOn(colors: Trio): '#191f28' | '#ffffff' {
  const avg = colors.reduce((s, c) => s + luminance(c), 0) / colors.length
  return avg > 0.42 ? '#191f28' : '#ffffff'
}

/**
 * 버튼 글자, 링크 같은 단색 포인트 (brand-50 ~ 700).
 * 세 색 중 가장 진한 색을 기준으로, 흰 바탕에서도 읽히도록 밝기를 맞춘다.
 */
export function brandShades(colors: Trio): Record<'50' | '100' | '500' | '600' | '700', string> {
  const base = [...colors].sort((a, b) => hexToHsl(b)[1] - hexToHsl(a)[1] || luminance(a) - luminance(b))[0]
  const [h, s] = hexToHsl(base)
  const sat = Math.min(s, 85)
  // 밝기를 낮춰 가며 원하는 대비가 나오는 첫 색 (노랑, 라임처럼 밝은 색도 읽히게)
  const darkEnough = (startL: number, maxLum: number) => {
    for (let l = startL; l > 5; l -= 2) {
      const c = hslToHex(h, sat, l)
      if (luminance(c) <= maxLum) return c
    }
    return hslToHex(h, sat, 5)
  }
  return {
    '50': hslToHex(h, Math.min(sat, 70), 96),
    '100': hslToHex(h, Math.min(sat, 70), 91),
    '500': darkEnough(54, 0.28),
    '600': darkEnough(46, 0.17), // 흰 바탕 대비 4.5:1 이상
    '700': darkEnough(38, 0.1),
  }
}

/** 흰 바탕 위 글자로 쓸 수 있게 어둡게 (로고 그라데이션용). 색감(색상, 채도)은 그대로 둔다 */
export function deepen(hex: string, maxLum = 0.3): string {
  const [h, s, l] = hexToHsl(hex)
  for (let x = l; x > 5; x -= 2) {
    const c = hslToHex(h, s, x)
    if (luminance(c) <= maxLum) return c
  }
  return hslToHex(h, s, 5)
}

// ───────────── 새 조합 만들기 ─────────────

const pick = <T,>(list: readonly T[], random: Rand): T => list[Math.floor(random() * list.length)]
const between = (min: number, max: number, random: Rand) => min + random() * (max - min)

/** 어울리는 세 색을 새로 만든다: 비슷한 색 / 넓은 비슷한 색 / 삼각 배색 × 파스텔 / 쨍한 / 무채색 */
export function generateTrio(random: Rand = Math.random): Trio {
  const base = random() * 360
  const style = pick(['pastel', 'vivid', 'mono'] as const, random)
  if (style === 'mono') {
    const s = between(6, 18, random)
    const light = random() < 0.5
    const ls = light ? [92, 76, 54] : [46, 30, 14]
    return [hslToHex(base, s, ls[0]), hslToHex(base + 8, s, ls[1]), hslToHex(base + 16, s, ls[2])]
  }
  const steps = pick([[0, 28, 56], [0, 45, 90], [0, 120, 240], [0, -35, -70]] as const, random)
  const [s, l] = style === 'pastel' ? [between(70, 90, random), between(78, 86, random)] : [between(82, 100, random), between(52, 62, random)]
  return steps.map((d) => hslToHex(base + d, s, l)) as Trio
}

// ───────────── 켤 때마다 고르기 ─────────────

export type Section = 'main' | 'money' | 'todo' | 'scrap'
export const SECTIONS: Section[] = ['main', 'money', 'todo', 'scrap']

export interface Theme {
  angle: number
  sections: Record<Section, { colors: Trio; name: string }>
}

/** 구역마다 견본(60%)이나 새 조합(40%)을 고른다. 견본은 구역끼리 겹치지 않는다. */
export function pickTheme(random: Rand = Math.random): Theme {
  const left = [...PRESETS]
  const sections = {} as Theme['sections']
  for (const sec of SECTIONS) {
    if (random() < 0.6 && left.length > 0) {
      const p = left.splice(Math.floor(random() * left.length), 1)[0]
      // 색 순서를 가끔 뒤집어서 같은 견본도 다르게 보이게
      const colors = (random() < 0.5 ? [...p.colors] : [...p.colors].reverse()) as Trio
      sections[sec] = { colors, name: p.name }
    } else {
      sections[sec] = { colors: generateTrio(random), name: '새 조합' }
    }
  }
  return { angle: 100 + Math.round(random() * 60), sections }
}

/** 고른 색을 CSS 변수로 넣는다 (index.css의 .theme-* 가 읽는다) */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.style.setProperty('--grad-angle', `${theme.angle}deg`)
  // 로고: 대시보드 색을 흰 바탕에서도 보이게 진하게
  theme.sections.main.colors.forEach((c, i) => root.style.setProperty(`--logo-c${i + 1}`, deepen(c)))
  for (const sec of SECTIONS) {
    const { colors } = theme.sections[sec]
    colors.forEach((c, i) => root.style.setProperty(`--${sec}-c${i + 1}`, c))
    const shades = brandShades(colors)
    for (const [k, v] of Object.entries(shades)) root.style.setProperty(`--${sec}-${k}`, v)
    const on = textOn(colors)
    root.style.setProperty(`--${sec}-on`, on)
    root.style.setProperty(`--${sec}-on-shadow`, on === '#ffffff' ? '0 1px 2px rgb(25 31 40 / 0.18)' : 'none')
    root.style.setProperty(`--${sec}-on-soft`, on === '#ffffff' ? 'rgb(255 255 255 / 0.22)' : 'rgb(25 31 40 / 0.08)')
  }
}

/**
 * 앱을 켤 때마다 그라데이션 색 순서와 방향을 바꿔서 매번 다채롭게 보이게 한다.
 * 색은 하늘색 + 민트 + 라벤더 + 핑크 네 가지.
 * 하늘색은 2번이나 3번 자리에 둬서 모든 구역(가계부, 할 일, 스크랩)의 그라데이션에 항상 들어가게 한다.
 */
export const SKY = '#36b3f4'
export const OTHERS = ['#34d3b0', '#9686ff', '#ff8db8'] as const

export interface Palette {
  colors: [string, string, string, string]
  angle: number
}

export function pickPalette(random: () => number = Math.random): Palette {
  const others: string[] = [...OTHERS]
  // 나머지 세 색을 섞는다 (Fisher–Yates)
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[others[i], others[j]] = [others[j], others[i]]
  }
  const skyAt = random() < 0.5 ? 1 : 2
  const colors = [...others]
  colors.splice(skyAt, 0, SKY)
  const angle = 100 + Math.round(random() * 60) // 100° ~ 160°
  return { colors: colors as Palette['colors'], angle }
}

export function applyPalette(p: Palette, root: HTMLElement = document.documentElement) {
  p.colors.forEach((c, i) => root.style.setProperty(`--c${i + 1}`, c))
  root.style.setProperty('--grad-angle', `${p.angle}deg`)
}

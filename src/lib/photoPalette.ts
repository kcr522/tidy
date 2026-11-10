/**
 * 사진에서 앱 색 뽑기 (시작 화면 사진에 맞춰 앱 색감을 맞출 때)
 * - bg: 앱 바탕으로 쓸 아주 연한 색 (사진에서 가장 많이 보이는 밝은 색에 가깝게)
 * - colors: 제목 띠, 버튼 그라데이션에 쓸 세 색 (밝은 → 중간 → 진한 순)
 * 라이브러리 없이 작은 캔버스로 줄여서 비슷한 색끼리 묶어 센다.
 */
import { hexToHsl, hslToHex, type Trio } from './palette'

export interface PhotoPalette {
  bg: string
  colors: Trio
}

const toHex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`

interface Bucket {
  count: number
  r: number
  g: number
  b: number
}

/** RGBA 픽셀 배열 → 색 묶음 (각 채널 16단계) */
function buckets(data: ArrayLike<number>): { hex: string; count: number; h: number; s: number; l: number }[] {
  const map = new Map<number, Bucket>()
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
    const x = map.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    x.count++
    x.r += r
    x.g += g
    x.b += b
    map.set(key, x)
  }
  return [...map.values()]
    .map((x) => {
      const hex = toHex(x.r / x.count, x.g / x.count, x.b / x.count)
      const [h, s, l] = hexToHsl(hex)
      return { hex, count: x.count, h, s, l }
    })
    .sort((a, b) => b.count - a.count)
}

const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b))

/** 픽셀에서 바탕색과 세 색을 고른다 */
export function paletteFromPixels(data: ArrayLike<number>): PhotoPalette {
  const all = buckets(data)
  // 색이 있는 칸 (거의 흰색, 거의 검정, 회색은 뺀다)
  const colorful = all.filter((c) => c.s >= 18 && c.l >= 18 && c.l <= 88)
  // 사진의 대표 색상: 색 있는 칸 중 가장 많은 것
  const main = colorful[0] ?? all.find((c) => c.l > 10 && c.l < 95) ?? { h: 210, s: 30, l: 50 }
  const h = main.h
  const s = Math.max(20, Math.min(main.s, 60))

  // 바탕: 대표 색상 쪽의 밝은 칸이 있으면 그 색을 아주 연하게, 없으면 대표 색상으로 만든다
  const light = all.find((c) => c.l >= 82 && c.l <= 97 && c.s >= 8 && hueGap(c.h, h) < 45)
  const bg = light ? hslToHex(light.h, Math.min(light.s, 45), 94) : hslToHex(h, Math.min(s, 40), 94)

  // 세 색: 많이 보이는 색 중 밝기가 서로 다른 것 셋 (밝은 / 중간 / 진한)
  const picks: { h: number; s: number; l: number }[] = []
  for (const c of colorful) {
    if (picks.every((p) => Math.abs(p.l - c.l) >= 14 || hueGap(p.h, c.h) >= 40)) picks.push(c)
    if (picks.length === 3) break
  }
  while (picks.length < 3) {
    // 부족하면 대표 색을 밝게/진하게 바꿔 채운다
    const ls = [72, 52, 32]
    picks.push({ h, s, l: ls[picks.length] })
  }
  picks.sort((a, b) => b.l - a.l)
  // 너무 흐리거나 너무 진한 색은 그라데이션에 맞게 다듬는다
  const tune = (p: { h: number; s: number; l: number }, minL: number, maxL: number) =>
    hslToHex(p.h, Math.max(18, Math.min(p.s, 70)), Math.max(minL, Math.min(p.l, maxL)))
  const colors: Trio = [tune(picks[0], 62, 82), tune(picks[1], 42, 66), tune(picks[2], 22, 46)]
  return { bg, colors }
}

/** 사진 파일(Blob)에서 색 뽑기 */
export async function paletteFromBlob(blob: Blob): Promise<PhotoPalette> {
  const bmp = await createImageBitmap(blob)
  try {
    const w = 48
    const hgt = Math.max(1, Math.round((bmp.height / bmp.width) * w))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = hgt
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0, w, hgt)
    return paletteFromPixels(ctx.getImageData(0, 0, w, hgt).data)
  } finally {
    bmp.close()
  }
}

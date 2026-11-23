/**
 * 이동 기록 지도 그림(타일) 주소 (2026-11-23)
 * CARTO 무료 지도가 키 없이는 "API KEY REQUIRED" 그림만 주게 바뀌어서, OpenStreetMap 기본 지도로 바꿨다.
 * OSM 은 앱이 누군지 밝히고(User-Agent) 받은 그림을 오래 두고 쓰라고 하므로, Tidy 서버(api/tile.ts)가 대신 받아
 * Vercel 캐시에 30일 둔다. 같은 곳은 OSM 에 다시 묻지 않는다.
 */

export const OSM_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_USER_AGENT = 'Tidy/1.0 (personal life app; +https://tidy-gules.vercel.app)'
export const MAX_ZOOM = 19

/** 맞는 타일 번호인지 (z 0~19, x · y 는 0 ~ 2^z-1). 맞으면 숫자로 */
export function parseTile(z: unknown, x: unknown, y: unknown): { z: number; x: number; y: number } | null {
  const nums = [z, x, y].map((v) => (typeof v === 'string' && /^\d{1,7}$/.test(v) ? Number(v) : NaN))
  const [zz, xx, yy] = nums
  if (nums.some((n) => !Number.isInteger(n)) || zz > MAX_ZOOM) return null
  const max = 2 ** zz
  if (xx >= max || yy >= max) return null
  return { z: zz, x: xx, y: yy }
}

export function osmTileUrl(t: { z: number; x: number; y: number }): string {
  return OSM_TILE.replace('{z}', String(t.z)).replace('{x}', String(t.x)).replace('{y}', String(t.y))
}

// 사진 찍은 곳 근처 식당·카페 찾기 (서버 api/meal.ts 에서만 쓴다)
// 카카오 로컬 API: https://developers.kakao.com/docs/latest/ko/local/dev-guide#search-by-category
// 키(REST API 키)는 Vercel 환경 변수 KAKAO_REST_API_KEY 에만 둔다.
import { MAX_NEARBY, type NearbyPlace } from './meal.js'

interface KakaoDoc {
  place_name: string
  category_name: string
  road_address_name: string
  address_name: string
  distance: string
  place_url: string
}

/** 음식점(FD6)과 카페(CE7) */
const GROUPS = ['FD6', 'CE7'] as const

/** 사진 위치는 실내에서 수십 m 틀릴 수 있어서 넉넉하게 */
export const SEARCH_RADIUS_M = 80

export async function nearbyPlaces(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<NearbyPlace[]> {
  const lists = await Promise.all(
    GROUPS.map(async (code) => {
      const q = new URLSearchParams({
        category_group_code: code,
        x: String(lng),
        y: String(lat),
        radius: String(SEARCH_RADIUS_M),
        sort: 'distance',
        size: '15',
      })
      const res = await fetchImpl(`https://dapi.kakao.com/v2/local/search/category.json?${q}`, {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        signal,
      })
      if (!res.ok) return []
      const data = (await res.json().catch(() => null)) as { documents?: KakaoDoc[] } | null
      return data?.documents ?? []
    }),
  )
  return lists
    .flat()
    .map((d) => ({
      name: d.place_name,
      category: d.category_name,
      address: d.road_address_name || d.address_name,
      distance: Number(d.distance) || 0,
      ...(d.place_url ? { url: d.place_url } : {}),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, MAX_NEARBY)
}

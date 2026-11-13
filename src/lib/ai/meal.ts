// 음식 사진으로 가계부 기록: 프롬프트, 주고받는 모양
// 이 파일은 앱과 서버(api/meal.ts) 둘 다 쓴다. 그래서 다른 파일을 import 하지 않는다 (타입만 예외).

/** 사진을 찍은 곳 근처 식당 (서버가 카카오 지도에서 찾아 준다) */
export interface NearbyPlace {
  name: string
  /** 예: "음식점 > 한식 > 찌개,전골" */
  category: string
  address: string
  /** 사진 찍은 곳에서 몇 m */
  distance: number
  /** 카카오맵 가게 페이지 (메뉴와 가격이 있는 경우가 많다) */
  url?: string
}

/** 앱 → AI 로 보내는 것 */
export interface MealRequest {
  /** 줄인 사진 (JPEG base64, 위치 정보는 지운 상태) */
  image: string
  /** 사진 찍은 날짜와 시각 (YYYY-MM-DD, HH:mm) */
  date: string
  time?: string
  /** 사진에 들어 있던 위치 */
  location?: { lat: number; lng: number }
  /** 서버가 찾은 근처 식당. 앱에서 보낼 때는 비워 둔다 */
  nearby?: NearbyPlace[]
  /** 사용자가 직접 적은 가게 이름 (위치가 없을 때) */
  placeHint?: string
}

/** AI → 앱 으로 돌아오는 것 */
export interface MealGuess {
  /** 먹은 음식 (예: 김치찌개) */
  dish: string
  /** 가게 이름. 모르면 null */
  place: string | null
  /** 가게를 얼마나 확신하는지 */
  placeSure: boolean
  /** 인터넷 메뉴판에서 찾은 1인분 가격 (원). 못 찾으면 null */
  price: number | null
  /** 가격을 본 곳 주소 */
  priceUrl: string | null
  /** 가격 한 줄 설명 (예: "네이버 플레이스 메뉴, 2026년 9월 기준") */
  priceNote: string
  /** 메뉴판 가격을 못 찾았을 때 비슷한 가게 기준 짐작 (원). 없으면 null */
  guessPrice: number | null
  /** 사진에 보이는 그릇 수 (1~9) */
  servings: number
}

export const MAX_IMAGE_CHARS = 3_000_000 // 약 2.2MB 사진 (Vercel 요청 4.5MB 한도 안)
export const MAX_NEARBY = 10

export const SYSTEM = `너는 가계부 앱 "Tidy"에서 음식 사진을 보고 지출을 기록하도록 돕는 도우미야.
사용자가 식당이나 카페에서 찍은 음식 사진과, 사진을 찍은 시각·위치·근처 가게 목록을 줄 거야.

할 일:
1. 사진 속 음식이 무엇인지 알아내. 한국에서 부르는 메뉴 이름으로 짧게 (예: "김치찌개", "아이스 아메리카노").
2. 어느 가게인지 정해. 근처 가게 목록이 있으면 그 안에서 음식 종류, 거리, 사진 속 그릇·로고·메뉴판 단서로 고르고, 목록에 맞는 곳이 없으면 null.
   목록도 없고 사용자가 적은 가게 이름도 없으면 위치 좌표로 검색해 볼 수는 있지만, 확실하지 않으면 null.
3. 가게를 알면 web_search로 그 가게 메뉴판의 이 메뉴 가격을 찾아 봐. 네이버 플레이스, 카카오맵, 배달앱, 블로그 후기 순으로 믿어.
   찾은 가격의 출처 주소를 꼭 적어. 오래된 후기 가격이면 그렇다고 적어.
4. 마지막에 꼭 report_meal 도구를 한 번 불러서 결과를 알려 줘. 그 밖의 말은 하지 마.

지켜야 할 것:
- 가격을 지어내지 마. 찾지 못했으면 price는 null. 그때 guessPrice에는 비슷한 가게의 흔한 가격을 짐작해서 넣어도 돼.
- 가격은 1인분(1개) 기준 원 단위 정수. servings는 사진에 같은 메뉴가 몇 그릇 보이는지 (보통 1).
- 검색은 꼭 필요할 때만, 많아야 몇 번.`

/** 도구가 없는 AI(Gemini)용: 검색 도구 이름과 마지막 보고 방법만 바꾼다 */
export const SYSTEM_JSON = SYSTEM.replace('web_search로', '구글 검색으로').replace(
  '4. 마지막에 꼭 report_meal 도구를 한 번 불러서 결과를 알려 줘. 그 밖의 말은 하지 마.',
  `4. 마지막에 아래 모양의 JSON 하나만 답해. 코드 블록이나 다른 말은 쓰지 마.
{"dish": "음식 이름", "place": "가게 이름 또는 null", "placeSure": true/false, "price": 원 정수 또는 null, "priceUrl": "출처 주소 또는 null", "priceNote": "가격 출처 한 줄", "guessPrice": 원 정수 또는 null, "servings": 1}`,
)

/** 결과를 받는 도구. strict 라서 모양이 항상 맞게 온다 */
export const REPORT_TOOL = {
  name: 'report_meal',
  description: '사진 속 음식, 가게, 메뉴판 가격을 앱에 알려 준다. 맨 마지막에 한 번만 부른다.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    additionalProperties: false,
    required: ['dish', 'place', 'placeSure', 'price', 'priceUrl', 'priceNote', 'guessPrice', 'servings'],
    properties: {
      dish: { type: 'string', description: '먹은 음식 이름 (한국어, 짧게)' },
      place: { type: ['string', 'null'], description: '가게 이름. 모르면 null' },
      placeSure: { type: 'boolean', description: '가게가 맞다고 꽤 확신하면 true' },
      price: { type: ['integer', 'null'], description: '인터넷 메뉴판에서 찾은 1인분 가격(원). 못 찾았으면 null' },
      priceUrl: { type: ['string', 'null'], description: '가격을 본 페이지 주소' },
      priceNote: { type: 'string', description: '가격 출처 한 줄 설명. 못 찾았으면 왜 못 찾았는지' },
      guessPrice: { type: ['integer', 'null'], description: '메뉴판 가격이 없을 때 짐작 가격(원)' },
      servings: { type: 'integer', description: '같은 메뉴 그릇 수 (1~9)' },
    },
  },
}

const won = (n: number) => `${n.toLocaleString('ko-KR')}원`

/** 사진과 함께 보낼 설명 글 */
export function mealPrompt(req: MealRequest): string {
  const lines = [`사진 찍은 때: ${req.date}${req.time ? ` ${req.time}` : ''}`]
  if (req.location) lines.push(`사진 찍은 위치: 위도 ${req.location.lat.toFixed(5)}, 경도 ${req.location.lng.toFixed(5)}`)
  else lines.push('사진 찍은 위치: 사진에 위치 정보가 없어')
  if (req.placeHint) lines.push(`사용자가 적은 가게 이름: ${req.placeHint}`)
  if (req.nearby?.length) {
    lines.push('', '근처 가게 (가까운 순):')
    for (const p of req.nearby) lines.push(`- ${p.name} | ${p.category} | ${p.distance}m | ${p.address}${p.url ? ` | ${p.url}` : ''}`)
  } else if (req.location) {
    lines.push('근처 가게 목록: 없음 (지도 검색을 못 했어)')
  }
  lines.push('', '무엇을 먹었고 어느 가게이고 메뉴판 가격이 얼마인지 알아내서 알려 줘.')
  return lines.join('\n')
}

/** 들어온 요청을 믿을 수 있는 모양으로 (서버에서 쓴다) */
export function sanitizeMealRequest(raw: unknown): MealRequest | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.image !== 'string' || !r.image || r.image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(r.image)) return null
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null
  const out: MealRequest = { image: r.image, date: r.date }
  if (typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time)) out.time = r.time
  const loc = r.location as Record<string, unknown> | undefined
  if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number' && Math.abs(loc.lat) <= 90 && Math.abs(loc.lng) <= 180) {
    out.location = { lat: loc.lat, lng: loc.lng }
  }
  if (typeof r.placeHint === 'string' && r.placeHint.trim()) out.placeHint = r.placeHint.trim().slice(0, 40)
  return out
}

/** AI가 준 결과를 믿을 수 있는 모양으로 */
export function sanitizeGuess(raw: unknown): MealGuess | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const money = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 100 && v <= 10_000_000 ? Math.round(v) : null)
  const dish = str(r.dish, 40)
  if (!dish) return null
  const url = str(r.priceUrl, 500)
  const servings = typeof r.servings === 'number' && Number.isFinite(r.servings) ? Math.min(9, Math.max(1, Math.round(r.servings))) : 1
  return {
    dish,
    place: str(r.place, 40) || null,
    placeSure: r.placeSure === true,
    price: money(r.price),
    priceUrl: /^https?:\/\//.test(url) ? url : null,
    priceNote: str(r.priceNote, 120),
    guessPrice: money(r.guessPrice),
    servings,
  }
}

/** 글로 받은 JSON 답 (Gemini·Groq) */
export function guessFromText(text: string): MealGuess | null {
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return sanitizeGuess(JSON.parse(m[0]))
  } catch {
    return null
  }
}

export class MealError extends Error {}

/** 확인 화면에 보일 가격 문장 */
export function priceLine(g: MealGuess): string {
  if (g.price !== null) return `메뉴판 가격 ${won(g.price)}`
  if (g.guessPrice !== null) return `메뉴판은 못 찾았어요. 보통 ${won(g.guessPrice)} 정도예요`
  return '인터넷에서 가격을 찾지 못했어요'
}

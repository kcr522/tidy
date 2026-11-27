/**
 * 대시보드 날씨 위젯 (사용자 요청 2026-11-27)
 * - Open-Meteo 무료 예보 API를 쓴다. 키가 필요 없고 돈이 들지 않는다 (https://open-meteo.com)
 * - 위치는 사용자가 "내 위치로" 를 눌렀을 때만 묻는다. 그 전에는 서울 날씨
 * - 한 번 받은 날씨는 30분 동안 이 기기에 두고 다시 쓴다 (폰 데이터 · 배터리 아끼기)
 */

export interface WeatherPlace {
  lat: number
  lng: number
  /** 화면에 보일 이름 (가장 가까운 도시) */
  name: string
  /** 사용자 위치인지 (아니면 기본 서울) */
  mine: boolean
}

export interface WeatherHour {
  /** 0~23시 */
  hour: number
  temp: number
  code: number
  /** 비 올 확률 % */
  rain: number
}

export interface Weather {
  temp: number
  feels: number
  code: number
  isDay: boolean
  max: number
  min: number
  /** 오늘 가장 높은 비 올 확률 % */
  rain: number
  /** 지금부터 몇 시간 (최대 12) */
  hours: WeatherHour[]
  /** 받은 시각 (ms) */
  at: number
}

export const SEOUL: WeatherPlace = { lat: 37.5665, lng: 126.978, name: '서울', mine: false }

/** 이 시간 안에 받은 날씨는 다시 받지 않는다 */
export const WEATHER_TTL = 30 * 60 * 1000

/** 날씨 코드(WMO) → 그림 · 이름. 낮/밤에 따라 해·달이 바뀐다 */
export function weatherLook(code: number, isDay = true): { icon: string; label: string } {
  if (code === 0) return { icon: isDay ? '☀️' : '🌙', label: '맑음' }
  if (code === 1) return { icon: isDay ? '🌤️' : '🌙', label: '대체로 맑음' }
  if (code === 2) return { icon: '⛅', label: '구름 조금' }
  if (code === 3) return { icon: '☁️', label: '흐림' }
  if (code === 45 || code === 48) return { icon: '🌫️', label: '안개' }
  if (code >= 51 && code <= 57) return { icon: '🌦️', label: '이슬비' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { icon: '🌧️', label: code >= 65 && code !== 80 ? '많은 비' : '비' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { icon: '🌨️', label: '눈' }
  if (code >= 95) return { icon: '⛈️', label: '뇌우' }
  return { icon: '🌡️', label: '날씨' }
}

/** 날씨에 맞춘 한마디 */
export function weatherTip(w: Pick<Weather, 'code' | 'rain' | 'max' | 'min' | 'feels'>): string {
  if (w.rain >= 60 || (w.code >= 51 && w.code <= 82) || w.code >= 95) return '우산 챙기세요 ☂️'
  if ((w.code >= 71 && w.code <= 77) || w.code === 85 || w.code === 86) return '길이 미끄러울 수 있어요'
  if (w.feels <= 0) return '많이 추워요. 따뜻하게 입으세요'
  if (w.max - w.min >= 10) return '일교차가 커요. 겉옷 챙기세요'
  if (w.feels >= 30) return '더워요. 물 자주 마시세요'
  return '오늘도 좋은 하루 보내요'
}

/** 화면에 보일 도시 이름: 가장 가까운 도시 (주소 찾기 서비스를 따로 쓰지 않으려고) */
const CITIES: [string, number, number][] = [
  ['서울', 37.5665, 126.978],
  ['인천', 37.4563, 126.7052],
  ['수원', 37.2636, 127.0286],
  ['성남', 37.4201, 127.1265],
  ['고양', 37.6584, 126.832],
  ['용인', 37.2411, 127.1776],
  ['부천', 37.5034, 126.766],
  ['안산', 37.3219, 126.8309],
  ['남양주', 37.636, 127.2165],
  ['화성', 37.1995, 126.8312],
  ['의정부', 37.7381, 127.0337],
  ['파주', 37.76, 126.78],
  ['평택', 36.9921, 127.1129],
  ['춘천', 37.8813, 127.7298],
  ['원주', 37.3422, 127.9202],
  ['강릉', 37.7519, 128.8761],
  ['청주', 36.6424, 127.489],
  ['천안', 36.8151, 127.1139],
  ['대전', 36.3504, 127.3845],
  ['세종', 36.48, 127.289],
  ['전주', 35.8242, 127.148],
  ['광주', 35.1595, 126.8526],
  ['목포', 34.8118, 126.3922],
  ['여수', 34.7604, 127.6622],
  ['대구', 35.8714, 128.6014],
  ['포항', 36.019, 129.3435],
  ['경주', 35.8562, 129.2247],
  ['안동', 36.5684, 128.7294],
  ['구미', 36.1195, 128.3446],
  ['울산', 35.5384, 129.3114],
  ['창원', 35.2281, 128.6811],
  ['진주', 35.18, 128.1076],
  ['김해', 35.2285, 128.8894],
  ['부산', 35.1796, 129.0756],
  ['제주', 33.4996, 126.5312],
  ['서귀포', 33.2541, 126.56],
]

export function nearestCity(lat: number, lng: number): string {
  let best = CITIES[0]
  let bestD = Infinity
  for (const c of CITIES) {
    const d = (c[1] - lat) ** 2 + ((c[2] - lng) * Math.cos((lat * Math.PI) / 180)) ** 2
    if (d < bestD) {
      bestD = d
      best = c
    }
  }
  // 한국에서 멀리 떨어진 곳 (위도·경도 약 1.5도 넘게): 도시 이름 대신 "내 위치"
  return bestD > 2.25 ? '내 위치' : best[0]
}

export function forecastUrl(p: Pick<WeatherPlace, 'lat' | 'lng'>): string {
  const q = new URLSearchParams({
    latitude: p.lat.toFixed(3),
    longitude: p.lng.toFixed(3),
    current: 'temperature_2m,apparent_temperature,weather_code,is_day',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '2',
  })
  return `https://api.open-meteo.com/v1/forecast?${q}`
}

interface OpenMeteo {
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; weather_code?: number; is_day?: number }
  hourly?: { time?: string[]; temperature_2m?: number[]; weather_code?: number[]; precipitation_probability?: (number | null)[] }
  daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: (number | null)[] }
}

/** 반올림 (-0.4 가 "-0°" 로 보이지 않게) */
const round = (n: number): number => Math.round(n) || 0

/** Open-Meteo 응답 → 화면에 쓸 날씨. 모양이 이상하면 null */
export function parseForecast(raw: unknown, at: number): Weather | null {
  const r = raw as OpenMeteo | null
  const c = r?.current
  if (!c || typeof c.temperature_2m !== 'number' || typeof c.weather_code !== 'number') return null
  const h = r?.hourly
  const times = h?.time ?? []
  // 지금 시각(현지 "YYYY-MM-DDTHH:00") 부터 12시간
  const nowHour = (c.time ?? '').slice(0, 13)
  const start = Math.max(0, times.findIndex((t) => t.slice(0, 13) === nowHour))
  const hours: WeatherHour[] = []
  for (let i = start; i < times.length && hours.length < 12; i++) {
    const temp = h?.temperature_2m?.[i]
    const code = h?.weather_code?.[i]
    if (typeof temp !== 'number' || typeof code !== 'number') continue
    hours.push({ hour: Number(times[i].slice(11, 13)), temp: round(temp), code, rain: round(h?.precipitation_probability?.[i] ?? 0) })
  }
  const d = r?.daily
  return {
    temp: round(c.temperature_2m),
    feels: round(c.apparent_temperature ?? c.temperature_2m),
    code: c.weather_code,
    isDay: c.is_day !== 0,
    max: round(d?.temperature_2m_max?.[0] ?? c.temperature_2m),
    min: round(d?.temperature_2m_min?.[0] ?? c.temperature_2m),
    rain: round(d?.precipitation_probability_max?.[0] ?? 0),
    hours,
    at,
  }
}

// ───────────── 이 기기에 두기 ─────────────

const PLACE_KEY = 'tidy.weather.place'
const CACHE_KEY = 'tidy.weather.cache'

export function loadPlace(): WeatherPlace {
  try {
    const p = JSON.parse(localStorage.getItem(PLACE_KEY) ?? 'null') as WeatherPlace | null
    if (p && Number.isFinite(p.lat) && Number.isFinite(p.lng)) return { lat: p.lat, lng: p.lng, name: String(p.name || '내 위치'), mine: !!p.mine }
  } catch {
    // 무시
  }
  return SEOUL
}

export function savePlace(p: WeatherPlace | null): void {
  try {
    if (p) localStorage.setItem(PLACE_KEY, JSON.stringify(p))
    else localStorage.removeItem(PLACE_KEY)
  } catch {
    // 무시
  }
}

/** 같은 곳(약 1km 안)을 30분 안에 받은 날씨가 있으면 그것 */
export function cachedWeather(p: WeatherPlace, now: number): Weather | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { lat: number; lng: number; w: Weather } | null
    if (!c || Math.abs(c.lat - p.lat) > 0.01 || Math.abs(c.lng - p.lng) > 0.01) return null
    return now - c.w.at < WEATHER_TTL ? c.w : null
  } catch {
    return null
  }
}

export async function fetchWeather(p: WeatherPlace, now = Date.now(), fetcher: typeof fetch = fetch): Promise<Weather> {
  const res = await fetcher(forecastUrl(p))
  if (!res.ok) throw new Error(`날씨를 받지 못했어요 (${res.status})`)
  const w = parseForecast(await res.json(), now)
  if (!w) throw new Error('날씨를 읽지 못했어요')
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ lat: p.lat, lng: p.lng, w }))
  } catch {
    // 무시
  }
  return w
}

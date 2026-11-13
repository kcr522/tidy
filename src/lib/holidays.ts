import { addDays, format } from 'date-fns'
import { parseDateKey } from './date'

/**
 * 대한민국 공휴일 (관공서의 공휴일에 관한 규정 기준)
 * 달력에 미리 표시만 하고 DB에는 넣지 않는다. 그래서 지울 수 없고, 동기화·백업에도 안 들어간다.
 *
 * - 양력 공휴일: 신정, 3·1절, 노동절(2026~), 어린이날, 현충일, 제헌절(2026~), 광복절, 개천절, 한글날, 성탄절
 * - 음력 공휴일: 설날·추석(앞뒤 하루 포함 3일), 부처님오신날 → 날짜는 아래 표 (한국천문연구원 음력 기준, 2024~2040)
 * - 대체공휴일
 *   - 설날·추석: 일요일이나 다른 공휴일과 겹치면 연휴 다음 첫 평일
 *   - 3·1절, 노동절, 어린이날, 부처님오신날, 제헌절, 광복절, 개천절, 한글날, 성탄절: 토·일요일이나 다른 공휴일과 겹치면 다음 첫 평일
 *   - 신정, 현충일은 대체공휴일이 없다
 * - 선거일·임시공휴일은 정해진 것만 아래 표에 넣는다
 */
export interface Holiday {
  date: string
  name: string
  /** 대체공휴일이면 무엇의 대체인지 (예: '개천절') */
  substitute?: string
}

/** 해마다 설날, 부처님오신날, 추석 (양력 MMDD) */
const LUNAR: Record<number, [string, string, string]> = {
  2024: ['0210', '0515', '0917'],
  2025: ['0129', '0505', '1006'],
  2026: ['0217', '0524', '0925'],
  2027: ['0207', '0513', '0915'],
  2028: ['0127', '0502', '1003'],
  2029: ['0213', '0520', '0922'],
  2030: ['0203', '0509', '0912'],
  2031: ['0123', '0528', '1001'],
  2032: ['0211', '0516', '0919'],
  2033: ['0131', '0506', '0908'],
  2034: ['0219', '0525', '0927'],
  2035: ['0208', '0515', '0916'],
  2036: ['0128', '0503', '1004'],
  2037: ['0215', '0522', '0924'],
  2038: ['0204', '0511', '0913'],
  2039: ['0124', '0430', '1002'],
  2040: ['0212', '0518', '0921'],
}

/** 선거일, 임시공휴일 */
const EXTRA: Holiday[] = [
  { date: '2024-04-10', name: '국회의원 선거일' },
  { date: '2024-10-01', name: '국군의 날 (임시공휴일)' },
  { date: '2025-01-27', name: '임시공휴일' },
  { date: '2025-06-03', name: '대통령 선거일' },
  { date: '2026-06-03', name: '지방선거일' },
]

export const HOLIDAY_YEARS = { from: 2024, to: 2040 }

const cache = new Map<number, Holiday[]>()

const key = (d: Date) => format(d, 'yyyy-MM-dd')

/** 그해 공휴일 목록 (날짜순). 표에 없는 해는 양력 공휴일만 */
export function holidaysOfYear(year: number): Holiday[] {
  const hit = cache.get(year)
  if (hit) return hit
  const list: Holiday[] = []
  const add = (date: string, name: string) => list.push({ date, name })
  const ymd = (mmdd: string) => `${year}-${mmdd.slice(0, 2)}-${mmdd.slice(2)}`
  const lunar = LUNAR[year]

  add(`${year}-01-01`, '신정')
  // 설날·추석 연휴 3일
  const seollal = lunar ? spread(ymd(lunar[0])) : []
  const chuseok = lunar ? spread(ymd(lunar[2])) : []
  seollal.forEach((d, i) => add(d, i === 1 ? '설날' : '설날 연휴'))
  chuseok.forEach((d, i) => add(d, i === 1 ? '추석' : '추석 연휴'))
  const fixed: [string, string, boolean][] = [
    // [날짜, 이름, 대체공휴일 있음]
    [`${year}-03-01`, '삼일절', true],
    ...(year >= 2026 ? ([[`${year}-05-01`, '노동절', true]] as [string, string, boolean][]) : []),
    [`${year}-05-05`, '어린이날', true],
    [`${year}-06-06`, '현충일', false],
    ...(year >= 2026 ? ([[`${year}-07-17`, '제헌절', true]] as [string, string, boolean][]) : []),
    [`${year}-08-15`, '광복절', true],
    [`${year}-10-03`, '개천절', true],
    [`${year}-10-09`, '한글날', true],
    [`${year}-12-25`, '성탄절', true],
  ]
  for (const [d, n] of fixed) add(d, n)
  if (lunar) add(ymd(lunar[1]), '부처님오신날')
  for (const h of EXTRA) if (h.date.startsWith(`${year}-`)) add(h.date, h.name)

  // 대체공휴일 계산
  const taken = new Set(list.map((h) => h.date))
  const countOn = (d: string) => list.filter((h) => h.date === d && !h.substitute).length
  const nextFree = (from: string) => {
    let d = addDays(parseDateKey(from), 1)
    while (d.getDay() === 0 || d.getDay() === 6 || taken.has(key(d))) d = addDays(d, 1)
    return key(d)
  }
  const subs: Holiday[] = []
  const push = (after: string, name: string) => {
    const date = nextFree(after)
    taken.add(date)
    subs.push({ date, name: '대체공휴일', substitute: name })
  }
  for (const days of [seollal, chuseok]) {
    if (!days.length) continue
    // 연휴 중 일요일이 있거나 다른 공휴일과 겹치면 하루
    const hits = days.filter((d) => parseDateKey(d).getDay() === 0 || countOn(d) > 1).length
    let last = days[2]
    for (let i = 0; i < hits; i++) {
      push(last, days === seollal ? '설날' : '추석')
      last = subs[subs.length - 1].date
    }
  }
  const subsOf = [...fixed.filter(([, , s]) => s).map(([d, n]) => [d, n] as const), ...(lunar ? ([[ymd(lunar[1]), '부처님오신날']] as const) : [])]
  for (const [d, n] of [...subsOf].sort((a, b) => a[0].localeCompare(b[0]))) {
    const dow = parseDateKey(d).getDay()
    if (dow === 0 || dow === 6 || countOn(d) > 1) push(d, n)
  }

  const all = [...list, ...subs].sort((a, b) => a.date.localeCompare(b.date))
  cache.set(year, all)
  return all
}

/** 날짜 앞뒤 하루 (3일) */
function spread(day: string): string[] {
  const d = parseDateKey(day)
  return [key(addDays(d, -1)), day, key(addDays(d, 1))]
}

/** from~to 사이 공휴일 (날짜 → 이름 목록) */
export function holidaysBetween(from: string, to: string): Map<string, Holiday[]> {
  const map = new Map<string, Holiday[]>()
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y++) {
    for (const h of holidaysOfYear(y)) {
      if (h.date < from || h.date > to) continue
      map.set(h.date, [...(map.get(h.date) ?? []), h])
    }
  }
  return map
}

/** 공휴일 막대 색 */
export const HOLIDAY_COLOR = '#e5737a'

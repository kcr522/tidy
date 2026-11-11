/**
 * 웹에서 구글 캘린더 iCal 주소를 대신 읽어 오는 서버 쪽 코드 (api/ical.ts, 개발 서버가 같이 쓴다).
 * 브라우저는 구글 주소를 직접 못 읽어서(CORS) 우리 서버가 대신 읽는다.
 * 아무 주소나 대신 읽어 주는 통로가 되지 않도록 구글 캘린더 주소만 받는다. 주소는 어디에도 남기지 않는다.
 */
export class IcalProxyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** 받는 주소: https://calendar.google.com/calendar/ical/… */
export function isAllowedIcalUrl(raw: string): boolean {
  try {
    const u = new URL(raw)
    return u.protocol === 'https:' && u.hostname === 'calendar.google.com' && u.pathname.startsWith('/calendar/ical/') && !u.username && !u.password && !u.port
  } catch {
    return false
  }
}

/** 너무 큰 파일은 받지 않는다 (5MB) */
export const MAX_ICS_BYTES = 5 * 1024 * 1024

type Fetch = (input: string, init?: RequestInit) => Promise<Response>

export async function fetchIcal(url: string, f: Fetch = fetch, signal?: AbortSignal): Promise<string> {
  if (!isAllowedIcalUrl(url)) throw new IcalProxyError(400, '구글 캘린더 iCal 주소만 가져올 수 있어요')
  let res: Response
  try {
    // 다른 주소로 넘어가지 않게 한다 (구글 주소인 척하고 다른 곳을 읽게 하는 것을 막는다)
    res = await f(url, { redirect: 'manual', signal, headers: { accept: 'text/calendar' } })
  } catch {
    throw new IcalProxyError(502, '구글 캘린더에 연결하지 못했어요')
  }
  if (res.status === 404) throw new IcalProxyError(404, '주소를 찾을 수 없어요. 비공개 주소를 다시 복사해 주세요')
  if (res.status >= 300) throw new IcalProxyError(502, `가져오지 못했어요 (${res.status})`)
  const len = Number(res.headers.get('content-length') ?? 0)
  if (len > MAX_ICS_BYTES) throw new IcalProxyError(413, '캘린더가 너무 커요')
  const text = await res.text()
  if (text.length > MAX_ICS_BYTES) throw new IcalProxyError(413, '캘린더가 너무 커요')
  if (!text.includes('BEGIN:VCALENDAR')) throw new IcalProxyError(422, '캘린더 주소가 아니에요. "iCal 형식의 비공개 주소"를 넣어 주세요')
  return text
}

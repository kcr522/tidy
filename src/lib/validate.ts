// 입력 검사 — spec FR-011, FR-020, FR-030~032, Edge Cases

export const MAX_AMOUNT = 999_999_999
export const MAX_TITLE_LENGTH = 100
export const MAX_MEMO_LENGTH = 200
/** 할 일 메모·참고 글 최대 길이 */
export const MAX_TODO_MEMO_LENGTH = 1000

export type Result<T> = { ok: true; value: T } | { ok: false; error: string }

/** "15,000" 같은 입력을 정수 금액으로 검사 */
export function parseAmount(input: string): Result<number> {
  const cleaned = input.replace(/[,\s원]/g, '')
  if (cleaned === '') return { ok: false, error: '금액을 입력해 주세요' }
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: '금액은 숫자만 입력해 주세요' }
  const value = Number(cleaned)
  if (value < 1) return { ok: false, error: '금액을 입력해 주세요' }
  if (value > MAX_AMOUNT) return { ok: false, error: '금액이 너무 커요 (최대 999,999,999원)' }
  return { ok: true, value }
}

/** 제목: 앞뒤 공백 제거, 1~100자 */
export function validateTitle(input: string, emptyMessage = '내용을 입력해 주세요'): Result<string> {
  const value = input.trim()
  if (value === '') return { ok: false, error: emptyMessage }
  if (value.length > MAX_TITLE_LENGTH) return { ok: false, error: `${MAX_TITLE_LENGTH}자까지 입력할 수 있어요` }
  return { ok: true, value }
}

/** 메모: 앞뒤 공백 제거, 0~200자 */
export function validateMemo(input: string): Result<string> {
  const value = input.trim()
  if (value.length > MAX_MEMO_LENGTH) return { ok: false, error: `메모는 ${MAX_MEMO_LENGTH}자까지 입력할 수 있어요` }
  return { ok: true, value }
}

/**
 * URL 정규화와 검사
 * - 스킴이 없으면 https:// 를 붙인다
 * - http/https 외의 스킴(javascript:, file: 등)은 거부한다
 * - 도메인에 점(.)이 없으면 거부한다 (localhost 제외)
 */
export function normalizeUrl(input: string): Result<string> {
  const trimmed = input.trim()
  const invalid = { ok: false as const, error: '올바른 주소를 입력해 주세요' }
  if (trimmed === '') return { ok: false, error: '주소를 입력해 주세요' }

  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  const withScheme = hasScheme ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return invalid
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return invalid
  if (!url.hostname.includes('.') && url.hostname !== 'localhost') return invalid
  return { ok: true, value: url.href }
}

/** http/https 주소인지만 본다 (javascript: 같은 위험한 주소 막기) */
export function isWebUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string') return false
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** URL에서 도메인만 (www. 제거): 제목이 비었을 때 사용 */
export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

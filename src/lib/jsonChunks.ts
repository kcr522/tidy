/**
 * 큰 백업을 한 번에 큰 글자 하나로 만들지 않고 조각조각 만들고, 조각조각 파일에 쓴다.
 *
 * 폰 앱은 파일 쓰기를 할 때 글자 전체를 앱 안쪽(안드로이드)으로 한 번에 넘긴다.
 * 일기 사진·첨부 파일이 많아 백업이 수십 MB가 되면 이때 메모리가 모자라 "백업하지 못했어요"가 났다.
 * 그래서 JSON.stringify 결과와 똑같은 글자를 조각으로 만들고, 작은 조각으로 나눠 이어 쓴다.
 */

/** 파일에 한 번에 넘길 글자 수 (약 0.5MB) */
export const CHUNK_CHARS = 512 * 1024

/** JSON.stringify(value) 와 똑같은 글자를 조각으로 낸다. 배열·객체 한 칸씩 따로 바꿔서 큰 글자 하나를 만들지 않는다 */
export function* jsonPieces(value: unknown, depth = 2): Generator<string> {
  if (depth > 0 && Array.isArray(value)) {
    yield '['
    for (let i = 0; i < value.length; i++) {
      if (i > 0) yield ','
      const v = value[i]
      // 배열 안의 undefined·함수는 JSON.stringify 처럼 null
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') yield 'null'
      else yield* jsonPieces(v, depth - 1)
    }
    yield ']'
    return
  }
  if (depth > 0 && typeof value === 'object' && value !== null && typeof (value as { toJSON?: unknown }).toJSON !== 'function') {
    yield '{'
    let first = true
    for (const [k, v] of Object.entries(value)) {
      if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue
      yield `${first ? '' : ','}${JSON.stringify(k)}:`
      first = false
      yield* jsonPieces(v, depth - 1)
    }
    yield '}'
    return
  }
  yield JSON.stringify(value)
}

/** 글자를 size 글자 안팎으로 자른다. 이모지(두 칸짜리 글자)가 반으로 갈리지 않게 한다 */
export function* splitText(text: string, size = CHUNK_CHARS): Generator<string> {
  let i = 0
  while (i < text.length) {
    let end = Math.min(text.length, i + size)
    const c = text.charCodeAt(end - 1)
    if (end < text.length && c >= 0xd800 && c <= 0xdbff) end -= 1
    yield text.slice(i, end)
    i = end
  }
}

/** 조각들을 size 글자 안팎의 덩어리로 다시 묶는다 (너무 잘게 여러 번 쓰지 않게) */
export function* rechunk(pieces: Iterable<string>, size = CHUNK_CHARS): Generator<string> {
  let buf = ''
  for (const p of pieces) {
    buf += p
    if (buf.length < size) continue
    const parts = [...splitText(buf, size)]
    buf = parts.pop() ?? ''
    yield* parts
    if (buf.length >= size) {
      yield buf
      buf = ''
    }
  }
  if (buf) yield buf
}

/** 실패 알림 뒤에 붙일 짧은 이유: " (No space left on device)". 다음에 원인을 찾기 쉽게 */
export function errorHint(err: unknown): string {
  const msg = (err instanceof Error ? err.message : typeof err === 'string' ? err : '').trim()
  return msg ? ` (${msg.length > 60 ? `${msg.slice(0, 60)}…` : msg})` : ''
}

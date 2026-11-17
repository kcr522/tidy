import { CapacitorHttp } from '@capacitor/core'
import { db } from '../db/database'
import { buildPushItems, planPush, type PushItem, type RemoteItem } from '../lib/gcalPush'
import { dropGoogleToken, forgetGoogleToken, getGoogleToken, GoogleAuthError } from './googleAuth'
import { isNativeApp } from './native'

/**
 * Tidy → 구글 캘린더 보내기 (구글 로그인).
 * 사용자 구글 계정에 "Tidy" 캘린더를 하나 만들고, Tidy 일정과 할 일을 그대로 비춰 둔다.
 * Tidy 에서 넣고 고치고 지우면 몇 초 뒤 구글에도 똑같이 된다. 다른 구글 캘린더는 건드리지 않는다.
 */
export interface GooglePushSettings {
  /** 구글에 만든 Tidy 캘린더 id */
  calendarId: string
  email?: string
  /** 마감일 있는 할 일도 보낼지 (기본 끔. 2026-11-17 사용자 요청으로 할 일은 캘린더와 따로) */
  todos: boolean
  last?: string
  count?: number
  /** 마지막 오류 (다음에 잘 되면 지운다) */
  error?: string
}

const KEY = 'tidy-google-push'
const EVENT = 'tidy:google-push'
const API = 'https://www.googleapis.com/calendar/v3'

export function loadGooglePush(): GooglePushSettings | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<GooglePushSettings> | null
    if (!v || typeof v.calendarId !== 'string') return null
    return {
      calendarId: v.calendarId,
      // 예전에 저장된 'todos' 는 기본이 켬이었다. 새 키 'sendTodos' 로 바꾸고 기본은 끔
      todos: (v as { sendTodos?: unknown }).sendTodos === true,
      ...(typeof v.email === 'string' && { email: v.email }),
      ...(typeof v.last === 'string' && { last: v.last }),
      ...(typeof v.count === 'number' && { count: v.count }),
      ...(typeof v.error === 'string' && { error: v.error }),
    }
  } catch {
    return null
  }
}

function save(v: GooglePushSettings | null) {
  if (v) {
    const { todos, ...rest } = v
    localStorage.setItem(KEY, JSON.stringify({ ...rest, sendTodos: todos }))
  } else localStorage.removeItem(KEY)
  window.dispatchEvent(new CustomEvent(EVENT))
}

function patch(change: Partial<GooglePushSettings>, drop: (keyof GooglePushSettings)[] = []) {
  const cur = loadGooglePush()
  if (!cur) return
  const next: GooglePushSettings = { ...cur, ...change }
  for (const k of drop) delete next[k]
  save(next)
}

export function onGooglePushChange(fn: () => void): () => void {
  window.addEventListener(EVENT, fn)
  return () => window.removeEventListener(EVENT, fn)
}

export class GoogleApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** 구글 API 부르기. 폰 앱은 CapacitorHttp(브라우저 제한 없음), 웹은 fetch */
async function call<T>(token: string, method: string, path: string, body?: unknown): Promise<T> {
  const url = path.startsWith('https://') ? path : API + path
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let status: number
  let data: unknown
  if (isNativeApp()) {
    const res = await CapacitorHttp.request({ url, method, headers, data: body, connectTimeout: 15000, readTimeout: 30000 })
    status = res.status
    data = typeof res.data === 'string' && res.data ? safeJson(res.data) : res.data
  } else {
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    status = res.status
    const text = await res.text()
    data = text ? safeJson(text) : null
  }
  if (status === 401) dropGoogleToken(token)
  if (status >= 400) {
    const msg = (data as { error?: { message?: string } } | null)?.error?.message
    throw new GoogleApiError(status, msg ?? `구글 오류 (${status})`)
  }
  return data as T
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return s
  }
}

async function email(token: string): Promise<string | undefined> {
  try {
    return (await call<{ email?: string }>(token, 'GET', 'https://www.googleapis.com/oauth2/v3/userinfo')).email
  } catch {
    return undefined
  }
}

async function createCalendar(token: string): Promise<string> {
  const cal = await call<{ id: string }>(token, 'POST', '/calendars', { summary: 'Tidy', description: 'Tidy 앱에서 넣은 일정과 할 일이에요. 여기서 고치면 다음에 Tidy 내용으로 다시 바뀌어요.', timeZone: zone() })
  return cal.id
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul'

/** 구글 Tidy 캘린더에 지금 있는 일정 (지운 것 빼고) */
async function listRemote(token: string, calendarId: string): Promise<RemoteItem[]> {
  const out: RemoteItem[] = []
  let page: string | undefined
  do {
    const q = new URLSearchParams({ maxResults: '2500', showDeleted: 'false', fields: 'items(id,extendedProperties),nextPageToken' })
    if (page) q.set('pageToken', page)
    const r = await call<{ items?: { id: string; extendedProperties?: { private?: { tidy?: string } } }[]; nextPageToken?: string }>(token, 'GET', `/calendars/${encodeURIComponent(calendarId)}/events?${q}`)
    for (const it of r.items ?? []) out.push({ id: it.id, hash: it.extendedProperties?.private?.tidy })
    page = r.nextPageToken
  } while (page)
  return out
}

const withHash = (it: PushItem) => ({ ...it.body, extendedProperties: { private: { tidy: it.hash } } })

/** 한 번에 몇 개씩 (구글이 너무 빨리 부르면 막는다) */
async function eachLimited<T>(list: T[], fn: (v: T) => Promise<void>, size = 4) {
  for (let i = 0; i < list.length; i += size) await Promise.all(list.slice(i, i + size).map(fn))
}

async function pushWith(token: string, s: GooglePushSettings): Promise<number> {
  const [events, todos] = await Promise.all([db.events.toArray(), db.todos.toArray()])
  const want = buildPushItems(events, todos, { todos: s.todos, timeZone: zone() })
  let calendarId = s.calendarId
  let remote: RemoteItem[]
  try {
    remote = await listRemote(token, calendarId)
  } catch (err) {
    // 사용자가 구글에서 Tidy 캘린더를 지웠으면 새로 만든다
    if (!(err instanceof GoogleApiError && err.status === 404)) throw err
    calendarId = await createCalendar(token)
    patch({ calendarId })
    remote = []
  }
  const plan = planPush(want, remote)
  const base = `/calendars/${encodeURIComponent(calendarId)}/events`
  await eachLimited(plan.insert, async (it) => {
    try {
      await call(token, 'POST', base, { id: it.id, ...withHash(it) })
    } catch (err) {
      // 예전에 지운 일정과 id 가 같으면 구글이 409 를 준다 → 되살려서 덮어쓴다
      if (!(err instanceof GoogleApiError && err.status === 409)) throw err
      await call(token, 'PUT', `${base}/${it.id}`, { ...withHash(it), status: 'confirmed' })
    }
  })
  await eachLimited(plan.update, (it) => call(token, 'PUT', `${base}/${it.id}`, withHash(it)).then(() => undefined))
  await eachLimited(plan.remove, async (id) => {
    try {
      await call(token, 'DELETE', `${base}/${id}`)
    } catch (err) {
      if (!(err instanceof GoogleApiError && (err.status === 404 || err.status === 410))) throw err
    }
  })
  return want.length
}

function errorText(err: unknown): string {
  if (err instanceof GoogleAuthError) return err.message
  if (err instanceof GoogleApiError) {
    if (err.status === 401 || err.status === 403) return '구글 권한이 끊겼어요. 다시 연결해 주세요'
    if (err.status === 429) return '구글이 잠깐 막았어요. 조금 뒤에 다시 보내요'
    return err.message
  }
  return '구글에 보내지 못했어요. 인터넷을 확인해 주세요'
}

/** 처음 연결: 구글 계정 고르기 → Tidy 캘린더 만들기 → 지금 내용 보내기 */
export async function connectGooglePush(todos = false): Promise<number> {
  const token = await getGoogleToken(true)
  if (!token) throw new GoogleAuthError('구글 권한을 받지 못했어요')
  const old = loadGooglePush()
  const calendarId = old?.calendarId ?? (await createCalendar(token))
  save({ calendarId, todos: old?.todos ?? todos, email: await email(token) })
  return pushNow(true)
}

let running: Promise<number> | null = null
let again = false

/**
 * 지금 보내기. interactive 가 아니면 창을 띄우지 않고, 권한이 없으면 조용히 그만둔다.
 * 보내는 중에 또 부르면 끝난 뒤 한 번 더 보낸다.
 */
export async function pushNow(interactive = false): Promise<number> {
  if (running) {
    again = true
    return running
  }
  const s = loadGooglePush()
  if (!s) return 0
  running = (async () => {
    try {
      const token = await getGoogleToken(interactive)
      if (!token) {
        // 폰 앱인데 창 없이 못 받았으면 허락이 풀린 것 (구글 클라우드가 "테스트" 상태면 7일마다 풀린다)
        if (isNativeApp()) patch({ error: '구글 허락이 풀렸어요. "지금 보내기"를 눌러 다시 허락해 주세요' })
        return s.count ?? 0
      }
      const n = await pushWith(token, s)
      patch({ last: new Date().toISOString(), count: n }, ['error'])
      return n
    } catch (err) {
      patch({ error: errorText(err) })
      if (interactive) throw err
      return s.count ?? 0
    } finally {
      running = null
    }
  })()
  const n = await running
  if (again) {
    again = false
    return pushNow(false)
  }
  return n
}

export function setPushTodos(todos: boolean) {
  patch({ todos })
}

/**
 * 연결 끊기. removeCalendar 면 구글의 Tidy 캘린더도 지운다 (실패해도 연결은 끊는다).
 */
export async function disconnectGooglePush(removeCalendar: boolean): Promise<void> {
  const s = loadGooglePush()
  if (s && removeCalendar) {
    try {
      const token = await getGoogleToken(true)
      if (token) await call(token, 'DELETE', `/calendars/${encodeURIComponent(s.calendarId)}`)
    } catch {
      // 구글에서 직접 지울 수 있다
    }
  }
  forgetGoogleToken()
  save(null)
}

/** 화면에 보여 줄 오류 문장 (테스트용으로도 쓴다) */
export { errorText as googlePushErrorText }

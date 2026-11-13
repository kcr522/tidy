import { CapacitorHttp } from '@capacitor/core'
import { isNativeApp } from './native'

/**
 * 폰 앱에서는 브라우저(WebView) 대신 폰이 직접 요청을 보낸다.
 * 어떤 AI 서버(Groq 등)는 앱 안 브라우저에서 바로 오는 요청(CORS)을 막아서 "연결하지 못했어요"가 난다.
 * fetch 와 같은 모양으로 쓸 수 있게 Response 로 돌려준다. (JSON 을 보내고 받는 POST/GET 만)
 */
export const nativeFetch: typeof fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  const headers = Object.fromEntries(new Headers(init?.headers).entries())
  const body = typeof init?.body === 'string' ? init.body : undefined
  const res = await CapacitorHttp.request({
    url,
    method: init?.method ?? 'GET',
    headers,
    ...(body ? { data: JSON.parse(body) } : {}),
    responseType: 'json',
    connectTimeout: 15000,
    readTimeout: 60000,
  })
  const text = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? {})
  return new Response(text, { status: res.status, headers: { 'content-type': 'application/json' } })
}

/** 폰 앱이면 nativeFetch, 웹이면 브라우저 fetch */
export const appFetch = (): typeof fetch => (isNativeApp() ? nativeFetch : fetch)

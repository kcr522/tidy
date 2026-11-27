import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import capacitorConfig from '../../capacitor.config'

// 보안 강화 2026-11-27: 웹 보안 머리글(vercel.json) · 폰 앱 디버그 끄기가 빠지거나 어긋나지 않게 지킨다
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')
const vercel = JSON.parse(read('vercel.json')) as { headers: { source: string; headers: { key: string; value: string }[] }[] }
const allPages = vercel.headers.find((h) => h.source === '/(.*)')!.headers
const header = (key: string) => allPages.find((h) => h.key === key)?.value ?? ''
const csp = header('Content-Security-Policy')
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? ''

describe('웹 보안 머리글 (vercel.json)', () => {
  it.each([
    ['X-Content-Type-Options', 'nosniff'],
    ['X-Frame-Options', 'DENY'],
    ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ])('%s 머리글이 %s 이다', (key, value) => {
    expect(header(key)).toBe(value)
  })

  it('HTTPS 만 쓰라는 머리글(HSTS)이 1년 이상이다', () => {
    const ONE_YEAR = 31536000

    const maxAge = Number(header('Strict-Transport-Security').match(/max-age=(\d+)/)?.[1])

    expect(maxAge).toBeGreaterThanOrEqual(ONE_YEAR)
  })

  it.each([
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['frame-ancestors', "'none'"],
    ['form-action', "'self'"],
  ])('CSP 의 %s 가 %s 로 막혀 있다', (name, value) => {
    expect(directive(name)).toBe(`${name} ${value}`)
  })

  it('CSP 의 script-src 가 아무 곳(* · https: · unsafe-inline · unsafe-eval)이나 열어 두지 않는다', () => {
    const scripts = directive('script-src').split(/\s+/)

    for (const loose of ['*', 'https:', "'unsafe-inline'", "'unsafe-eval'", 'data:']) expect(scripts).not.toContain(loose)
  })

  it('index.html 의 글 속 스크립트마다 CSP 에 그 지문(sha256)이 있다 (고치면 vercel.json 도 같이 고쳐야 화면이 뜬다)', () => {
    const inline = [...read('index.html').matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])

    const hashes = inline.map((code) => `'sha256-${createHash('sha256').update(code).digest('base64')}'`)

    expect(inline.length).toBeGreaterThan(0)
    for (const hash of hashes) expect(directive('script-src')).toContain(hash)
  })
})

describe('폰 앱 디버그 끄기', () => {
  it('앱 화면을 크롬 chrome://inspect 로 들여다볼 수 없다', () => {
    expect(capacitorConfig.android?.webContentsDebuggingEnabled).toBe(false)
  })

  it('배포하는 debug 판 APK 도 디버그 모드(run-as 로 기록 꺼내기)가 꺼져 있다', () => {
    const debugBlock = read('android/app/build.gradle').match(/buildTypes\s*\{\s*debug\s*\{([\s\S]*?)\}/)?.[1] ?? ''

    expect(debugBlock).toMatch(/debuggable\s+false/)
  })
})

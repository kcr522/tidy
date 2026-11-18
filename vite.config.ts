/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }
import { adminEnvFrom, handleAdmin } from './src/lib/admin/adminServer.ts'
import { handleAiProxy, proxyEnvFrom } from './src/lib/ai/proxyServer.ts'
import { fetchIcal, IcalProxyError } from './src/lib/icalProxy.ts'
import { captureSite, readPageContent } from './src/lib/scrap/pageContent.ts'
import { buildPreview, PreviewError } from './src/lib/scrap/previewServer.ts'

/** 배포된 웹이 어느 커밋인지 알 수 있게 dist/version.json 을 만든다 (.github/workflows/web-deploy.yml 이 합친 뒤 실제 사이트에 새 버전이 올라갔는지 확인할 때 쓴다) */
function buildVersionFile(): Plugin {
  return {
    name: 'tidy-version-file',
    apply: 'build',
    generateBundle() {
      const info = { version: pkg.version, commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? '', branch: process.env.VERCEL_GIT_COMMIT_REF ?? '', builtAt: new Date().toISOString() }
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(info) })
    },
  }
}

/** 개발 중(npm run dev)에도 링크 미리보기가 되도록: 배포 때 api/preview.ts 가 하는 일을 똑같이 한다 */
function devPreviewApi(): Plugin {
  return {
    name: 'tidy-dev-preview-api',
    configureServer(server) {
      server.middlewares.use('/api/preview', async (req, res) => {
        const params = new URL(req.url ?? '', 'http://localhost').searchParams
        const url = params.get('url') ?? ''
        const mode = params.get('mode')
        res.setHeader('content-type', 'application/json; charset=utf-8')
        try {
          if (mode === 'content') res.end(JSON.stringify(await readPageContent(url, fetch, AbortSignal.timeout(15000), params.get('images') !== '0')))
          else if (mode === 'shot') res.end(JSON.stringify({ imageData: await captureSite(url, fetch, AbortSignal.timeout(40000)) }))
          else res.end(JSON.stringify(await buildPreview(url, fetch, AbortSignal.timeout(9000))))
        } catch (err) {
          res.statusCode = err instanceof PreviewError ? err.status : 502
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : '미리보기를 가져오지 못했어요' }))
        }
      })
      // Tidy AI (배포 때는 api/ai.ts). 키는 개발할 때 GEMINI_API_KEY=… npm run dev 로 넣는다
      server.middlewares.use('/api/ai', async (req, res) => {
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        let body: unknown = null
        try {
          body = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
        } catch {
          body = null
        }
        const r = await handleAiProxy({ method: req.method ?? 'GET', authorization: req.headers.authorization, body }, proxyEnvFrom(process.env))
        res.statusCode = r.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(r.body))
      })
      // 관리자 페이지 (배포 때는 api/admin.ts). ADMIN_EMAILS=… FIREBASE_SERVICE_ACCOUNT=… npm run dev 로 넣는다
      server.middlewares.use('/api/admin', async (req, res) => {
        const check = new URL(req.url ?? '', 'http://localhost').searchParams.has('check')
        const r = await handleAdmin({ method: req.method ?? 'GET', authorization: req.headers.authorization, check }, adminEnvFrom(process.env))
        res.statusCode = r.status
        res.setHeader('content-type', 'application/json; charset=utf-8')
        res.end(JSON.stringify(r.body))
      })
      // 구글 캘린더 불러오기 (배포 때는 api/ical.ts)
      server.middlewares.use('/api/ical', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost').searchParams.get('url') ?? ''
        try {
          const text = await fetchIcal(url, fetch, AbortSignal.timeout(15000))
          res.setHeader('content-type', 'text/calendar; charset=utf-8')
          res.end(text)
        } catch (err) {
          res.statusCode = err instanceof IcalProxyError ? err.status : 502
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : '가져오지 못했어요' }))
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    devPreviewApi(),
    buildVersionFile(),
    react(),
    tailwindcss(),
    // PWA: 오프라인 동작 + 폰 홈 화면/컴퓨터 "앱 설치" 지원
    VitePWA({
      registerType: 'autoUpdate',
      // 등록은 main.tsx 에서 직접 한다 (폰 앱에서는 서비스 워커를 쓰지 않는다)
      injectRegister: false,
      workbox: {
        // 서버 함수(/api/…)는 앱 화면으로 바꿔치기하지 않는다
        navigateFallbackDenylist: [/^\/api\//, /^\/privacy/],
        // 글자 인식 파일(16MB)은 처음 설치 때 받지 않고, 캡처 인식을 처음 쓸 때 받아 둔다
        // HEIC 사진 변환 도구(3MB)도 HEIC 사진을 처음 고를 때 받아 둔다
        globIgnores: ['ocr/**', '**/heic-to-*.js'],
        // 글씨체(Pretendard) 조각 파일은 처음 쓸 때 받아 두고, 그 뒤로는 오프라인에서도 쓴다
        runtimeCaching: [
          {
            urlPattern: ({ url }) => /\/assets\/heic-to-[\w-]+\.js$/.test(url.pathname),
            handler: 'CacheFirst',
            options: { cacheName: 'tidy-heic', expiration: { maxEntries: 2 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/ocr/'),
            handler: 'CacheFirst',
            options: { cacheName: 'tidy-ocr', expiration: { maxEntries: 10 }, cacheableResponse: { statuses: [200] } },
          },
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'tidy-fonts', expiration: { maxEntries: 120 } },
          },
          // 가게 로고: 한 번 받으면 기기에 저장해 두고 오프라인에서도 보여 준다
          {
            urlPattern: ({ url }) => (url.hostname === 'www.google.com' && url.pathname.startsWith('/s2/favicons')) || url.hostname.endsWith('.gstatic.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tidy-logos',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Tidy',
        short_name: 'Tidy',
        description: '가계부 · 할 일 · 스크랩을 하나로 정리하는 앱',
        lang: 'ko',
        start_url: '/',
        display: 'standalone',
        background_color: '#f2f4f6',
        theme_color: '#f2f4f6',
        // 다른 앱(인스타그램, 네이버, X …)에서 "공유" → Tidy 를 고르면 /share 로 열린다 (안드로이드 크롬에 설치한 앱)
        share_target: {
          action: '/share',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})

/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json' with { type: 'json' }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    tailwindcss(),
    // PWA: 오프라인 동작 + 폰 홈 화면/컴퓨터 "앱 설치" 지원
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // 글씨체(Pretendard) 조각 파일은 처음 쓸 때 받아 두고, 그 뒤로는 오프라인에서도 쓴다
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'tidy-fonts', expiration: { maxEntries: 120 } },
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

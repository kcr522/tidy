// docs/개발-기록.md → docs/개발-기록.pdf
// 필요한 것: pandoc, Playwright(Chromium). 글꼴은 node_modules/pretendard 를 쓴다.
// 사용법: node scripts/doc-pdf.mjs [입력.md] [출력.pdf]
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const input = resolve(root, process.argv[2] ?? 'docs/개발-기록.md')
const output = resolve(root, process.argv[3] ?? input.replace(/\.md$/, '.pdf'))

const fontCandidates = [
  process.env.PRETENDARD_WOFF2,
  resolve(root, 'node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2'),
].filter(Boolean)
const font = fontCandidates.find((p) => existsSync(p))
const fontFace = font ? `@font-face { font-family: 'Pretendard'; src: url('data:font/woff2;base64,${readFileSync(font).toString('base64')}') format('woff2'); font-weight: 100 900; }` : ''

const body = execFileSync('pandoc', ['-f', 'gfm', '-t', 'html5', input], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

const css = `${fontFace}
  body { font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; color: #1f2937; font-size: 10.5pt; line-height: 1.6; margin: 0; }
  h1 { font-size: 24pt; margin: 0 0 12pt; background: linear-gradient(90deg, #7c3aed, #ec4899, #f59e0b); -webkit-background-clip: text; color: transparent; }
  h2 { font-size: 15pt; margin: 22pt 0 8pt; padding-bottom: 4pt; border-bottom: 2px solid #ede9fe; color: #4c1d95; break-after: avoid; }
  h3 { font-size: 12pt; margin: 14pt 0 6pt; color: #5b21b6; break-after: avoid; }
  table { border-collapse: collapse; width: 100%; margin: 6pt 0 10pt; font-size: 9pt; }
  th, td { border: 1px solid #e5e7eb; padding: 4pt 6pt; vertical-align: top; }
  th { background: #f5f3ff; text-align: left; }
  tr { break-inside: avoid; }
  blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #faf5ff; border-left: 3px solid #a78bfa; color: #4b5563; }
  code { font-size: 9pt; background: #f3f4f6; padding: 0 3pt; border-radius: 3pt; }
  a { color: #6d28d9; text-decoration: none; }
  hr { border: 0; border-top: 1px solid #e5e7eb; margin: 16pt 0; }
`
const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`

const require = createRequire(import.meta.url)
let playwright
try {
  playwright = require('playwright')
} catch {
  playwright = await import('playwright')
}
const browser = await playwright.chromium.launch()
const page = await browser.newPage()
await page.setContent(html, { waitUntil: 'load' })
await page.pdf({
  path: output,
  format: 'A4',
  margin: { top: '16mm', bottom: '16mm', left: '14mm', right: '14mm' },
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: `<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;">Tidy 개발 기록 · <span class="pageNumber"></span> / <span class="totalPages"></span></div>`,
})
await browser.close()
console.log(`PDF 저장: ${output}${font ? '' : ' (Pretendard 글꼴 없음, 기본 글꼴 사용)'}`)

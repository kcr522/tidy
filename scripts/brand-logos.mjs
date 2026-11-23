// 가계부 가게 로고 모으기: 브랜드 공식 앱(Google Play)의 아이콘을 받아 public/brands/ 에 넣는다.
// 구글 아이콘 서비스(favicon)는 다이소 · 롯데리아 · GS25 같은 곳에서 아이콘이 없거나 흐려서, 앱 아이콘을 앱 안에 넣어 둔다.
//
//   node scripts/brand-logos.mjs find 다이소 올리브영 …  → 검색 결과 위 3개 (패키지 | 앱 이름) 를 보여 준다
//   node scripts/brand-logos.mjs get                      → src/lib/merchants.ts 의 app: 패키지마다 아이콘을 받는다
//
// 손으로 돌리기 어려우면 GitHub Actions 의 'Brand logos' 를 돌린다 (받은 아이콘을 그 브랜치에 올려 준다).
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36'
const SIZE = 96

async function page(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ko-KR,ko;q=0.9' } })
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

const meta = (html, prop) => html.match(new RegExp(`<meta[^>]+(?:property|name)="${prop}"[^>]+content="([^"]+)"`))?.[1]?.replace(/&amp;/g, '&') ?? null

async function details(id) {
  const html = await page(`https://play.google.com/store/apps/details?id=${id}&hl=ko&gl=KR`)
  const title = (meta(html, 'og:title') ?? '').replace(/\s*-\s*Google Play.*$/, '')
  const dev = html.match(/href="\/store\/apps\/dev(?:eloper)?\?id=[^"]+"[^>]*>(?:<[^>]+>)*([^<]+)</)?.[1] ?? ''
  const image = meta(html, 'og:image')
  return { id, title, dev, image }
}

async function find(queries) {
  for (const q of queries) {
    try {
      const html = await page(`https://play.google.com/store/search?q=${encodeURIComponent(q)}&c=apps&hl=ko&gl=KR`)
      const ids = [...new Set([...html.matchAll(/details\?id=([\w.]+)/g)].map((m) => m[1]))].slice(0, 3)
      for (const id of ids) {
        const d = await details(id).catch((e) => ({ id, title: `(${e.message})`, dev: '' }))
        console.log(`FIND\t${q}\t${d.id}\t${d.title}\t${d.dev}`)
      }
    } catch (e) {
      console.log(`FIND\t${q}\tERROR\t${e.message}`)
    }
  }
}

async function get() {
  const src = await readFile('src/lib/merchants.ts', 'utf8')
  const ids = [...new Set([...src.matchAll(/app:\s*'([\w.]+)'/g)].map((m) => m[1]))]
  await mkdir('public/brands', { recursive: true })
  let bad = 0
  for (const id of ids) {
    try {
      const d = await details(id)
      if (!d.image) throw new Error('아이콘 주소 없음')
      const res = await fetch(`${d.image.replace(/=[^/]*$/, '')}=s${SIZE}-rw`, { headers: { 'user-agent': UA } })
      if (!res.ok) throw new Error(`아이콘 ${res.status}`)
      const buf = Buffer.from(await res.arrayBuffer())
      await writeFile(`public/brands/${id}.webp`, buf)
      console.log(`GET\t${id}\t${d.title}\t${d.dev}\t${buf.length}B`)
    } catch (e) {
      bad++
      console.log(`GET\t${id}\tERROR\t${e.message}`)
    }
  }
  if (bad) process.exitCode = 1
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === 'find') await find(rest)
else if (mode === 'get') await get()
else console.log('node scripts/brand-logos.mjs find <이름…> | get')

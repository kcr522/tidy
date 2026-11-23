// 가계부 가게 로고 모으기: 브랜드 공식 앱(Google Play)의 아이콘을 받아 public/brands/ 에 넣는다.
// 구글 아이콘 서비스(favicon)는 다이소 · 롯데리아 · GS25 같은 곳에서 아이콘이 없거나 흐려서, 앱 아이콘을 앱 안에 넣어 둔다.
//
//   node scripts/brand-logos.mjs find 다이소 올리브영 …  → 검색 결과 위 3개 (패키지 | 앱 이름) 를 보여 준다
//   node scripts/brand-logos.mjs get                      → src/lib/merchants.ts 의 withApp(패키지) 마다 앱 아이콘을,
//                                                            withWiki(문서) 마다 위키백과 로고 그림을 받는다
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

/** 위키백과 문서에 들어 있는 로고 그림(파일 이름에 logo/로고) → PNG. title 은 '롯데리아' 또는 'en:Lotteria', 여러 개는 | 로 */
async function wikiLogo(titles) {
  const ua = { 'user-agent': 'TidyBrandLogos/1.0 (github.com/kcr522/tidy)' }
  for (const t of titles.split('|')) {
    const [lang, title] = t.includes(':') ? t.split(':') : ['ko', t]
    const base = `https://${lang}.wikipedia.org/w/api.php?format=json&action=query&redirects=1`
    const list = await (await fetch(`${base}&prop=images&imlimit=100&titles=${encodeURIComponent(title)}`, { headers: ua })).json()
    const files = Object.values(list.query?.pages ?? {}).flatMap((p) => (p.images ?? []).map((i) => i.title))
    const logo = files.find((f) => /logo|로고/i.test(f) && !/commons-logo|wiki.*logo|edit|question|symbol_|flag/i.test(f))
    if (!logo) continue
    const info = await (await fetch(`${base}&prop=imageinfo&iiprop=url&iiurlwidth=256&titles=${encodeURIComponent(logo)}`, { headers: ua })).json()
    const url = Object.values(info.query?.pages ?? {})[0]?.imageinfo?.[0]?.thumburl
    if (url) return { url, name: logo }
  }
  throw new Error('위키백과 로고 없음')
}

async function save(file, url, label) {
  const res = await fetch(url, { headers: { 'user-agent': 'TidyBrandLogos/1.0 (github.com/kcr522/tidy)' } })
  if (!res.ok) throw new Error(`그림 ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await writeFile(`public/brands/${file}`, buf)
  console.log(`GET\t${file}\t${label}\t${buf.length}B`)
}

async function get() {
  const src = await readFile('src/lib/merchants.ts', 'utf8')
  const apps = [...new Set([...src.matchAll(/withApp\('([\w.]+)'/g)].map((m) => m[1]))]
  const wikis = [...src.matchAll(/withWiki\('([^']+)', b\('[^']+', '([^']+)'/g)].map((m) => ({ title: m[1], domain: m[2] }))
  await mkdir('public/brands', { recursive: true })
  let bad = 0
  for (const id of apps) {
    try {
      const d = await details(id)
      if (!d.image) throw new Error('아이콘 주소 없음')
      await save(`${id}.webp`, `${d.image.replace(/=[^/]*$/, '')}=s${SIZE}-rw`, `${d.title} | ${d.dev}`)
    } catch (e) {
      bad++
      console.log(`GET\t${id}\tERROR\t${e.message}`)
    }
  }
  for (const w of wikis) {
    try {
      const { url, name } = await wikiLogo(w.title)
      await save(`${w.domain}.png`, url, `${w.title} | ${name}`)
    } catch (e) {
      bad++
      console.log(`GET\t${w.domain}\tERROR\t${e.message}`)
    }
  }
  if (bad) process.exitCode = 1
}

const [mode, ...rest] = process.argv.slice(2)
if (mode === 'find') await find(rest)
else if (mode === 'get') await get()
else console.log('node scripts/brand-logos.mjs find <이름…> | get')

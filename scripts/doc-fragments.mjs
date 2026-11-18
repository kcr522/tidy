// 개발 기록 조각(docs/개발-기록-조각/*.md)을 docs/개발-기록.md 에 넣는다.
// PR마다 개발-기록.md 의 같은 줄(표 맨 아래, 마지막 갱신)을 고치면 PR끼리 충돌이 나서, PR은 조각 파일만 더하고
// 합친 뒤 .github/workflows/dev-record.yml 이 이 스크립트로 넣고 PDF를 다시 만든다.
// 사용법: node scripts/doc-fragments.mjs [합친 PR 번호]
//
// 조각 파일 모양 (파일 이름은 아무거나, 다른 PR과 겹치지 않게 브랜치 이름 등):
//   ## 6
//   | 2026-11-18 | #? | 기능 | 무엇을 했는지 | 검토 중 |
//   ## 4-7
//   | 기능 | 설명 | 🧪 | #? |
//   ## 5-2
//   | 항목 | #? | 확인할 것 |
// '## 숫자' 는 개발-기록.md 의 '## 6.' · '### 4-7.' 같은 제목을 가리키고, 그 아래 첫 표 맨 끝에 줄을 붙인다.
// '#?' 는 합친 PR 번호로 바뀐다. 합친 PR의 6번 줄 상태 '검토 중' 은 '합침' 으로 바뀐다.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const docPath = join(root, 'docs/개발-기록.md')
const dir = join(root, 'docs/개발-기록-조각')
const pr = process.argv[2] && /^\d+$/.test(process.argv[2]) ? process.argv[2] : ''

let lines = readFileSync(docPath, 'utf8').split('\n')
const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort() : []

/** 'n' 섹션 제목 줄 번호 (## n. / ### n.) */
function sectionStart(key) {
  const re = new RegExp(`^#{2,4} ${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.? `)
  return lines.findIndex((l) => re.test(l))
}

/** 섹션 안 첫 표의 마지막 줄 번호 */
function tableEnd(start) {
  let i = start + 1
  while (i < lines.length && !lines[i].startsWith('|')) {
    if (/^#{1,4} /.test(lines[i])) return -1
    i++
  }
  if (i >= lines.length) return -1
  while (i + 1 < lines.length && lines[i + 1].startsWith('|')) i++
  return i
}

let added = 0
const problems = []
for (const f of files) {
  const text = readFileSync(join(dir, f), 'utf8')
  let key = ''
  const groups = new Map()
  for (const raw of text.split('\n')) {
    const l = raw.trimEnd()
    const h = l.match(/^##\s+([\d-]+)/)
    if (h) key = h[1]
    else if (l.startsWith('|') && key) groups.set(key, [...(groups.get(key) ?? []), pr ? l.replaceAll('#?', `#${pr}`) : l])
  }
  const missing = [...groups.keys()].filter((k) => sectionStart(k) < 0 || tableEnd(sectionStart(k)) < 0)
  if (missing.length) {
    problems.push(`${f}: '${missing.join(', ')}' 섹션의 표를 못 찾아서 이 조각은 그대로 둠`)
    continue
  }
  for (const [k, rows] of groups) {
    lines.splice(tableEnd(sectionStart(k)) + 1, 0, ...rows)
    added += rows.length
  }
  rmSync(join(dir, f))
}

if (pr) {
  // 6. 변경 기록에서 이 PR 줄의 '검토 중' → '합침'
  const s6 = sectionStart('6')
  for (let i = s6 + 1; s6 >= 0 && i < lines.length && !/^## /.test(lines[i]); i++) {
    if (lines[i].startsWith('|') && lines[i].includes(`| #${pr} |`)) lines[i] = lines[i].replace(/\|\s*검토 중\s*\|\s*$/, '| 합침 |')
  }
  const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
  lines = lines.map((l) => (l.startsWith('| 마지막 갱신 |') ? `| 마지막 갱신 | ${today} (PR #${pr}까지 반영) |` : l))
}

writeFileSync(docPath, lines.join('\n'))
console.log(`조각 ${files.length}개, ${added}줄 넣음${pr ? `, PR #${pr}` : ''}`)
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

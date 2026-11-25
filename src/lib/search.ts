// 전체 검색: 가계부 · 할 일 · 일기 · 스크랩 · 메모 · 일정에서 내가 쓴 글을 찾는다.
// 데이터는 기기 안(IndexedDB)에 있어서 서버 없이 바로 찾는다.
import type { Bookmark, CalendarEvent, Diary, Memo, MemoFolder, Todo, Transaction } from '../db/types'
import { inkText, memoTitle } from './memo'

export type SearchKind = 'money' | 'todo' | 'diary' | 'scrap' | 'memo' | 'event'

export const KIND_LABEL: Record<SearchKind, string> = {
  money: '가계부',
  todo: '할 일',
  diary: '일기',
  scrap: '스크랩',
  memo: '메모',
  event: '일정',
}

/** 화면에 보여 주는 순서 */
export const KIND_ORDER: SearchKind[] = ['money', 'todo', 'diary', 'scrap', 'memo', 'event']

interface Base {
  /** 목록 key 로 쓰는 고유 값 */
  key: string
  /** 제목 줄 */
  title: string
  /** 찾은 글자가 들어 있는 부분 (제목에서 찾았으면 다른 내용 앞부분) */
  snippet: string
  /** 어디서 찾았는지 (예: 메모, AI 요약) */
  field: string
  /** 정렬용 날짜 (YYYY-MM-DD 또는 ISO) — 최근 것이 위로 */
  sortKey: string
}

export type SearchHit =
  | (Base & { kind: 'money'; item: Transaction })
  | (Base & { kind: 'todo'; item: Todo })
  | (Base & { kind: 'diary'; item: Diary })
  | (Base & { kind: 'scrap'; item: Bookmark })
  | (Base & { kind: 'memo'; item: Memo; folder?: MemoFolder })
  | (Base & { kind: 'event'; item: CalendarEvent })

export interface SearchData {
  transactions?: Transaction[]
  todos?: Todo[]
  diaries?: Diary[]
  bookmarks?: Bookmark[]
  events?: CalendarEvent[]
  memos?: Memo[]
  memoFolders?: MemoFolder[]
}

/** 대소문자와 띄어쓰기 차이는 무시한다 ("스타 벅스" = "스타벅스") */
export function normalize(text: string): string {
  return text.normalize('NFC').toLowerCase().replace(/\s+/g, '')
}

/** 검색어를 띄어쓰기로 나눈다. 여러 단어면 모두 들어 있는 것만 찾는다 */
export function splitQuery(query: string): string[] {
  return query
    .normalize('NFC')
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
}

type Field = [label: string, text: string | undefined | null]

/** 숫자만 쓴 검색어("5000", "5,000원")면 그 금액과 똑같은 내역도 찾는다 */
function amountTerm(term: string): string | null {
  const digits = term.replace(/[,원]/g, '')
  return /^\d+$/.test(digits) ? digits : null
}

/**
 * 모든 검색어가 (필드 중 어디에든) 들어 있으면 그 필드를 돌려준다.
 * 가장 먼저 찾은 필드가 snippet 이 된다.
 */
function matchFields(fields: Field[], terms: string[], amount?: number): { label: string; text: string; term: string } | null {
  const norm = fields.map(([label, text]) => ({ label, text: text ?? '', n: normalize(text ?? '') }))
  let first: { label: string; text: string; term: string } | null = null
  for (const term of terms) {
    const t = normalize(term)
    const hit = norm.find((f) => f.n.includes(t))
    if (hit) {
      if (!first) first = { label: hit.label, text: hit.text, term }
      continue
    }
    const digits = amountTerm(term)
    if (digits && amount != null && amount === Number(digits)) {
      if (!first) first = { label: '금액', text: '', term }
      continue
    }
    return null
  }
  return first
}

/** 찾은 글자 앞뒤로 조금만 잘라서 보여 준다 */
export function makeSnippet(text: string, term: string, radius = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (!flat) return ''
  const at = flat.toLowerCase().indexOf(term.toLowerCase())
  if (at < 0 || flat.length <= radius * 2) return flat.length > radius * 2 ? `${flat.slice(0, radius * 2)}…` : flat
  const start = Math.max(0, at - radius)
  const end = Math.min(flat.length, at + term.length + radius)
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`
}

const fileNames = (list?: { name: string }[]) => (list ?? []).map((a) => a.name).join(' · ')

/**
 * 검색어로 모든 기록을 찾는다. 검색어가 비어 있으면 빈 목록.
 * 같은 종류 안에서는 최근 것이 위로 온다.
 */
export function searchAll(data: SearchData, query: string): SearchHit[] {
  const terms = splitQuery(query)
  if (terms.length === 0) return []
  const hits: SearchHit[] = []

  // 찾은 필드가 제목이면 다른 내용(메모 등)을 보조 줄로 보여 준다
  const pick = (m: { label: string; text: string; term: string }, title: string, fallback: string) =>
    m.text && m.text !== title ? makeSnippet(m.text, m.term) : makeSnippet(fallback, m.term)

  for (const t of data.transactions ?? []) {
    const m = matchFields(
      [
        ['가게 · 소비처', t.memo],
        ['메모', t.note],
        ['카테고리', t.category],
        ['결제 수단', t.account],
        ['원래 이름', t.originalMemo],
      ],
      terms,
      t.amount,
    )
    if (!m) continue
    const title = t.memo || t.category
    hits.push({ kind: 'money', key: `money-${t.id}`, item: t, title, field: m.label, snippet: pick(m, title, ''), sortKey: `${t.date} ${t.time ?? ''}` })
  }

  for (const t of data.todos ?? []) {
    const m = matchFields(
      [
        ['할 일', t.title],
        ['메모', t.memo],
        ['첨부 파일', fileNames(t.attachments)],
      ],
      terms,
    )
    if (!m) continue
    hits.push({ kind: 'todo', key: `todo-${t.id}`, item: t, title: t.title, field: m.label, snippet: pick(m, t.title, t.memo ?? ''), sortKey: t.dueDate ?? t.createdAt })
  }

  for (const d of data.diaries ?? []) {
    const notes = (d.photos ?? []).map((p) => p.note).filter(Boolean).join(' · ')
    const m = matchFields(
      [
        ['일기', d.text],
        ['사진 메모', notes],
        ['시간별 기록', (d.hours ?? []).map((h) => h.text).join(' · ')],
        ['첨부 파일', fileNames(d.attachments)],
      ],
      terms,
    )
    if (!m) continue
    hits.push({ kind: 'diary', key: `diary-${d.date}`, item: d, title: d.date, field: m.label, snippet: makeSnippet(m.text, m.term), sortKey: d.date })
  }

  for (const b of data.bookmarks ?? []) {
    const m = matchFields(
      [
        ['제목', b.title],
        ['메모', b.memo],
        ['AI 요약', b.summary],
        ['설명', b.description],
        ['사이트', b.siteName],
        ['링크', b.url],
      ],
      terms,
    )
    if (!m) continue
    const title = b.title || b.url
    hits.push({ kind: 'scrap', key: `scrap-${b.id}`, item: b, title, field: m.label, snippet: pick(m, title, b.memo || b.summary || ''), sortKey: b.createdAt })
  }

  const folders = new Map((data.memoFolders ?? []).map((f) => [f.id, f]))
  for (const n of data.memos ?? []) {
    const folder = n.folderId ? folders.get(n.folderId) : undefined
    const m = matchFields(
      [
        ['제목', n.title],
        ['메모', n.text],
        ['손글씨', inkText(n)],
        ['첨부 파일', fileNames(n.attachments)],
        ['파일집', folder?.name],
      ],
      terms,
    )
    if (!m) continue
    const title = memoTitle(n)
    hits.push({ kind: 'memo', key: `memo-${n.id}`, item: n, folder, title, field: m.label, snippet: pick(m, title, n.text), sortKey: n.createdAt })
  }

  for (const e of data.events ?? []) {
    const m = matchFields(
      [
        ['일정', e.title],
        ['메모', e.memo],
        ['첨부 파일', fileNames(e.attachments)],
      ],
      terms,
    )
    if (!m) continue
    hits.push({ kind: 'event', key: `event-${e.id}`, item: e, title: e.title, field: m.label, snippet: pick(m, e.title, e.memo), sortKey: e.startDate })
  }

  const order = (k: SearchKind) => KIND_ORDER.indexOf(k)
  return hits.sort((a, b) => order(a.kind) - order(b.kind) || b.sortKey.localeCompare(a.sortKey))
}

/** 글자 속에서 검색어 부분을 표시하기 위해 나눈다: [보통, 찾은 글자, 보통, ...] */
export function highlightParts(text: string, terms: string[]): { text: string; hit: boolean }[] {
  const words = terms.map((t) => t.trim()).filter(Boolean)
  if (!text || words.length === 0) return [{ text, hit: false }]
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).sort((a, b) => b.length - a.length)
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  return text
    .split(re)
    .filter((p) => p !== '')
    .map((p) => ({ text: p, hit: words.some((w) => w.toLowerCase() === p.toLowerCase()) }))
}

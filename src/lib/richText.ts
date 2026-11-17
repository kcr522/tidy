/**
 * 메모 글 꾸미기 (사용자 요청 2026-11-17, "삼성 노트처럼")
 * 굵게 · 밑줄 · 가운데 줄 · 형광펜 · 글자 색 · 글머리 기호 · 번호 · 글 사이 사진(크기 · 자르기).
 *
 * 저장 모양
 * - memo.html: 꾸민 글. 허용한 태그 · 스타일만 남긴다 (붙여 넣은 글의 스크립트 등은 버린다)
 * - 글 사이 사진은 html 에 <img data-pic="id" style="width:50%"> 로만 두고, 사진 자체(data URL)는 memo.pics 에 따로 둔다.
 *   그래야 동기화가 사진을 따로 "파일"로 올린다 (Firestore 문서 하나 1MB 한도)
 * - memo.text: 꾸밈을 뺀 글자. 검색 · 목록 미리보기 · 위젯은 그대로 이것을 쓴다
 */
import type { MemoPic } from '../db/types'
import { isDataUrl } from './attachments'

/** 형광펜 색 (글자 뒤 배경) */
export const HIGHLIGHT_COLORS: { name: string; hex: string }[] = [
  { name: '노랑', hex: '#fff176' },
  { name: '연두', hex: '#c5f07a' },
  { name: '분홍', hex: '#ffb3d1' },
  { name: '하늘', hex: '#a7dcff' },
  { name: '주황', hex: '#ffcc80' },
]

/** 글자 색 */
export const TEXT_COLORS: { name: string; hex: string }[] = [
  { name: '빨강', hex: '#e5484d' },
  { name: '주황', hex: '#f0802b' },
  { name: '초록', hex: '#2ea97c' },
  { name: '파랑', hex: '#4f63e0' },
  { name: '보라', hex: '#8c70da' },
]

/** 메모 하나에 글 사이 사진 몇 장까지 */
export const MAX_MEMO_PICS = 30
/** 사진 크기 (가로 %): 너무 작으면 못 누른다 */
export const MIN_PIC_WIDTH = 15

const BLOCK = new Set(['DIV', 'P', 'UL', 'OL', 'LI', 'H1', 'H2', 'H3', 'BLOCKQUOTE'])
/** 그대로 두는 태그 (나머지는 껍데기만 벗기고 안의 글자는 남긴다) */
const KEEP: Record<string, string> = {
  B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', S: 's', STRIKE: 's', DEL: 's', MARK: 'mark', SPAN: 'span',
  DIV: 'div', P: 'div', H1: 'div', H2: 'div', H3: 'div', BLOCKQUOTE: 'div', UL: 'ul', OL: 'ol', LI: 'li', BR: 'br', IMG: 'img',
}
const DROP = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'HEAD', 'TITLE', 'META', 'LINK', 'SVG', 'MATH', 'NOSCRIPT', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'])

const COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|transparent)$/i

/** 남겨도 되는 스타일만: 글자 색 · 형광펜 · 굵게 · 기울임 · 밑줄 · 가운데 줄 · 가운데 맞춤 */
function cleanStyle(el: HTMLElement, tag: string): string {
  const st = el.style
  const out: string[] = []
  if (tag === 'img') {
    const w = parseFloat(st.width)
    if (st.width.endsWith('%') && w > 0) out.push(`width:${clampWidth(w)}%`)
    return out.join(';')
  }
  const color = st.color.trim()
  if (color && COLOR.test(color)) out.push(`color:${color}`)
  const bg = st.backgroundColor.trim()
  if (bg && COLOR.test(bg) && bg !== 'transparent' && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(bg)) out.push(`background-color:${bg}`)
  const fw = st.fontWeight
  if (fw === 'bold' || Number(fw) >= 600) out.push('font-weight:bold')
  if (st.fontStyle === 'italic') out.push('font-style:italic')
  const deco = `${st.textDecorationLine || ''} ${st.textDecoration || ''}`
  const lines = ['underline', 'line-through'].filter((d) => deco.includes(d))
  if (lines.length) out.push(`text-decoration:${lines.join(' ')}`)
  if (BLOCK.has(el.tagName) && st.textAlign === 'center') out.push('text-align:center')
  return out.join(';')
}

export const clampWidth = (w: number) => Math.round(Math.min(100, Math.max(MIN_PIC_WIDTH, w)))

function parse(html: string): HTMLElement {
  const doc = new DOMParser().parseFromString(`<!doctype html><body><div id="r">${html}</div></body>`, 'text/html')
  return doc.getElementById('r')!
}

/**
 * 허용한 태그 · 스타일만 남긴다. 사진은 data-pic 이름(과 편집 화면에서는 src)만.
 * keepSrc: 편집 화면 html (사진 src 를 남긴다). 저장할 때는 false
 */
export function sanitizeHtml(html: string, keepSrc = false): string {
  const root = parse(html)
  const out = root.ownerDocument.createElement('div')
  copyChildren(root, out, keepSrc)
  return out.innerHTML
}

function copyChildren(from: Node, to: HTMLElement, keepSrc: boolean) {
  const doc = to.ownerDocument
  for (const node of Array.from(from.childNodes)) {
    if (node.nodeType === 3) {
      to.appendChild(doc.createTextNode(node.textContent ?? ''))
      continue
    }
    if (node.nodeType !== 1) continue
    const el = node as HTMLElement
    if (DROP.has(el.tagName)) continue
    const tag = KEEP[el.tagName]
    if (!tag) {
      copyChildren(el, to, keepSrc)
      continue
    }
    const next = doc.createElement(tag)
    if (tag === 'img') {
      const id = el.getAttribute('data-pic')
      if (!id || !/^[\w-]{1,40}$/.test(id)) continue
      next.setAttribute('data-pic', id)
      const src = el.getAttribute('src')
      if (keepSrc && src && isDataUrl(src)) next.setAttribute('src', src)
      next.setAttribute('alt', '')
    }
    const style = cleanStyle(el, tag)
    if (style) next.setAttribute('style', style)
    if (tag !== 'img' && tag !== 'br') copyChildren(el, next, keepSrc)
    // 빈 꾸밈 껍데기는 버린다
    if (['b', 'i', 'u', 's', 'mark', 'span'].includes(tag) && !next.textContent && !next.querySelector('img,br')) continue
    to.appendChild(next)
  }
}

/** 꾸밈을 뺀 글자 (검색 · 미리보기용). 줄은 그대로, 글머리 기호는 '• ', 번호는 '1. ' */
export function htmlToText(html: string): string {
  const root = parse(html)
  const lines: string[] = []
  let cur = ''
  const flush = () => {
    lines.push(cur)
    cur = ''
  }
  function walk(node: Node, list?: { ordered: boolean; n: number }) {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) {
        cur += child.textContent ?? ''
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as HTMLElement
      if (el.tagName === 'BR') {
        flush()
        continue
      }
      if (el.tagName === 'UL' || el.tagName === 'OL') {
        if (cur) flush()
        walk(el, { ordered: el.tagName === 'OL', n: 0 })
        continue
      }
      if (el.tagName === 'LI') {
        if (cur) flush()
        cur = list?.ordered ? `${++list.n}. ` : '• '
        walk(el)
        flush()
        continue
      }
      if (BLOCK.has(el.tagName)) {
        if (cur) flush()
        const before = lines.length
        walk(el)
        // <div><br></div> 같은 빈 줄도 한 줄로
        if (cur || lines.length === before) flush()
        continue
      }
      walk(el, list)
    }
  }
  walk(root)
  if (cur) flush()
  return lines.join('\n').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** 꾸밈 없는 옛 메모 글 → 편집 화면 html (한 줄에 div 하나) */
export function textToHtml(text: string): string {
  if (!text) return ''
  return text
    .split('\n')
    .map((l) => `<div>${l ? escape(l) : '<br>'}</div>`)
    .join('')
}

/** 저장된 html + 사진 → 편집 화면 html (사진 src 를 채운다. 없는 사진은 뺀다) */
export function toEditorHtml(html: string | undefined, text: string, pics: readonly MemoPic[] | undefined): string {
  if (html === undefined) return textToHtml(text)
  const byId = new Map((pics ?? []).map((p) => [p.id, p.src]))
  const root = parse(sanitizeHtml(html))
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const src = byId.get(img.getAttribute('data-pic') ?? '')
    if (src) img.setAttribute('src', src)
    else img.remove()
  }
  return root.innerHTML
}

/** 편집 화면 html → 저장할 html + 그 안에 남은 사진들 (지운 사진은 같이 빠진다) */
export function fromEditorHtml(editorHtml: string): { html: string; pics: MemoPic[] } {
  const root = parse(sanitizeHtml(editorHtml, true))
  const pics: MemoPic[] = []
  const seen = new Set<string>()
  for (const img of Array.from(root.querySelectorAll('img'))) {
    const id = img.getAttribute('data-pic')!
    const src = img.getAttribute('src')
    if (!src || seen.has(id) || pics.length >= MAX_MEMO_PICS) {
      img.remove()
      continue
    }
    seen.add(id)
    pics.push({ id, src })
    img.removeAttribute('src')
  }
  return { html: root.innerHTML, pics }
}

/** 꾸밈이 하나도 없으면(그냥 글이면) html 을 따로 둘 필요가 없다 */
export function isPlainHtml(html: string): boolean {
  return !/<(b|i|u|s|mark|span|ul|ol|li|img)[\s>]|style=/.test(html)
}

/** 사진 이름 (메모 안에서만 겹치지 않으면 된다) */
export const newPicId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

/**
 * 다른 앱(삼성 노트 등)에서 '공유 → Tidy 메모'로 받은 글 · 사진 → 새 메모 본문.
 * 글 아래에 사진을 차례로 넣는다 (사진은 글 사이 사진이 되어 크기 · 자르기를 할 수 있다)
 */
export function sharedMemoBody(text: string, images: string[], makeId: () => string = newPicId): { html?: string; pics: MemoPic[]; text: string } {
  const body = text.replace(/\r\n?/g, '\n').trim()
  const pics = images.slice(0, MAX_MEMO_PICS).map((src) => ({ id: makeId(), src }))
  if (!pics.length) return { text: body, pics: [] }
  const html = textToHtml(body) + pics.map((p) => `<div><img data-pic="${p.id}" alt="" style="width:100%"></div>`).join('')
  return { html, pics, text: body }
}

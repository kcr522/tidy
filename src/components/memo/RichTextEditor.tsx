import { Bold, Brush, Crop, Highlighter, ImagePlus, Italic, List, ListOrdered, Loader2, Palette, Redo2, Strikethrough, Trash2, Underline, Undo2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useToast } from '../common/Toast'
import { shrinkImage } from '../../lib/image'
import { HIGHLIGHT_COLORS, MAX_MEMO_PICS, TEXT_COLORS, clampWidth, fromEditorHtml, htmlToText, newPicId, sanitizeHtml } from '../../lib/richText'
import type { MemoPic } from '../../db/types'
import HandwritingPad from './HandwritingPad'
import ImageCropper from './ImageCropper'

export interface RichValue {
  html: string
  pics: MemoPic[]
  text: string
}

interface Props {
  /** 처음 보여 줄 글 (편집 화면 html, 사진 src 가 들어 있다) */
  initial: string
  placeholder: string
  autoFocus?: boolean
  /** 글이 바뀔 때마다 (내용은 read 로 읽는다: 사진이 커서 매번 글자로 바꾸지 않는다) */
  onInput: (empty: boolean) => void
  /** 지금 내용을 읽는 함수를 넘겨준다 (화면이 닫힌 뒤에도 마지막 저장에 쓸 수 있게) */
  bindRead: (read: () => RichValue) => void
}

type Cmd = 'bold' | 'italic' | 'underline' | 'strikeThrough' | 'insertUnorderedList' | 'insertOrderedList'
const STATE_CMDS: Cmd[] = ['bold', 'italic', 'underline', 'strikeThrough', 'insertUnorderedList', 'insertOrderedList']

function readEl(el: HTMLElement): RichValue {
  const { html, pics } = fromEditorHtml(el.innerHTML)
  return { html, pics, text: htmlToText(html) }
}

const isEmptyEl = (el: HTMLElement) => !el.textContent?.trim() && !el.querySelector('img')

/**
 * 메모 본문: 삼성 노트처럼 꾸며 쓰기 (사용자 요청 2026-11-17)
 * 굵게 · 기울임 · 밑줄 · 가운데 줄 · 형광펜 · 글자 색 · 글머리 기호 · 번호, 글 사이 사진(누르면 크기 · 자르기 · 빼기)
 */
export default function RichTextEditor({ initial, placeholder, autoFocus, onInput, bindRead }: Props) {
  const toast = useToast()
  const box = useRef<HTMLDivElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const range = useRef<Range | null>(null)
  const [empty, setEmpty] = useState(true)
  const [active, setActive] = useState<Set<Cmd>>(new Set())
  const [palette, setPalette] = useState<'hilite' | 'color' | null>(null)
  const [pic, setPic] = useState<HTMLImageElement | null>(null)
  const [picWidth, setPicWidth] = useState(100)
  const [grip, setGrip] = useState<{ left: number; top: number } | null>(null)
  const [cropping, setCropping] = useState<HTMLImageElement | null>(null)
  /** 사진 위에 그리기 (펜 · 형광펜) */
  const [marking, setMarking] = useState<HTMLImageElement | null>(null)
  const [adding, setAdding] = useState(false)

  // 처음 한 번만 글을 넣는다 (그다음부터는 브라우저가 직접 고친다)
  useLayoutEffect(() => {
    const el = box.current!
    el.innerHTML = sanitizeHtml(initial, true)
    setEmpty(isEmptyEl(el))
    bindRead(() => readEl(el))
    if (autoFocus) el.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const changed = () => {
    const el = box.current
    if (!el) return
    const e = isEmptyEl(el)
    setEmpty(e)
    onInput(e)
  }

  // 커서가 움직이면: 마지막 자리를 기억하고(버튼을 눌러도 그 자리에), 켜진 꾸밈을 표시
  useEffect(() => {
    function onSel() {
      const el = box.current
      const sel = document.getSelection()
      if (!el || !sel || !sel.rangeCount) return
      const r = sel.getRangeAt(0)
      if (!el.contains(r.commonAncestorContainer)) return
      range.current = r.cloneRange()
      const on = new Set<Cmd>()
      for (const c of STATE_CMDS) {
        try {
          if (document.queryCommandState(c)) on.add(c)
        } catch {
          // 지원 안 하는 브라우저
        }
      }
      setActive(on)
    }
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [])

  /** 기억한 커서 자리로 돌아가서 */
  function restore() {
    const el = box.current!
    if (document.activeElement !== el) el.focus({ preventScroll: true })
    const sel = document.getSelection()
    // 커서가 이미 글 칸 안이면 그대로 둔다 (다시 놓으면 '이어서 굵게 끄기' 같은 설정이 풀린다)
    if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).commonAncestorContainer)) return
    if (range.current && sel && el.contains(range.current.commonAncestorContainer)) {
      sel.removeAllRanges()
      sel.addRange(range.current)
    }
  }

  function exec(cmd: string, value?: string) {
    restore()
    document.execCommand('styleWithCSS', false, cmd === 'hiliteColor' || cmd === 'foreColor' ? 'true' : 'false')
    document.execCommand(cmd, false, value)
    changed()
    const on = new Set<Cmd>()
    for (const c of STATE_CMDS) if (document.queryCommandState(c)) on.add(c)
    setActive(on)
  }

  // ── 사진 ──
  function selectPic(img: HTMLImageElement | null) {
    pic?.removeAttribute('data-sel')
    setPic(img)
    if (img) {
      img.setAttribute('data-sel', '')
      setPicWidth(clampWidth(parseFloat(img.style.width) || 100))
      setPalette(null)
    }
  }

  // 고른 사진 오른쪽 아래에 크기 손잡이
  useLayoutEffect(() => {
    if (!pic) return setGrip(null)
    const place = () => {
      const w = wrap.current?.getBoundingClientRect()
      const r = pic.getBoundingClientRect()
      if (w) setGrip({ left: r.right - w.left, top: r.bottom - w.top })
    }
    place()
    window.addEventListener('resize', place)
    const ro = new ResizeObserver(place)
    ro.observe(pic)
    if (box.current) ro.observe(box.current)
    return () => {
      window.removeEventListener('resize', place)
      ro.disconnect()
    }
  }, [pic, picWidth])

  function setWidth(w: number) {
    if (!pic) return
    const v = clampWidth(w)
    pic.style.width = `${v}%`
    setPicWidth(v)
    changed()
  }

  function dragGrip(e: React.PointerEvent) {
    if (!pic || !box.current) return
    e.preventDefault()
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    const left = pic.getBoundingClientRect().left
    const full = box.current.clientWidth - 32 // 안쪽 여백(p-4) 빼고
    const onMove = (ev: PointerEvent) => setWidth(((ev.clientX - left) / full) * 100)
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  function removePic() {
    if (!pic) return
    const p = pic
    selectPic(null)
    // 사진만 있던 줄이면 그 줄도
    const parent = p.parentElement
    p.remove()
    if (parent && parent !== box.current && !parent.textContent && !parent.querySelector('img')) parent.remove()
    changed()
  }

  async function addFiles(files: File[]) {
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (!images.length) return
    const have = box.current?.querySelectorAll('img').length ?? 0
    if (have + images.length > MAX_MEMO_PICS) toast(`글 사이 사진은 ${MAX_MEMO_PICS}장까지 넣을 수 있어요`, 'error')
    setAdding(true)
    try {
      let html = ''
      for (const f of images.slice(0, Math.max(0, MAX_MEMO_PICS - have))) {
        // 크게 보여도 되게 1600px 까지 (동기화 한도 안에 들어가게 JPEG 로 줄인다)
        const src = await shrinkImage(f, 1600, 0.85)
        html += `<div><img data-pic="${newPicId()}" src="${src}" alt="" style="width:100%"></div>`
      }
      if (!html) return
      restore()
      const el = box.current!
      const sel = document.getSelection()
      if (!sel || !sel.rangeCount || !el.contains(sel.getRangeAt(0).commonAncestorContainer)) {
        el.insertAdjacentHTML('beforeend', `${html}<div><br></div>`)
      } else {
        document.execCommand('insertHTML', false, `${html}<div><br></div>`)
      }
      changed()
    } catch {
      toast('사진을 넣지 못했어요', 'error')
    } finally {
      setAdding(false)
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = Array.from(e.clipboardData.files)
    if (files.some((f) => f.type.startsWith('image/'))) {
      e.preventDefault()
      void addFiles(files)
      return
    }
    // 다른 곳에서 복사한 글: 꾸밈은 허용한 것만, 사진 · 스크립트 등은 버린다
    const html = e.clipboardData.getData('text/html')
    e.preventDefault()
    if (html) document.execCommand('insertHTML', false, sanitizeHtml(html))
    else document.execCommand('insertText', false, e.clipboardData.getData('text/plain'))
    changed()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // 사진을 고른 채로 지우기 키
    if (pic && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault()
      removePic()
    }
  }

  return (
    <div ref={wrap} className="relative mt-1 rounded-2xl bg-slate-100 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-500">
      {/* 꾸미기 도구: 누를 때 글자 칸의 커서가 빠지지 않게 mousedown 을 막는다 */}
      <div className="sticky top-14 z-10 rounded-t-2xl border-b border-slate-200/70 bg-inherit md:top-0" onMouseDown={(e) => e.preventDefault()}>
        {pic ? (
          <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5" role="toolbar" aria-label="사진 고치기">
            <span className="px-1 text-xs font-bold text-slate-500">사진 크기</span>
            {[25, 50, 75, 100].map((w) => (
              <button key={w} type="button" onClick={() => setWidth(w)} aria-pressed={picWidth === w} className={`min-h-8 rounded-full px-2.5 text-xs font-bold ${picWidth === w ? 'bg-slate-800 text-white' : 'bg-white text-slate-600'}`}>
                {w}%
              </button>
            ))}
            <input type="range" min={15} max={100} value={picWidth} onChange={(e) => setWidth(Number(e.target.value))} className="w-24 accent-brand-600" aria-label="사진 크기 (%)" />
            <span className="flex-1" />
            <Tool label="사진 위에 그리기 (펜 · 형광펜)" onClick={() => setMarking(pic)}>
              <Brush className="size-[18px]" aria-hidden />
            </Tool>
            <Tool label="사진 자르기" onClick={() => setCropping(pic)}>
              <Crop className="size-[18px]" aria-hidden />
            </Tool>
            <Tool label="사진 빼기" onClick={removePic}>
              <Trash2 className="size-[18px]" aria-hidden />
            </Tool>
            <button type="button" onClick={() => selectPic(null)} className="min-h-8 rounded-full bg-brand-600 px-3 text-xs font-bold text-white">
              다 했어요
            </button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-0.5 px-1.5 py-1" role="toolbar" aria-label="글 꾸미기">
              <Tool label="굵게" on={active.has('bold')} onClick={() => exec('bold')}>
                <Bold className="size-[18px]" strokeWidth={2.6} aria-hidden />
              </Tool>
              <Tool label="기울임" on={active.has('italic')} onClick={() => exec('italic')}>
                <Italic className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="밑줄" on={active.has('underline')} onClick={() => exec('underline')}>
                <Underline className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="가운데 줄" on={active.has('strikeThrough')} onClick={() => exec('strikeThrough')}>
                <Strikethrough className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="형광펜" on={palette === 'hilite'} onClick={() => setPalette(palette === 'hilite' ? null : 'hilite')}>
                <Highlighter className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="글자 색" on={palette === 'color'} onClick={() => setPalette(palette === 'color' ? null : 'color')}>
                <Palette className="size-[18px]" aria-hidden />
              </Tool>
              <span className="mx-1 h-5 w-px shrink-0 bg-slate-300" />
              <Tool label="글머리 기호" on={active.has('insertUnorderedList')} onClick={() => exec('insertUnorderedList')}>
                <List className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="번호 매기기" on={active.has('insertOrderedList')} onClick={() => exec('insertOrderedList')}>
                <ListOrdered className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="글 사이에 사진 넣기" onClick={() => fileInput.current?.click()}>
                {adding ? <Loader2 className="size-[18px] animate-spin" aria-hidden /> : <ImagePlus className="size-[18px]" aria-hidden />}
              </Tool>
              <span className="mx-1 h-5 w-px shrink-0 bg-slate-300" />
              <Tool label="되돌리기" onClick={() => exec('undo')}>
                <Undo2 className="size-[18px]" aria-hidden />
              </Tool>
              <Tool label="다시 하기" onClick={() => exec('redo')}>
                <Redo2 className="size-[18px]" aria-hidden />
              </Tool>
            </div>
            {palette && (
              <div className="flex items-center gap-2 px-3 pb-2" role="group" aria-label={palette === 'hilite' ? '형광펜 색' : '글자 색'}>
                {(palette === 'hilite' ? HIGHLIGHT_COLORS : TEXT_COLORS).map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => exec(palette === 'hilite' ? 'hiliteColor' : 'foreColor', c.hex)}
                    className="size-8 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ background: c.hex }}
                    aria-label={`${palette === 'hilite' ? '형광펜' : '글자 색'} ${c.name}`}
                    title={c.name}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => (palette === 'hilite' ? exec('hiliteColor', 'transparent') : exec('foreColor', '#191f28'))}
                  className="min-h-8 shrink-0 rounded-full bg-white px-3 text-xs font-bold text-slate-600"
                >
                  {palette === 'hilite' ? '형광펜 지우기' : '기본 색'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="relative">
        {empty && <p className="pointer-events-none absolute top-4 left-4 text-base text-slate-400">{placeholder}</p>}
        <div
          ref={box}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="메모 내용"
          onInput={changed}
          onPaste={onPaste}
          onKeyDown={onKeyDown}
          onClick={(e) => selectPic(e.target instanceof HTMLImageElement ? e.target : null)}
          className="memo-rich min-h-60 p-4 text-base leading-relaxed break-words outline-none"
        />
      </div>

      {/* 고른 사진 크기 손잡이 (끌어서 크기 바꾸기) */}
      {pic && grip && (
        <span
          onPointerDown={dragGrip}
          className="absolute z-10 size-7 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize touch-none rounded-full border-[3px] border-white bg-brand-600 shadow"
          style={{ left: grip.left, top: grip.top }}
          aria-hidden
        />
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          void addFiles(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />

      {marking && (
        <HandwritingPad
          photo={marking.src}
          title="사진 위에 그리기"
          onCancel={() => setMarking(null)}
          onDone={(src) => {
            marking.src = src
            setMarking(null)
            changed()
          }}
        />
      )}

      {cropping && (
        <ImageCropper
          src={cropping.src}
          onCancel={() => setCropping(null)}
          onDone={(src) => {
            cropping.src = src
            setCropping(null)
            changed()
          }}
        />
      )}
    </div>
  )
}

function Tool({ label, on, onClick, children }: { label: string; on?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={`tap flex size-9 shrink-0 items-center justify-center rounded-xl ${on ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  )
}

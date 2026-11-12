import { useEffect, useRef, useState } from 'react'

/**
 * 컴퓨터에서 파일·사진을 끌어다 화면 아무 곳에 놓으면 받는다 (사용자 요청 2026-11-12)
 * 여러 곳에서 동시에 쓰면 가장 나중에 켜진 것(예: 열린 입력 창)만 받는다.
 * 돌려주는 값: 지금 파일을 끌고 화면 위에 있는지 (안내 화면을 띄울 때 쓴다)
 */
type Entry = { id: number; drop: (files: File[]) => void; setDragging: (v: boolean) => void }
const stack: Entry[] = []
let nextId = 0
let depth = 0

const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')
const top = () => stack[stack.length - 1]

function onEnter(e: DragEvent) {
  if (!hasFiles(e) || !top()) return
  e.preventDefault()
  depth++
  top().setDragging(true)
}
function onOver(e: DragEvent) {
  if (!hasFiles(e) || !top()) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
function onLeave(e: DragEvent) {
  if (!hasFiles(e) || !top()) return
  depth = Math.max(0, depth - 1)
  if (depth === 0) top().setDragging(false)
}
function onDrop(e: DragEvent) {
  if (!hasFiles(e) || !top()) return
  e.preventDefault()
  depth = 0
  const entry = top()
  entry.setDragging(false)
  const files = Array.from(e.dataTransfer?.files ?? [])
  if (files.length) entry.drop(files)
}

function listen(on: boolean) {
  const fn = on ? window.addEventListener : window.removeEventListener
  fn('dragenter', onEnter)
  fn('dragover', onOver)
  fn('dragleave', onLeave)
  fn('drop', onDrop)
}

export function useFileDrop(onFiles: (files: File[]) => void, enabled = true): boolean {
  const [dragging, setDragging] = useState(false)
  const latest = useRef(onFiles)
  latest.current = onFiles
  useEffect(() => {
    if (!enabled) return
    const entry: Entry = { id: nextId++, drop: (f) => latest.current(f), setDragging }
    const under = top()
    under?.setDragging(false)
    if (stack.length === 0) listen(true)
    stack.push(entry)
    return () => {
      const i = stack.findIndex((x) => x.id === entry.id)
      if (i >= 0) stack.splice(i, 1)
      setDragging(false)
      if (stack.length === 0) {
        depth = 0
        listen(false)
      }
    }
  }, [enabled])
  return dragging
}

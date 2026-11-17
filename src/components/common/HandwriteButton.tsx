import { Loader2, Signature } from 'lucide-react'
import { useState } from 'react'
import { HandwritingError, readHandwriting } from '../../lib/ai/handwriting'
import HandwritingPad from '../memo/HandwritingPad'
import { useToast } from './Toast'

/** 원래 글 뒤에 손글씨에서 읽은 글을 붙인다 (한 줄 칸은 띄어쓰기, 여러 줄 칸은 줄바꿈) */
export function appendHandwritten(old: string, text: string, multiline: boolean, max?: number): string {
  const add = multiline ? text.trim() : text.replace(/\s*\n\s*/g, ' ').trim()
  if (!add) return old
  const sep = !old ? '' : multiline ? (old.endsWith('\n') ? '' : '\n') : old.endsWith(' ') ? '' : ' '
  const out = old + sep + add
  return max ? out.slice(0, max) : out
}

interface Props {
  /** 읽은 글자 (붙이는 것은 부르는 쪽에서) */
  onText: (text: string) => void
  /** 화면에 보일 이름 (예: '일기') */
  label?: string
  className?: string
  /** 아이콘만 (작은 칸 옆) */
  compact?: boolean
}

/**
 * 손글씨로 쓰기 (사용자 요청 2026-11-17): 손가락 · S펜으로 쓰면 Tidy AI 가 글자(한글)로 바꿔 칸에 넣어 준다.
 * 메모 · 일기 · 할 일 · 가계부 · 스크랩 · 일정의 글 칸 옆에 둔다.
 */
export default function HandwriteButton({ onText, label, className = '', compact }: Props) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reading, setReading] = useState(false)

  async function done(png: string) {
    setOpen(false)
    setReading(true)
    try {
      const text = await readHandwriting(png)
      if (!text) toast('글자를 찾지 못했어요. 조금 크게 또박또박 써 주세요', 'error')
      else onText(text)
    } catch (err) {
      toast(err instanceof HandwritingError ? err.message : '손글씨를 글자로 바꾸지 못했어요', 'error')
    } finally {
      setReading(false)
    }
  }

  const name = label ? `${label}에 손글씨로 쓰기` : '손글씨로 쓰기'
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={reading}
        aria-label={name}
        title="손글씨로 쓰면 글자로 바꿔 넣어요"
        className={`inline-flex shrink-0 items-center justify-center gap-1 rounded-full font-semibold text-slate-600 hover:bg-slate-200 disabled:opacity-60 ${compact ? 'size-10 bg-slate-100' : 'min-h-8 bg-slate-100 px-3 text-xs'} ${className}`}
      >
        {reading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Signature className="size-4" aria-hidden />}
        {!compact && (reading ? '글자로 바꾸는 중…' : '손글씨로 쓰기')}
      </button>
      {open && <HandwritingPad title="손글씨로 쓰기 · 글자로 바뀌어요" onDone={(png) => void done(png)} onCancel={() => setOpen(false)} />}
    </>
  )
}

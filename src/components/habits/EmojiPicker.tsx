import { X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { EMOJI_GROUPS, firstEmoji, loadRecentEmojis } from '../../lib/emojiCatalog'

interface Props {
  current?: string
  onPick: (emoji: string) => void
  onClose: () => void
}

/** 습관 아이콘 고르기 창: 주제별 이모티콘 + 직접 입력 */
export default function EmojiPicker({ current, onPick, onClose }: Props) {
  const recent = loadRecentEmojis()
  const tabs = recent.length ? [{ name: '최근', emojis: recent }, ...EMOJI_GROUPS] : EMOJI_GROUPS
  const [tab, setTab] = useState(tabs[0].name)
  const [typed, setTyped] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const emojis = tabs.find((t) => t.name === tab)?.emojis ?? []
  const typedEmoji = firstEmoji(typed)

  // 펼치면 창 안에서 보이는 곳으로 내린다
  useEffect(() => {
    ref.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }, [])

  return (
    <div ref={ref} className="mt-2 rounded-2xl bg-slate-50 p-3" role="region" aria-label="아이콘 고르기">
      <div className="mb-2 flex items-center gap-2">
        <p className="flex-1 text-sm font-bold">아이콘 고르기</p>
        <button type="button" onClick={onClose} className="rounded-full bg-white p-1.5 text-slate-500 shadow-card" aria-label="닫기">
          <X className="size-3.5" strokeWidth={2.5} aria-hidden />
        </button>
      </div>

      <div className="-mx-3 mb-2 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="tablist" aria-label="이모티콘 주제">
        {tabs.map((t) => (
          <button
            key={t.name}
            type="button"
            role="tab"
            aria-selected={tab === t.name}
            onClick={() => setTab(t.name)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap transition ${tab === t.name ? 'bg-grad text-white shadow-float' : 'bg-white text-slate-500 shadow-card'}`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1 overflow-y-auto" role="tabpanel" aria-label={tab}>
        {emojis.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onPick(e)}
            aria-label={`${e} 고르기`}
            aria-pressed={current === e}
            className={`flex aspect-square items-center justify-center rounded-xl text-[24px] transition active:scale-90 ${current === e ? 'bg-brand-100 ring-2 ring-brand-500/60' : 'hover:bg-white'}`}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (typedEmoji) onPick(typedEmoji)
            }
          }}
          placeholder="여기 없으면 키보드로 이모티콘 입력"
          aria-label="이모티콘 직접 입력"
          className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm shadow-card outline-none focus:ring-2 focus:ring-brand-500/40"
        />
        <button
          type="button"
          disabled={!typedEmoji}
          onClick={() => typedEmoji && onPick(typedEmoji)}
          className="shrink-0 rounded-xl bg-grad px-3 py-2 text-sm font-bold text-white shadow-float disabled:opacity-40"
        >
          {typedEmoji ? `${typedEmoji} 쓰기` : '쓰기'}
        </button>
      </div>
    </div>
  )
}

import { Check, Palette } from 'lucide-react'
import type { EventColor } from '../../db/types'
import { EVENT_COLORS, PRESET_EVENT_COLORS, eventBg, eventFg } from '../../lib/eventLayout'

interface Props {
  value: EventColor
  onChange: (c: EventColor) => void
  label: string
  /** 동그라미 크기 (설정 화면은 작게) */
  small?: boolean
}

/** 일정 색 고르기: 21가지 색 + 무지개 동그라미로 아무 색이나 직접 */
export default function EventColorPicker({ value, onChange, label, small }: Props) {
  const custom = value.startsWith('#')
  const size = small ? 'size-7' : 'size-9'
  return (
    <div className={`flex flex-wrap ${small ? 'gap-2' : 'gap-2.5'}`} role="radiogroup" aria-label={label}>
      {PRESET_EVENT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={EVENT_COLORS[c].label}
          title={EVENT_COLORS[c].label}
          onClick={() => onChange(c)}
          className={`flex ${size} items-center justify-center rounded-full transition ${value === c ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
          style={{ background: EVENT_COLORS[c].bg }}
        >
          {value === c && <Check className={small ? 'size-3.5' : 'size-4'} style={{ color: eventFg(c) }} strokeWidth={3} aria-hidden />}
        </button>
      ))}
      {/* 직접 고르기: 색 고르는 창이 열린다 */}
      <label
        title="직접 고르기"
        className={`relative flex ${size} cursor-pointer items-center justify-center rounded-full transition ${custom ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
        style={{ background: custom ? eventBg(value) : 'conic-gradient(#e5484d, #f5c518, #2bab6c, #3cc8b4, #3b95e8, #8c6cf0, #d03fb8, #e5484d)' }}
      >
        {custom ? (
          <Check className={small ? 'size-3.5' : 'size-4'} style={{ color: eventFg(value) }} strokeWidth={3} aria-hidden />
        ) : (
          <Palette className={`${small ? 'size-3.5' : 'size-4'} text-white drop-shadow`} aria-hidden />
        )}
        <input
          type="color"
          aria-label="직접 고르기"
          value={custom ? eventBg(value) : '#ff8fab'}
          onChange={(e) => onChange(e.target.value.toLowerCase() as EventColor)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  )
}

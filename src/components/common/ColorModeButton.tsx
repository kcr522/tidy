import { Moon, Sun, SunMoon, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useColorMode } from '../../hooks/useColorMode'
import { COLOR_MODES, type ColorMode } from '../../lib/colorMode'

const OPTIONS: Record<ColorMode, { label: string; icon: LucideIcon }> = {
  auto: { label: '자동', icon: SunMoon },
  light: { label: '라이트', icon: Sun },
  dark: { label: '다크', icon: Moon },
}

/**
 * 작은 동그란 화면 밝기 버튼.
 * 누르면 자동 / 라이트 / 다크 세 개가 펼쳐지고, 고르면 바로 바뀌고 저장된다.
 */
export default function ColorModeButton({ align = 'right', className = 'bg-white shadow-card' }: { align?: 'left' | 'right'; className?: string }) {
  const [mode, setMode] = useColorMode()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const Current = OPTIONS[mode].icon

  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`tap flex size-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:text-brand-600 ${className}`}
        aria-label={`화면 밝기: ${OPTIONS[mode].label}`}
        aria-haspopup="true"
        aria-expanded={open}
      >
        <Current className="size-[18px]" strokeWidth={2.2} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className={`absolute top-11 z-30 flex gap-1 rounded-full bg-white p-1.5 shadow-[0_8px_28px_rgb(0_0_0/0.16)] ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {COLOR_MODES.map((m) => {
            const { label, icon: Icon } = OPTIONS[m]
            const active = m === mode
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => {
                  setMode(m)
                  setOpen(false)
                }}
                className={`flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors ${
                  active ? 'bg-grad on-grad' : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                <Icon className="size-[18px]" strokeWidth={2.2} aria-hidden />
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

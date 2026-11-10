import { Delete } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PIN_LENGTH } from '../../lib/appLock'

interface PinPadProps {
  title: string
  subtitle?: string
  /** 틀렸을 때 문구 (바뀔 때마다 점이 흔들린다) */
  error?: string
  /** 숫자를 못 누르게 (기다리는 중, 확인 중) */
  disabled?: boolean
  onComplete: (pin: string) => void
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const

/** 숫자 4자리 입력 (잠금 화면, 비밀번호 정하기). 컴퓨터에서는 키보드 숫자도 된다 */
export default function PinPad({ title, subtitle, error, disabled = false, onComplete }: PinPadProps) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(0)

  // 틀렸다는 문구가 오면 지우고 흔든다
  useEffect(() => {
    if (!error) return
    setPin('')
    setShake((n) => n + 1)
  }, [error])

  function press(k: string) {
    if (disabled) return
    if (k === 'del') return setPin((p) => p.slice(0, -1))
    if (!/^\d$/.test(k) || pin.length >= PIN_LENGTH) return
    const next = pin + k
    setPin(next)
    if (next.length === PIN_LENGTH) setTimeout(() => onComplete(next), 120)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('del')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // 다 채운 뒤 다시 처음부터 (확인 단계로 넘어갈 때 등)
  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return
    const t = setTimeout(() => setPin(''), 400)
    return () => clearTimeout(t)
  }, [pin])

  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <p className="text-xl font-extrabold text-slate-900">{title}</p>
      <p className={`mt-1.5 min-h-5 text-sm ${error ? 'font-semibold text-expense' : 'text-slate-500'}`} role={error ? 'alert' : undefined}>
        {error ?? subtitle}
      </p>
      <div key={shake} className={`my-8 flex gap-4 ${shake ? 'animate-pin-shake' : ''}`} aria-label={`${pin.length}자리 입력함`}>
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`size-4 rounded-full transition ${i < pin.length ? 'bg-check scale-110' : 'bg-slate-200'}`} aria-hidden />
        ))}
      </div>
      <div className="grid w-full grid-cols-3 gap-2">
        {KEYS.map((k, i) =>
          k === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => press(k)}
              className="flex h-16 items-center justify-center rounded-2xl text-2xl font-bold text-slate-800 transition active:scale-95 active:bg-slate-200 disabled:opacity-40"
              aria-label={k === 'del' ? '하나 지우기' : k}
            >
              {k === 'del' ? <Delete className="size-6 text-slate-500" aria-hidden /> : k}
            </button>
          ),
        )}
      </div>
    </div>
  )
}

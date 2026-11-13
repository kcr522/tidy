import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PASSWORD_MAX, PASSWORD_MIN } from '../../lib/appLock'
import Button from './Button'
import { inputClass } from './formStyles'

interface PasswordPadProps {
  title: string
  subtitle?: string
  /** 틀렸을 때 문구 (바뀔 때마다 칸이 흔들린다) */
  error?: string
  disabled?: boolean
  /** 새로 정할 때는 new-password (폰 비밀번호 관리자가 저장을 권한다) */
  mode?: 'current' | 'new'
  submitLabel?: string
  onComplete: (password: string) => void
}

/** 8자리 이상 비밀번호 입력 (잠금 화면, 비밀번호 정하기). PinPad 와 같은 자리에 쓴다 */
export default function PasswordPad({ title, subtitle, error, disabled = false, mode = 'current', submitLabel = '확인', onComplete }: PasswordPadProps) {
  const [value, setValue] = useState('')
  const [show, setShow] = useState(false)
  const [shake, setShake] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!error) return
    setValue('')
    setShake((n) => n + 1)
    input.current?.focus()
  }, [error])

  // 화면이 뜨면 바로 쓸 수 있게
  useEffect(() => {
    const t = setTimeout(() => input.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [])

  const short = mode === 'new' && value.length > 0 && value.length < PASSWORD_MIN

  function submit(e: FormEvent) {
    e.preventDefault()
    if (disabled || !value) return
    onComplete(value)
    setValue('')
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-xs flex-col items-center">
      <p className="text-xl font-extrabold text-slate-900">{title}</p>
      <p className={`mt-1.5 min-h-5 text-center text-sm break-keep ${error ? 'font-semibold text-expense' : 'text-slate-500'}`} role={error ? 'alert' : undefined}>
        {error ?? subtitle}
      </p>
      <div key={shake} className={`relative mt-7 w-full ${shake ? 'animate-pin-shake' : ''}`}>
        <input
          ref={input}
          type={show ? 'text' : 'password'}
          value={value}
          maxLength={PASSWORD_MAX}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label="비밀번호"
          placeholder={`${PASSWORD_MIN}자리 이상`}
          className={`${inputClass(!!error)} pr-12 text-lg tracking-wide`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-xl text-slate-500 active:bg-slate-200"
          aria-label={show ? '비밀번호 가리기' : '비밀번호 보기'}
        >
          {show ? <EyeOff className="size-5" aria-hidden /> : <Eye className="size-5" aria-hidden />}
        </button>
      </div>
      <p className="mt-2 min-h-4 self-start px-1 text-xs text-slate-400">
        {mode === 'new' ? (short ? `${PASSWORD_MIN - value.length}자 더 써 주세요` : value.length >= PASSWORD_MIN ? `${value.length}자 · 좋아요` : '') : ''}
      </p>
      <Button type="submit" className="mt-3 w-full" disabled={disabled || !value || short}>
        {submitLabel}
      </Button>
    </form>
  )
}

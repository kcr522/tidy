import { KeyRound } from 'lucide-react'
import { useState } from 'react'
import { loginWithEmail } from '../../lib/sync/account'
import { inputClass } from '../common/formStyles'

/**
 * 이메일 + 비밀번호 로그인 (테스트 계정용).
 * 처음에는 작은 글자 버튼만 보이고, 누르면 칸이 열린다. 새 계정은 여기서 만들지 않는다.
 */
export default function EmailLogin({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-slate-500 underline underline-offset-4">
        <KeyRound className="size-4" aria-hidden />
        이메일(테스트 계정)로 로그인
      </button>
    )
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) return
    setBusy(true)
    setError(undefined)
    try {
      await loginWithEmail(email, password)
      onDone?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-2.5" aria-label="이메일로 로그인">
      <input type="email" inputMode="email" autoComplete="username" placeholder="이메일" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass()} aria-label="이메일" />
      <input type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass()} aria-label="비밀번호" />
      {error && (
        <p className="text-center text-sm break-keep text-expense" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)} className="tap min-h-12 rounded-2xl px-4 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          닫기
        </button>
        <button type="submit" disabled={busy || !email.trim() || !password} className="tap bg-grad on-grad min-h-12 flex-1 rounded-2xl px-5 text-[15px] font-bold shadow-sm active:scale-[0.98] disabled:opacity-60">
          {busy ? '로그인하는 중…' : '로그인'}
        </button>
      </div>
    </form>
  )
}

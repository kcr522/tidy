import { Cloud, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount'
import { login, logout, skipLogin } from '../../lib/sync/account'
import { loginSkipped } from '../../lib/sync/state'
import { isDeskWidget } from '../../platform/deskWidget'
import { GoogleAuthError } from '../../platform/googleAuth'
import logoUrl from '../../assets/logo.svg'

/** 구글 G 로고 (공식 색) */
export function GoogleLogo({ className = 'size-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * 처음 켰을 때 나오는 로그인 화면.
 * 구글로 로그인하면 폰·컴퓨터 어디서나 같은 기록을 보고, 로그인 없이 이 기기에서만 쓸 수도 있다.
 * Firebase 설정이 없으면 나오지 않는다.
 */
export default function LoginScreen() {
  const account = useAccount()
  const location = useLocation()
  const [skipped, setSkipped] = useState(loginSkipped)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()

  const again = account.signedOutUnexpectedly
  const show = account.available && !account.checking && !account.user && (again || !skipped) && !location.pathname.startsWith('/share') && location.pathname !== '/widget-login'
  if (!show) return null

  async function google() {
    setBusy(true)
    setError(undefined)
    try {
      await login()
    } catch (err) {
      if (!(err instanceof GoogleAuthError && err.cancelled)) setError(err instanceof Error ? err.message : '로그인하지 못했어요')
    } finally {
      setBusy(false)
    }
  }

  async function local() {
    // 로그인이 풀린 기기에서 "로그인 없이"를 고르면 클라우드와 끊는다 (이 기기 데이터는 그대로)
    if (again) await logout(true)
    skipLogin()
    setSkipped(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-slate-100 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label="로그인">
      <div className="bg-grad pointer-events-none absolute inset-x-0 top-0 h-[46vh] rounded-b-[48px] opacity-90" aria-hidden />
      <div className="relative mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
        <div className="on-grad mb-8 text-center">
          <img src={logoUrl} alt="" className="mx-auto mb-4 size-[72px] rounded-[20px] shadow-lg shadow-black/15" />
          <p className="text-[44px] leading-none font-black tracking-tight">TIDY:</p>
          <p className="mt-3 text-[15px] font-semibold opacity-90">가계부 · 할 일 · 스크랩을 한곳에</p>
        </div>

        <div className="card space-y-5 p-6 shadow-float">
          <div>
            <h1 className="text-xl font-extrabold">{again ? '다시 로그인해 주세요' : '시작하기'}</h1>
            <p className="mt-1.5 text-sm leading-relaxed break-keep text-slate-500">
              {again ? '로그인이 풀려서 다른 기기와 동기화를 잠시 멈췄어요. 이 기기 기록은 그대로 있어요.' : '구글 계정으로 로그인하면 폰과 컴퓨터에서 같은 기록을 볼 수 있어요.'}
            </p>
          </div>

          <ul className="space-y-2.5 text-sm text-slate-600">
            <li className="flex items-center gap-2.5">
              <Cloud className="size-4.5 shrink-0 text-brand-600" aria-hidden />
              <span className="break-keep">기록이 클라우드에 저장돼서 폰을 바꿔도 그대로</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Smartphone className="size-4.5 shrink-0 text-brand-600" aria-hidden />
              <span className="break-keep">폰에서 쓰면 컴퓨터에도 바로 보여요</span>
            </li>
          </ul>

          <button
            type="button"
            onClick={() => void google()}
            disabled={busy}
            className="tap flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-[15px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleLogo />
            {busy ? (isDeskWidget() ? '브라우저에서 로그인하는 중…' : '로그인하는 중…') : 'Google로 계속하기'}
          </button>
          {isDeskWidget() && <p className="text-center text-xs break-keep text-slate-400">컴퓨터의 기본 브라우저가 열려요. 거기서 로그인하면 위젯으로 돌아와요.</p>}
          {error && (
            <p className="text-center text-sm break-keep text-expense" role="alert">
              {error}
            </p>
          )}
        </div>

        <button type="button" onClick={() => void local()} className="mt-6 text-sm font-semibold text-slate-500 underline underline-offset-4">
          로그인 없이 이 기기에서만 쓰기
        </button>
        <p className="mt-3 text-center text-xs break-keep text-slate-400">나중에 설정 → 계정에서 언제든 로그인할 수 있어요</p>
      </div>
    </div>
  )
}

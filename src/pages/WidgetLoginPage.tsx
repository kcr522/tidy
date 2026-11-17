import { useState } from 'react'
import { GoogleLogo } from '../components/account/LoginScreen'
import { googleIdTokenForWidget } from '../platform/firebase'
import { GoogleAuthError } from '../platform/googleAuth'

/**
 * /widget-login: 컴퓨터 위젯 앱(Tidy 달력)의 로그인을 컴퓨터의 기본 브라우저에서 한다.
 * 구글은 앱 안 화면에서 로그인을 막기 때문에, 여기서 로그인하고 받은 ID 토큰을 tidy-widget:// 링크로 위젯 앱에 넘긴다.
 */
export default function WidgetLoginPage() {
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string>()

  async function go() {
    setState('busy')
    setError(undefined)
    try {
      const token = await googleIdTokenForWidget()
      window.location.href = `tidy-widget://login#${token}`
      setState('done')
    } catch (err) {
      setState('idle')
      if (!(err instanceof GoogleAuthError && err.cancelled)) setError(err instanceof Error ? err.message : '로그인하지 못했어요')
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-6">
      <div className="card w-full max-w-sm space-y-5 p-6 shadow-float">
        <div>
          <h1 className="text-xl font-extrabold">Tidy 달력 위젯 로그인</h1>
          <p className="mt-1.5 text-sm leading-relaxed break-keep text-slate-500">
            {state === 'done' ? '위젯으로 돌아가요. "Tidy 달력 열기"를 물어보면 열기를 눌러 주세요. 이 창은 닫아도 돼요.' : '폰에서 쓰는 구글 계정으로 로그인하면 바탕화면 위젯에 내 일정 · 가계부 · 일기가 보여요.'}
          </p>
        </div>
        {state !== 'done' && (
          <button
            type="button"
            onClick={() => void go()}
            disabled={state === 'busy'}
            className="tap flex min-h-13 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-[15px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleLogo />
            {state === 'busy' ? '로그인하는 중…' : 'Google로 로그인하고 위젯 연결'}
          </button>
        )}
        {error && (
          <p className="text-center text-sm break-keep text-expense" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

import { CloudOff, LogOut, RefreshCw, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useAccount, useSyncInfo } from '../../hooks/useAccount'
import { login, logout } from '../../lib/sync/account'
import { pushNow } from '../../lib/sync/engine'
import { setLoginSkipped } from '../../lib/sync/state'
import { GoogleAuthError } from '../../platform/googleAuth'
import EmailLogin from '../account/EmailLogin'
import { GoogleLogo } from '../account/LoginScreen'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

function ago(ms: number | undefined): string {
  if (!ms) return ''
  const s = Math.round((Date.now() - ms) / 1000)
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  return `${Math.floor(s / 3600)}시간 전`
}

/** 설정 > 계정: 구글 로그인, 동기화 상태, 로그아웃 */
export default function AccountCard() {
  const account = useAccount()
  const sync = useSyncInfo()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [leaving, setLeaving] = useState(false)

  if (!account.available) {
    return (
      <section className="card p-5">
        <div className="mb-1 flex items-center gap-2">
          <UserRound className="size-5 text-brand-600" aria-hidden />
          <h2 className="font-bold">계정</h2>
        </div>
        <p className="text-sm break-keep text-slate-500">구글 로그인은 아직 준비 중이에요. Firebase 설정을 넣으면 여기서 로그인할 수 있어요.</p>
      </section>
    )
  }

  async function signIn() {
    setBusy(true)
    try {
      setLoginSkipped(false)
      await login()
    } catch (err) {
      if (!(err instanceof GoogleAuthError && err.cancelled)) toast(err instanceof Error ? err.message : '로그인하지 못했어요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function syncNow() {
    setBusy(true)
    try {
      await pushNow()
      toast('동기화했어요')
    } catch {
      toast('지금은 동기화하지 못했어요. 인터넷을 확인해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function signOut(keep: boolean) {
    setBusy(true)
    try {
      await logout(keep)
      toast(keep ? '로그아웃했어요. 이 기기 기록은 그대로예요' : '로그아웃하고 이 기기 기록을 지웠어요')
      setLeaving(false)
    } finally {
      setBusy(false)
    }
  }

  const u = account.user
  const status =
    sync.status === 'syncing'
      ? '동기화하는 중…'
      : sync.status === 'offline'
        ? `인터넷이 없어요 · 올릴 기록 ${sync.pending}개는 연결되면 올려요`
        : sync.status === 'error'
          ? `동기화 오류 · ${sync.error ?? ''}`
          : sync.pending > 0
            ? `올릴 기록 ${sync.pending}개`
            : `동기화됨${sync.lastSyncedAt ? ` · ${ago(sync.lastSyncedAt)}` : ''}`

  return (
    <section className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <UserRound className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">계정</h2>
      </div>

      {u ? (
        <>
          <div className="flex items-center gap-3">
            {u.photo ? (
              <img src={u.photo} alt="" className="size-11 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="bg-grad on-grad flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold">{(u.name || u.email).slice(0, 1).toUpperCase()}</span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-800">{u.name || u.email}</p>
              <p className="truncate text-sm text-slate-500">{u.email}</p>
            </div>
          </div>
          <p className={`mt-3 flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm break-keep ${sync.status === 'error' || sync.status === 'offline' ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-600'}`}>
            {sync.status === 'offline' || sync.status === 'error' ? <CloudOff className="size-4 shrink-0" aria-hidden /> : <RefreshCw className={`size-4 shrink-0 ${sync.status === 'syncing' ? 'animate-spin' : ''}`} aria-hidden />}
            {status}
          </p>
          <p className="mt-2 text-xs break-keep text-slate-400">같은 구글 계정으로 로그인한 폰·컴퓨터와 기록이 저절로 맞춰져요. 화면 꾸미기, 잠금 비밀번호, AI 키는 기기마다 따로예요.</p>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => void syncNow()} disabled={busy}>
              <RefreshCw className="size-4" aria-hidden />
              지금 동기화
            </Button>
            <Button variant="ghost" onClick={() => setLeaving(true)} disabled={busy}>
              <LogOut className="size-4" aria-hidden />
              로그아웃
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm break-keep text-slate-500">
            {account.checking ? '로그인 확인 중…' : '구글로 로그인하면 폰과 컴퓨터에서 같은 기록을 보고, 폰을 바꿔도 기록이 그대로예요.'}
          </p>
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={busy || account.checking}
            className="tap flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 text-[15px] font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
          >
            <GoogleLogo />
            Google로 로그인
          </button>
          <div className="mt-4">
            <EmailLogin onDone={() => setLoginSkipped(false)} />
          </div>
        </>
      )}

      <Modal open={leaving} title="로그아웃" onClose={() => setLeaving(false)}>
        <p className="mb-5 text-sm leading-relaxed break-keep text-slate-600">로그아웃하면 이 기기는 더 이상 다른 기기와 맞춰지지 않아요. 클라우드에 저장된 기록은 그대로 남아서 다시 로그인하면 받을 수 있어요.</p>
        <div className="space-y-2">
          <Button className="w-full" onClick={() => void signOut(true)} disabled={busy}>
            로그아웃 (이 기기 기록은 남기기)
          </Button>
          <Button variant="secondary" className="w-full text-expense" onClick={() => void signOut(false)} disabled={busy}>
            로그아웃하고 이 기기 기록 지우기
          </Button>
        </div>
      </Modal>
    </section>
  )
}

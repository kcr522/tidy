import { CalendarArrowUp, Link2Off, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { agoLabel } from '../../lib/autoBackup'
import { GoogleAuthError, WEB_CLIENT_ID } from '../../platform/googleAuth'
import { connectGooglePush, disconnectGooglePush, googlePushErrorText, loadGooglePush, onGooglePushChange, pushNow, setPushTodos } from '../../platform/googleCalendarPush'
import { isNativeApp } from '../../platform/native'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

/**
 * 설정 > 구글 캘린더 > Tidy 일정을 구글 캘린더에 보이기
 * 구글 계정을 연결하면 구글에 "Tidy" 캘린더를 만들고, Tidy 일정과 할 일을 바뀔 때마다 보낸다.
 * 연결 전에는 .ics 파일로 한 번 넣는 방법도 같이 보여 준다.
 */
export default function GooglePushSection({ onExportFile, busy }: { onExportFile: () => void; busy: boolean }) {
  const toast = useToast()
  const [s, setS] = useState(loadGooglePush)
  const [working, setWorking] = useState(false)
  const [leaving, setLeaving] = useState(false)
  useEffect(() => onGooglePushChange(() => setS(loadGooglePush())), [])
  const canConnect = isNativeApp() || WEB_CLIENT_ID !== ''

  async function run(fn: () => Promise<number>, done: (n: number) => string) {
    setWorking(true)
    try {
      toast(done(await fn()))
    } catch (err) {
      if (!(err instanceof GoogleAuthError && err.cancelled)) toast(googlePushErrorText(err), 'error')
    } finally {
      setWorking(false)
    }
  }

  async function leave(removeCalendar: boolean) {
    setLeaving(false)
    setWorking(true)
    await disconnectGooglePush(removeCalendar)
    setWorking(false)
    toast(removeCalendar ? '연결을 끊고 구글의 Tidy 캘린더도 지웠어요' : '연결을 끊었어요. 구글의 Tidy 캘린더는 그대로 있어요')
  }

  return (
    <div className="mt-3 rounded-2xl bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 font-semibold text-slate-800">
        <CalendarArrowUp className="size-4" aria-hidden /> Tidy 일정을 구글 캘린더에 보이기
      </p>
      {s ? (
        <>
          <p className="mt-1 text-sm text-slate-600">
            연결됨{s.email && ` · ${s.email}`}
            <br />
            {s.last ? `일정 ${s.count ?? 0}개 · 마지막 ${agoLabel(s.last, Date.now())}` : '아직 보내지 않았어요'}
          </p>
          <p className="mt-0.5 text-xs break-keep text-slate-400">구글 캘린더의 "Tidy" 캘린더에 들어가요. Tidy에서 넣고 고치고 지우면 몇 초 뒤 구글에도 똑같이 돼요.</p>
          {s.error && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs break-keep text-expense">{s.error}</p>}
          <label className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-700">
            마감일 있는 할 일도 보내기
            <input type="checkbox" checked={s.todos} onChange={(e) => (setPushTodos(e.target.checked), void pushNow(false))} className="size-5 accent-brand-600" />
          </label>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="min-h-10! flex-1 px-3! text-sm!" onClick={() => void run(() => pushNow(true), (n) => `구글에 일정 ${n}개를 맞췄어요`)} disabled={working}>
              <RefreshCw className={`size-4 ${working ? 'animate-spin' : ''}`} aria-hidden /> 지금 보내기
            </Button>
            <Button variant="ghost" className="min-h-10! px-3! text-sm! text-expense" onClick={() => setLeaving(true)} disabled={working}>
              <Link2Off className="size-4" aria-hidden /> 끊기
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-1 text-sm break-keep text-slate-600">구글 계정을 연결하면 Tidy 일정과 할 일이 구글 캘린더에 저절로 들어가요. 고치거나 지워도 따라가요.</p>
          {canConnect ? (
            <Button className="mt-3 min-h-10! w-full text-sm!" onClick={() => void run(() => connectGooglePush(), (n) => `구글 캘린더에 일정 ${n}개를 넣었어요`)} disabled={working || busy}>
              <GoogleMark /> 구글 계정 연결
            </Button>
          ) : (
            <p className="mt-2 text-xs text-slate-400">웹에서는 아직 구글 연결을 쓸 수 없어요. 갤럭시 앱에서 연결해 주세요.</p>
          )}
          <p className="mt-2 text-xs break-keep text-slate-400">Tidy가 만든 "Tidy" 캘린더만 다뤄요. 다른 구글 캘린더 일정은 보지도 고치지도 않아요.</p>
          <button type="button" onClick={onExportFile} disabled={busy} className="mt-3 text-xs font-semibold text-brand-600">
            연결 없이 지금 내용만 파일(.ics)로 넣기
          </button>
        </>
      )}

      <Modal open={leaving} title="구글 연결 끊기" onClose={() => setLeaving(false)}>
        <p className="text-sm break-keep text-slate-600">더는 구글에 보내지 않아요. 구글 캘린더에 있는 "Tidy" 캘린더는 어떻게 할까요?</p>
        <div className="mt-4 flex flex-col gap-2">
          <Button variant="secondary" onClick={() => void leave(false)}>
            남겨 두기
          </Button>
          <Button variant="danger" onClick={() => void leave(true)}>
            구글에서도 지우기
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

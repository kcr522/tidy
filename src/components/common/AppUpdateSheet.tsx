import { Download, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatSize, snooze, type LatestApp } from '../../lib/appUpdate'
import { downloadAndInstall, onInstallPermissionDenied } from '../../platform/appUpdate'
import Button from './Button'
import Modal from './Modal'

type Phase = { kind: 'ready' } | { kind: 'downloading'; percent: number } | { kind: 'installing' } | { kind: 'permission' } | { kind: 'error'; message: string }

/**
 * "새 버전이 나왔어요" 창. "업데이트 하러 가기"를 누르면 새 APK 를 받고 안드로이드 설치 화면을 띄운다.
 * 앱을 켤 때 뜨는 알림(AppUpdatePrompt)과 설정 > 앱 업데이트가 같이 쓴다.
 */
export default function AppUpdateSheet({ latest, current, onClose }: { latest: LatestApp; current: string; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>({ kind: 'ready' })
  useEffect(() => onInstallPermissionDenied(() => setPhase({ kind: 'error', message: '설치를 허용해야 업데이트할 수 있어요. 다시 눌러 주세요' })), [])

  const busy = phase.kind === 'downloading'

  async function start() {
    setPhase({ kind: 'downloading', percent: 0 })
    const r = await downloadAndInstall((percent) => setPhase({ kind: 'downloading', percent }))
    if ('error' in r) setPhase({ kind: 'error', message: r.error })
    else setPhase({ kind: r.status })
  }

  function later() {
    if (busy) return
    snooze(latest.versionCode)
    onClose()
  }

  return (
    <Modal open title="새 버전이 나왔어요" onClose={later}>
      <div className="mb-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-brand-700">
        <Sparkles className="size-6 shrink-0" aria-hidden />
        <div className="text-sm">
          <p className="text-base font-extrabold">Tidy {latest.versionName}</p>
          <p className="text-brand-600">
            지금 쓰는 버전 {current}
            {latest.size > 0 && ` · ${formatSize(latest.size)}`}
          </p>
        </div>
      </div>

      {latest.notes.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 text-sm font-bold text-slate-700">바뀐 점</p>
          <ul className="list-disc space-y-1 pl-5 text-sm break-keep text-slate-600">
            {latest.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="mb-4 text-xs break-keep text-slate-400">기록은 그대로 남아요. 받은 뒤 뜨는 설치 화면에서 "업데이트"를 눌러 주세요.</p>

      {phase.kind === 'downloading' && (
        <div className="mb-4" role="status" aria-live="polite">
          <div className="mb-1 flex justify-between text-xs font-bold text-slate-500">
            <span>내려받는 중</span>
            <span>{phase.percent >= 0 ? `${phase.percent}%` : ''}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-grad h-full rounded-full transition-[width]" style={{ width: `${phase.percent >= 0 ? phase.percent : 50}%` }} />
          </div>
        </div>
      )}
      {phase.kind === 'installing' && <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm break-keep text-slate-600">설치 화면이 열렸어요. "업데이트"를 누르면 새 버전으로 바뀌어요.</p>}
      {phase.kind === 'permission' && <p className="mb-4 rounded-2xl bg-slate-50 p-3 text-sm break-keep text-slate-600">처음 한 번만: 열린 화면에서 "이 출처 허용"을 켜고 돌아오면 바로 설치 화면이 떠요.</p>}
      {phase.kind === 'error' && <p className="mb-4 rounded-2xl bg-red-50 p-3 text-sm break-keep text-expense">{phase.message}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={later} disabled={busy}>
          나중에
        </Button>
        <Button className="flex-[2]" onClick={start} disabled={busy}>
          <Download className="size-5" aria-hidden />
          {busy ? '받는 중…' : phase.kind === 'error' ? '다시 받기' : phase.kind === 'ready' ? '업데이트 하러 가기' : '다시 설치하기'}
        </Button>
      </div>
    </Modal>
  )
}

import { RefreshCw, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isNewer, type LatestApp } from '../../lib/appUpdate'
import { apkDownloadUrl, canUpdateInApp, currentAppVersion, fetchLatestApp } from '../../platform/appUpdate'
import { isNativeApp } from '../../platform/native'
import AppUpdateSheet from '../common/AppUpdateSheet'
import Button from '../common/Button'
import { useToast } from '../common/Toast'

/** 설정 > 앱 업데이트: 지금 버전과 최신 버전을 보여 주고, 새 버전이 있으면 앱 안에서 바로 업데이트한다 */
export default function AppUpdateCard() {
  const toast = useToast()
  const inApp = canUpdateInApp()
  const [current, setCurrent] = useState<{ versionCode: number; versionName: string } | null>(null)
  const [latest, setLatest] = useState<LatestApp | null>(null)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    void currentAppVersion().then(setCurrent)
  }, [])

  async function check(show = true) {
    setChecking(true)
    setError('')
    try {
      const l = await fetchLatestApp()
      setLatest(l)
      const cur = current ?? (await currentAppVersion())
      if (show && isNewer(l, cur?.versionCode ?? null)) setOpen(true)
      else if (show && inApp) toast('지금이 최신 버전이에요')
    } catch (err) {
      setError(err instanceof Error ? err.message : '확인하지 못했어요')
    } finally {
      setChecking(false)
    }
  }

  const hasNew = isNewer(latest, current?.versionCode ?? null)

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Smartphone className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">앱 업데이트</h2>
      </div>
      {inApp ? (
        <>
          <p className="mb-4 text-sm break-keep text-slate-500">새 버전이 나오면 앱을 켤 때 알려 줘요. "업데이트 하러 가기"를 누르면 앱 안에서 바로 받아서 설치해요.</p>
          <dl className="mb-4 grid grid-cols-2 gap-3 text-center">
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">지금 버전</dt>
              <dd className="mt-0.5 font-extrabold">{current?.versionName ?? '…'}</dd>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3">
              <dt className="text-xs text-slate-500">최신 버전</dt>
              <dd className={`mt-0.5 font-extrabold ${hasNew ? 'text-brand-600' : ''}`}>{latest ? latest.versionName : '확인 전'}</dd>
            </div>
          </dl>
          {error && <p className="mb-3 rounded-2xl bg-red-50 p-3 text-sm break-keep text-expense">{error}</p>}
          <Button className="w-full" variant={hasNew ? 'primary' : 'secondary'} onClick={() => (hasNew ? setOpen(true) : void check())} disabled={checking}>
            <RefreshCw className={`size-5 ${checking ? 'animate-spin' : ''}`} aria-hidden />
            {checking ? '확인하는 중…' : hasNew ? '업데이트 하러 가기' : '업데이트 확인'}
          </Button>
        </>
      ) : (
        <>
          <p className="mb-4 text-sm break-keep text-slate-500">
            {isNativeApp() ? '이 버전의 앱은 앱 안 업데이트가 없어요. 아래 버튼으로 새 앱을 한 번만 받아 설치하면, 그다음부터는 앱 안에서 바로 업데이트돼요.' : '웹은 열 때마다 항상 최신이에요. 안드로이드 앱은 아래에서 받을 수 있어요.'}
          </p>
          <a href={apkDownloadUrl()} className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-slate-100 px-5 text-[15px] font-bold text-slate-700 hover:bg-slate-200">
            안드로이드 앱(APK) 받기
          </a>
        </>
      )}
      {open && latest && <AppUpdateSheet latest={latest} current={current?.versionName ?? ''} onClose={() => setOpen(false)} />}
    </section>
  )
}

import { ChevronRight, Route } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTrackSwitch } from '../../hooks/useRouteTracking'
import Switch from '../common/Switch'
import { useToast } from '../common/Toast'

/** 설정 > 오늘 이동 기록 (갤럭시 앱만 켜고 끌 수 있다) */
export default function RouteTrackCard() {
  const track = useTrackSwitch()
  const toast = useToast()

  async function toggle() {
    const msg = await track.toggle()
    if (msg) toast(msg, msg.includes('못') || msg.includes('허용') ? 'error' : undefined)
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <Route className="size-5 text-brand-600" aria-hidden />
        <h2 className="flex-1 font-bold">오늘 이동 기록</h2>
        {track.available && <Switch label="오늘 이동 기록" on={!!track.status?.on} disabled={track.busy || !track.status} onClick={toggle} />}
      </div>
      <p className="text-sm break-keep text-slate-500">
        {track.available
          ? '켜 두면 다닌 길을 지도에 그려요. 알림창에 ‘오늘 이동 기록 중’이 떠 있는 동안만 기록하고, 위치는 이 폰에만 30일 동안 저장돼요.'
          : '하루 동선 기록은 갤럭시 앱에서 켤 수 있어요. 웹 · 컴퓨터에서는 지금 위치만 남길 수 있어요.'}
      </p>
      <Link to="/route" className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600">
        지도로 보기
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}

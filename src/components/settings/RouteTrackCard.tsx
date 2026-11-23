import { ChevronRight, Footprints, Route } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTrackSwitch } from '../../hooks/useRouteTracking'
import { connectHealth, disconnectHealth, healthConnected, healthSupported, openHealthSettings } from '../../platform/health'
import Switch from '../common/Switch'
import { useToast } from '../common/Toast'

/** 설정 > 오늘 이동 기록 (갤럭시 앱만 켜고 끌 수 있다) */
export default function RouteTrackCard() {
  const track = useTrackSwitch()
  const toast = useToast()

  const [health, setHealth] = useState(healthConnected)
  async function toggleHealth() {
    if (health) {
      disconnectHealth()
      setHealth(false)
      toast('워치 걸음 수 연결을 껐어요. 권한은 헬스 커넥트 앱에서 지울 수 있어요')
      void openHealthSettings()
      return
    }
    const r = await connectHealth().catch(() => 'unavailable' as const)
    setHealth(r === 'ok')
    if (r === 'ok') toast('워치 걸음 수를 연결했어요')
    else if (r === 'denied') toast('걸음 수 읽기를 허락해야 볼 수 있어요', 'error')
    else toast('헬스 커넥트를 쓸 수 없어요. Play 스토어에서 헬스 커넥트를 설치해 주세요', 'error')
  }

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
      {healthSupported() && (
        <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4">
          <Footprints className="size-5 shrink-0 text-emerald-500" aria-hidden />
          <span className="flex-1 text-sm">
            <span className="block font-semibold text-slate-800">워치 걸음 수 · 걸은 거리</span>
            <span className="block text-xs break-keep text-slate-500">삼성 헬스 → 헬스 커넥트에서 읽기만 해요. 삼성 헬스 설정에서 헬스 커넥트 연결도 켜 주세요</span>
          </span>
          <Switch label="워치 걸음 수" on={health} onClick={toggleHealth} />
        </div>
      )}
      <Link to="/route" className="mt-3 flex items-center gap-1 text-sm font-semibold text-brand-600">
        지도로 보기
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  )
}

import { useEffect, useState } from 'react'
import { isNewer, isSnoozed, type LatestApp } from '../../lib/appUpdate'
import { canUpdateInApp, currentAppVersion, fetchLatestApp } from '../../platform/appUpdate'
import AppUpdateSheet from '../common/AppUpdateSheet'

/** 안드로이드 앱을 켜고 조금 뒤에 새 버전이 있는지 한 번 묻고, 있으면 "새 버전이 나왔어요" 창을 띄운다 */
export default function AppUpdatePrompt() {
  const [found, setFound] = useState<{ latest: LatestApp; current: string } | null>(null)

  useEffect(() => {
    if (!canUpdateInApp()) return
    let alive = true
    // 첫 화면이 다 뜬 뒤에 묻는다 (켜는 속도에 영향 없게)
    const t = setTimeout(async () => {
      try {
        const [cur, latest] = await Promise.all([currentAppVersion(), fetchLatestApp()])
        if (alive && cur && isNewer(latest, cur.versionCode) && !isSnoozed(latest.versionCode)) setFound({ latest, current: cur.versionName })
      } catch {
        // 인터넷이 없거나 서버가 답이 없으면 조용히 넘어간다 (설정 > 앱 업데이트에서 다시 확인할 수 있다)
      }
    }, 4000)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [])

  if (!found) return null
  return <AppUpdateSheet latest={found.latest} current={found.current} onClose={() => setFound(null)} />
}

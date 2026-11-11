import { useEffect, useState } from 'react'
import { isDue, loadAutoBackup, onAutoBackupChange, saveAutoBackup, type AutoBackupSettings, type BackupEvery } from '../lib/autoBackup'
import { nowIso, todayKey } from '../lib/date'
import { writeAutoBackup } from '../platform/autoBackup'
import { isNativeApp } from '../platform/native'
import { backupRepo } from '../repositories/backupRepo'

/** 폰 앱은 매일 저절로, 웹은 매주 "백업할 때예요" 알림이 기본 */
export const defaultEvery = (): BackupEvery => (isNativeApp() ? 'day' : 'week')

export function useAutoBackupSettings(): AutoBackupSettings {
  const [s, setS] = useState(() => loadAutoBackup(defaultEvery()))
  useEffect(() => onAutoBackupChange(() => setS(loadAutoBackup(defaultEvery()))), [])
  return s
}

/** 지금 백업: 폰 앱은 파일로 저장, 마지막 백업 시각을 남긴다 */
export async function backupNow(): Promise<{ publicCopy: boolean }> {
  const text = JSON.stringify(await backupRepo.exportAll())
  const r = await writeAutoBackup(todayKey(), text)
  markBackedUp()
  return r
}

/**
 * 앱을 열거나 날짜가 바뀌면: 폰 앱은 때가 됐을 때 조용히 백업한다.
 * 웹은 파일을 몰래 저장할 수 없어서, 때가 됐는지만 알려 준다 (대시보드에 "지금 백업" 띄우기).
 */
export function useAutoBackup(today: string) {
  const s = useAutoBackupSettings()
  const due = isDue(s, Date.now())
  const native = isNativeApp()
  useEffect(() => {
    if (!native || !due) return
    // 앱이 다 뜬 뒤에 (시작 화면, 잠금 화면을 방해하지 않게)
    const timer = window.setTimeout(() => void backupNow().catch(() => undefined), 3000)
    return () => window.clearTimeout(timer)
  }, [native, due, today])
}

/** 웹: 백업할 때가 됐나 (대시보드에 알림 띄우기). 폰 앱은 저절로 하니 늘 false */
export function useBackupReminder(): boolean {
  const s = useAutoBackupSettings()
  return !isNativeApp() && isDue(s, Date.now())
}

/** 웹에서 직접 내려받았을 때도 마지막 백업으로 친다 */
export function markBackedUp() {
  saveAutoBackup({ ...loadAutoBackup(defaultEvery()), last: nowIso() })
}

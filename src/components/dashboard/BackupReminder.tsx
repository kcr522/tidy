import { DatabaseBackup, X } from 'lucide-react'
import { useState } from 'react'
import { markBackedUp, useBackupReminder, useAutoBackupSettings } from '../../hooks/useAutoBackup'
import { agoLabel } from '../../lib/autoBackup'
import { todayKey } from '../../lib/date'
import { errorHint, jsonPieces } from '../../lib/jsonChunks'
import { saveTextFile } from '../../platform/saveFile'
import { backupFileName, backupRepo } from '../../repositories/backupRepo'
import { useToast } from '../common/Toast'

/** 웹: 백업할 때가 되면 대시보드 맨 위에 "지금 백업" (기록이 있을 때만). 닫으면 이번에는 안 보인다 */
export default function BackupReminder({ hasData }: { hasData: boolean }) {
  const toast = useToast()
  const due = useBackupReminder()
  const { last } = useAutoBackupSettings()
  const [hidden, setHidden] = useState(false)
  if (!due || !hasData || hidden) return null

  async function backup() {
    try {
      await saveTextFile(backupFileName(todayKey()), jsonPieces(await backupRepo.exportAll()))
      markBackedUp()
      toast('백업 파일을 저장했어요')
    } catch (err) {
      toast(`백업하지 못했어요. 다시 시도해 주세요${errorHint(err)}`, 'error')
    }
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-3xl bg-brand-50 p-4 text-brand-700">
      <DatabaseBackup className="size-5 shrink-0" aria-hidden />
      <p className="min-w-40 flex-1 text-sm break-keep">
        <b>백업할 때예요.</b> 마지막 백업: {agoLabel(last, Date.now())}
      </p>
      <button type="button" onClick={backup} className="tap shrink-0 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-brand-700 shadow-card">
        지금 백업
      </button>
      <button type="button" onClick={() => setHidden(true)} className="tap shrink-0 rounded-full p-1.5" aria-label="백업 알림 닫기">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  )
}

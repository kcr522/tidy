import { DatabaseBackup, RotateCcw, Share2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { backupNow, markBackedUp, useAutoBackupSettings } from '../../hooks/useAutoBackup'
import { agoLabel, KEEP, saveAutoBackup, type BackupEvery } from '../../lib/autoBackup'
import { todayKey } from '../../lib/date'
import { errorHint, jsonPieces } from '../../lib/jsonChunks'
import { formatDateLabel } from '../../lib/format'
import { listAutoBackups, readAutoBackup, shareAutoBackup, type SavedBackup } from '../../platform/autoBackup'
import { isNativeApp } from '../../platform/native'
import { saveTextFile } from '../../platform/saveFile'
import { backupFileName, backupRepo, InvalidBackupError } from '../../repositories/backupRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

const EVERY_LABEL: Record<BackupEvery, string> = { off: '끄기', open: '열 때마다', day: '매일', week: '매주' }

/** 설정 > 자동 백업: 폰 앱은 정해진 때에 파일로 저장(최근 7개), 웹은 때가 되면 알려 준다 */
export default function AutoBackupCard() {
  const toast = useToast()
  const native = isNativeApp()
  const settings = useAutoBackupSettings()
  const [files, setFiles] = useState<SavedBackup[]>([])
  const [busy, setBusy] = useState(false)
  const [restoring, setRestoring] = useState<SavedBackup | null>(null)

  const refresh = useCallback(() => void listAutoBackups().then(setFiles), [])
  useEffect(refresh, [refresh, settings.last])

  async function now() {
    setBusy(true)
    try {
      if (native) {
        const r = await backupNow()
        toast(r.publicCopy ? '백업했어요. 폰의 문서/Tidy 폴더에도 넣었어요' : '백업했어요')
        refresh()
      } else {
        await saveTextFile(backupFileName(todayKey()), jsonPieces(await backupRepo.exportAll()))
        markBackedUp()
        toast('백업 파일을 저장했어요')
      }
    } catch (err) {
      toast(`백업하지 못했어요. 다시 시도해 주세요${errorHint(err)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function restore() {
    if (!restoring) return
    setBusy(true)
    try {
      const r = await backupRepo.importAll(await readAutoBackup(restoring.name))
      toast(`되돌렸어요 · 가계부 ${r.transactions} · 할 일 ${r.todos} · 스크랩 ${r.bookmarks}`)
      setRestoring(null)
    } catch (err) {
      toast(err instanceof InvalidBackupError ? err.message : '되돌리지 못했어요', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <DatabaseBackup className="size-5 text-brand-600" aria-hidden />
        <h2 className="font-bold">자동 백업</h2>
      </div>
      <p className="mb-3 text-sm break-keep text-slate-500">
        {native
          ? `정한 때가 되면 앱을 열 때 저절로 백업해요. "열 때마다"는 앱을 열 때마다 (30분에 한 번까지) 해요. 최근 ${KEEP}개를 남겨 두고, 되는 폰이면 문서/Tidy 폴더에도 넣어요 (앱을 지워도 남아요).`
          : '웹에서는 파일을 저절로 저장할 수 없어서, 때가 되면 대시보드에서 백업하라고 알려 드려요.'}
      </p>

      <div className={`grid ${native ? 'grid-cols-4' : 'grid-cols-3'} gap-1 rounded-2xl bg-slate-100 p-1`} role="radiogroup" aria-label="자동 백업 주기">
        {(native ? (['off', 'open', 'day', 'week'] as const) : (['off', 'day', 'week'] as const)).map((e) => (
          <button
            key={e}
            type="button"
            role="radio"
            aria-checked={settings.every === e}
            onClick={() => saveAutoBackup({ ...settings, every: e })}
            className={`min-h-11 rounded-xl text-sm font-semibold transition-colors ${settings.every === e ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
          >
            {EVERY_LABEL[e]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          마지막 백업 <b className="text-slate-900">{agoLabel(settings.last, Date.now())}</b>
        </p>
        <Button variant="secondary" className="min-h-10! px-4! text-sm!" onClick={now} disabled={busy}>
          지금 백업
        </Button>
      </div>

      {native && files.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 rounded-2xl border border-slate-100">
          {files.map((f) => (
            <li key={f.name} className="flex items-center gap-2 px-3 py-2">
              <span className="min-w-0 flex-1 text-sm">
                <b className="text-slate-800">{labelOf(f.name)}</b>
                <span className="ml-1.5 text-xs text-slate-400">{Math.max(1, Math.round(f.size / 1024)).toLocaleString('ko-KR')}KB</span>
              </span>
              <button type="button" onClick={() => void shareAutoBackup(f.name).catch(() => toast('보내지 못했어요', 'error'))} className="tap rounded-full p-2 text-slate-500" aria-label={`${labelOf(f.name)} 백업 보내기`}>
                <Share2 className="size-4" aria-hidden />
              </button>
              <button type="button" onClick={() => setRestoring(f)} className="tap flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-brand-600" aria-label={`${labelOf(f.name)} 백업으로 되돌리기`}>
                <RotateCcw className="size-3.5" aria-hidden /> 되돌리기
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={restoring !== null} title="이 백업으로 되돌리기" onClose={() => setRestoring(null)}>
        <p className="mb-6 text-sm break-keep text-slate-700">
          {restoring && labelOf(restoring.name)} 백업으로 되돌려요. 지금 있는 데이터는 모두 이 백업 내용으로 바뀌어요.
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setRestoring(null)}>
            취소
          </Button>
          <Button className="flex-1" onClick={restore} disabled={busy}>
            되돌리기
          </Button>
        </div>
      </Modal>
    </section>
  )
}

/** tidy-auto-2026-11-11.json → "11월 11일 (수)" */
function labelOf(name: string): string {
  const m = /(\d{4}-\d{2}-\d{2})/.exec(name)
  return m ? formatDateLabel(m[1]) : name
}

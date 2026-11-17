import { useLiveQuery } from 'dexie-react-hooks'
import { Download, ShieldCheck, Trash2, Upload, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import Button from '../components/common/Button'
import AccountCard from '../components/settings/AccountCard'
import AppLockCard from '../components/settings/AppLockCard'
import AppUpdateCard from '../components/settings/AppUpdateCard'
import AutoBackupCard from '../components/settings/AutoBackupCard'
import DeviceCalendarCard from '../components/settings/DeviceCalendarCard'
import GoogleCalendarCard from '../components/settings/GoogleCalendarCard'
import { markBackedUp } from '../hooks/useAutoBackup'
import CustomizeCard from '../components/settings/CustomizeCard'
import WidgetCard from '../components/settings/WidgetCard'
import PayNotifyCard from '../components/settings/PayNotifyCard'
import { inputClass } from '../components/common/formStyles'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import AiSettingsSection from '../components/settings/AiSettingsSection'
import ScrapSettingsSection from '../components/settings/ScrapSettingsSection'
import { db } from '../db/database'
import { useAccount } from '../hooks/useAccount'
import { todayKey } from '../lib/date'
import { jsonPieces } from '../lib/jsonChunks'
import { pickTextFile, saveTextFile } from '../platform/saveFile'
import { InvalidBackupError, backupFileName, backupRepo } from '../repositories/backupRepo'
import { merchantAliasRepo } from '../repositories/merchantAliasRepo'

const DELETE_WORD = '삭제'

/** 설정: 데이터 백업, 가져오기, 전체 삭제, 앱 정보 (spec US7, FR-060~063) */
export default function SettingsPage() {
  const toast = useToast()
  const account = useAccount()
  const [importing, setImporting] = useState<{ name: string; text: string } | null>(null)
  const [clearing, setClearing] = useState(false)
  const [word, setWord] = useState('')
  const [busy, setBusy] = useState(false)

  const counts = useLiveQuery(async () => ({
    transactions: await db.transactions.count(),
    todos: await db.todos.count(),
    bookmarks: await db.bookmarks.count(),
  }))
  const aliases = useLiveQuery(() => merchantAliasRepo.list(), [])

  async function exportData() {
    setBusy(true)
    try {
      const backup = await backupRepo.exportAll()
      await saveTextFile(backupFileName(todayKey()), jsonPieces(backup))
      markBackedUp()
      toast('백업 파일을 저장했어요')
    } catch {
      toast('내보내지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function chooseFile() {
    const file = await pickTextFile()
    if (file) setImporting(file)
  }

  async function confirmImport() {
    if (!importing) return
    setBusy(true)
    try {
      const r = await backupRepo.importAll(importing.text)
      toast(`가져왔어요 · 가계부 ${r.transactions} · 할 일 ${r.todos} · 스크랩 ${r.bookmarks}`)
      setImporting(null)
    } catch (err) {
      // 형식이 틀리면 아무것도 바뀌지 않는다 (US7 시나리오 3)
      toast(err instanceof InvalidBackupError ? err.message : '가져오지 못했어요. 다시 시도해 주세요', 'error')
      setImporting(null)
    } finally {
      setBusy(false)
    }
  }

  async function confirmClear() {
    if (word.trim() !== DELETE_WORD) return
    setBusy(true)
    try {
      await backupRepo.clearAll()
      toast('모든 데이터를 지웠어요')
      setClearing(false)
      setWord('')
    } catch {
      toast('지우지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="설정" />
      <div className="space-y-4">
        <section className="flex items-start gap-3 rounded-3xl bg-brand-50 p-5 text-sm text-brand-700">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
          <p className="break-keep">
            {account.user ? '구글 계정에 로그인돼 있어서 기록이 클라우드에도 저장되고, 같은 계정의 다른 기기와 맞춰져요.' : '데이터는 이 기기에만 저장돼요. 기기를 바꾸기 전에 꼭 백업하거나 구글로 로그인하세요.'}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">저장된 데이터</h2>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="가계부" value={counts?.transactions} />
            <Stat label="할 일" value={counts?.todos} />
            <Stat label="스크랩" value={counts?.bookmarks} />
          </dl>
        </section>

        <AccountCard />

        <AppLockCard />

        <WidgetCard />

        <PayNotifyCard />

        <CustomizeCard />

        <GoogleCalendarCard />

        <DeviceCalendarCard />

        <AutoBackupCard />

        <AppUpdateCard />

        <section className="card divide-y divide-slate-100 overflow-hidden">
          <h2 className="px-5 pt-5 pb-3 font-bold">백업</h2>
          <Row
            icon={<Download className="size-5" aria-hidden />}
            title="데이터 내보내기"
            desc="모든 기록을 파일 하나로 저장해요. 다른 기기에서 가져오면 그대로 이어서 쓸 수 있어요."
            action={
              <Button onClick={exportData} disabled={busy}>
                내보내기
              </Button>
            }
          />
          <Row
            icon={<Upload className="size-5" aria-hidden />}
            title="데이터 가져오기"
            desc="백업 파일을 골라서 지금 데이터를 덮어써요."
            action={
              <Button variant="secondary" onClick={chooseFile} disabled={busy}>
                가져오기
              </Button>
            }
          />
          <Row
            icon={<Trash2 className="size-5 text-expense" aria-hidden />}
            title="전체 데이터 삭제"
            desc="가계부, 할 일, 스크랩을 모두 지워요. 되돌릴 수 없어요."
            action={
              <Button variant="secondary" className="text-expense" onClick={() => setClearing(true)} disabled={busy}>
                삭제
              </Button>
            }
          />
        </section>

        <AiSettingsSection />

        <ScrapSettingsSection />

        {aliases && aliases.length > 0 && (
          <section className="card overflow-hidden">
            <h2 className="px-5 pt-5 pb-1 font-bold">알려 준 가게 이름</h2>
            <p className="px-5 pb-3 text-sm text-slate-500">카드사에 왼쪽 이름으로 찍히면 오른쪽 가게로 보여 줘요.</p>
            <ul className="divide-y divide-slate-100">
              {aliases.map((a) => (
                <li key={a.raw} className="flex items-center gap-2 px-5 py-2.5 text-[15px]">
                  <span className="min-w-0 flex-1 truncate text-slate-400">{a.original}</span>
                  <span className="text-slate-300" aria-hidden>
                    →
                  </span>
                  <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">{a.name}</span>
                  <button
                    type="button"
                    onClick={() => merchantAliasRepo.remove(a.raw).then(() => toast('지웠어요. 이미 바꾼 내역은 그대로예요'))}
                    className="tap rounded-full p-2 text-slate-400 hover:bg-slate-100"
                    aria-label={`${a.original} → ${a.name} 지우기`}
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-center text-xs text-slate-400">Tidy v{__APP_VERSION__}</p>
      </div>

      <Modal open={importing !== null} title="데이터 가져오기" onClose={() => setImporting(null)}>
        <p className="mb-2 text-sm break-all text-slate-500">{importing?.name}</p>
        <p className="mb-6 text-sm break-keep text-slate-700">
          지금 있는 데이터가 모두 지워지고 이 백업 내용으로 바뀌어요.{account.user ? ' 같은 계정의 다른 기기도 이 내용으로 바뀌어요.' : ''} 덮어쓸까요?
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImporting(null)}>
            취소
          </Button>
          <Button className="flex-1" onClick={confirmImport} disabled={busy}>
            덮어쓰기
          </Button>
        </div>
      </Modal>

      <Modal
        open={clearing}
        title="전체 데이터 삭제"
        onClose={() => {
          setClearing(false)
          setWord('')
        }}
      >
        <p className="mb-4 text-sm break-keep text-slate-700">
          {account.user && <>로그인돼 있어서 <b>클라우드와 다른 기기에서도</b> 지워져요. </>}정말 지우려면 아래 칸에 <b className="text-expense">{DELETE_WORD}</b>라고 입력해 주세요. 지운 데이터는 되돌릴 수 없어요.
        </p>
        <label className="mb-6 block">
          <span className="sr-only">확인 문구</span>
          <input id="delete-word" value={word} onChange={(e) => setWord(e.target.value)} placeholder={DELETE_WORD} className={inputClass()} autoFocus />
        </label>
        <Button variant="danger" className="w-full" onClick={confirmClear} disabled={busy || word.trim() !== DELETE_WORD}>
          모두 지우기
        </Button>
      </Modal>
    </>
  )
}

function Row({ icon, title, desc, action }: { icon: ReactNode; title: string; desc: string; action: ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-grad-soft text-brand-600">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-800">{title}</p>
        <p className="text-sm break-keep text-slate-500">{desc}</p>
      </div>
      <div className="shrink-0 [&>button]:min-h-10 [&>button]:px-4 [&>button]:text-sm">{action}</div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-slate-50 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xl font-bold">{value ?? '-'}</dd>
    </div>
  )
}

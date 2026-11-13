import { CloudDownload, CloudUpload } from 'lucide-react'
import { useState } from 'react'
import { useAccount } from '../../hooks/useAccount'
import { chooseFirstSync, logout } from '../../lib/sync/account'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { useToast } from '../common/Toast'

/**
 * 로그인했는데 이 기기에도, 클라우드(같은 계정의 다른 기기)에도 기록이 있을 때: 어느 쪽을 쓸지 고른다.
 * 기록 번호가 겹칠 수 있어서 둘을 섞지 않고 한쪽으로 맞춘다.
 */
export default function SyncChoiceDialog() {
  const account = useAccount()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [pick, setPick] = useState<'download' | 'upload'>('download')

  async function go() {
    setBusy(true)
    try {
      await chooseFirstSync(pick)
      toast(pick === 'download' ? '클라우드 기록으로 바꿨어요' : '이 기기 기록을 클라우드에 올렸어요')
    } catch {
      toast('동기화를 시작하지 못했어요. 인터넷을 확인해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    await logout(true)
    toast('로그아웃했어요. 이 기기 기록은 그대로예요')
  }

  const option = (value: 'download' | 'upload', icon: React.ReactNode, title: string, desc: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={pick === value}
      onClick={() => setPick(value)}
      className={`tap flex w-full items-start gap-3 rounded-2xl border-2 p-4 text-left transition ${pick === value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}
    >
      <span className="bg-grad-soft flex size-10 shrink-0 items-center justify-center rounded-2xl text-brand-600">{icon}</span>
      <span className="min-w-0">
        <span className="block font-bold text-slate-800">{title}</span>
        <span className="mt-0.5 block text-sm break-keep text-slate-500">{desc}</span>
      </span>
    </button>
  )

  return (
    <Modal open={account.needsChoice} title="어느 기록을 쓸까요?" onClose={() => void cancel()}>
      <p className="mb-4 text-sm leading-relaxed break-keep text-slate-600">
        <b>{account.user?.email}</b> 계정에 이미 다른 기기에서 쓴 기록이 있어요. 이 기기에도 기록이 있어서 한쪽으로 맞춰야 해요.
      </p>
      <div className="mb-5 space-y-2" role="radiogroup" aria-label="쓸 기록">
        {option('download', <CloudDownload className="size-5" aria-hidden />, '클라우드 기록 쓰기 (추천)', '이 기기 기록을 지우고 계정에 저장된 기록으로 바꿔요.')}
        {option('upload', <CloudUpload className="size-5" aria-hidden />, '이 기기 기록 쓰기', '계정에 저장된 기록을 지우고 이 기기 기록으로 덮어써요. 다른 기기도 이 기록으로 바뀌어요.')}
      </div>
      <p className="mb-4 text-xs break-keep text-slate-400">걱정되면 먼저 설정 → 백업에서 이 기기 기록을 파일로 내보내 두세요.</p>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => void cancel()} disabled={busy}>
          취소
        </Button>
        <Button className="flex-1" onClick={() => void go()} disabled={busy}>
          {busy ? '맞추는 중…' : '이걸로 시작하기'}
        </Button>
      </div>
    </Modal>
  )
}

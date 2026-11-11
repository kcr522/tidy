import { Lock, LockOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LOCK_AFTER, loadLock, onLockChange, removeLock, setLockAfter, setPin, verifyPin, type LockAfter } from '../../lib/appLock'
import Button from '../common/Button'
import Modal from '../common/Modal'
import PinPad from '../common/PinPad'
import { useToast } from '../common/Toast'

type Flow = 'set' | 'change' | 'off'
type Step = 'current' | 'new' | 'confirm'

const AFTER_LABEL: Record<LockAfter, string> = { 0: '바로', 60: '1분 뒤', 300: '5분 뒤' }
const FLOW_TITLE: Record<Flow, string> = { set: '앱 잠금 켜기', change: '비밀번호 바꾸기', off: '앱 잠금 끄기' }

/** 설정 > 앱 잠금: 비밀번호 4자리 정하기, 바꾸기, 끄기, 돌아왔을 때 잠그는 시간 */
export default function AppLockCard() {
  const toast = useToast()
  const [lock, setLock] = useState(loadLock)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [step, setStep] = useState<Step>('new')
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  useEffect(() => onLockChange(() => setLock(loadLock())), [])

  function start(f: Flow) {
    setFlow(f)
    setStep(f === 'set' ? 'new' : 'current')
    setFirst('')
    setError(undefined)
  }

  async function onPin(pin: string) {
    setBusy(true)
    try {
      if (step === 'current') {
        if (!(await verifyPin(pin))) return setError('지금 비밀번호가 달라요')
        setError(undefined)
        if (flow === 'off') {
          removeLock()
          setFlow(null)
          toast('앱 잠금을 껐어요')
        } else setStep('new')
      } else if (step === 'new') {
        setFirst(pin)
        setError(undefined)
        setStep('confirm')
      } else {
        if (pin !== first) {
          setStep('new')
          setFirst('')
          return setError('두 번 누른 비밀번호가 달라요. 처음부터 다시 정해 주세요')
        }
        await setPin(pin)
        setFlow(null)
        toast(flow === 'set' ? '앱 잠금을 켰어요' : '비밀번호를 바꿨어요')
      }
    } catch {
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  const stepTitle = step === 'current' ? '지금 비밀번호' : step === 'new' ? (flow === 'change' ? '새 비밀번호' : '비밀번호 정하기') : '한 번 더 눌러 주세요'
  const stepSub = step === 'current' ? '확인을 위해 눌러 주세요' : step === 'new' ? '숫자 4자리를 정해 주세요' : '확인을 위해 같은 숫자를 다시 눌러 주세요'

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="bg-grad-soft flex size-10 shrink-0 items-center justify-center rounded-full text-brand-600">
          {lock ? <Lock className="size-5" aria-hidden /> : <LockOpen className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">앱 잠금 {lock && <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">켜짐</span>}</h2>
          <p className="mt-0.5 text-sm break-keep text-slate-500">
            {lock ? '앱을 켤 때와 다른 앱에 갔다 돌아올 때 비밀번호를 물어요.' : '비밀번호 4자리로 가계부, 일기를 다른 사람이 못 보게 잠가요.'}
          </p>
        </div>
        {!lock && (
          <Button className="shrink-0" onClick={() => start('set')}>
            켜기
          </Button>
        )}
      </div>

      {lock && (
        <>
          <p className="mt-5 mb-2 text-sm font-bold text-slate-700">다른 앱에 갔다 돌아오면</p>
          <div className="flex gap-1 rounded-2xl bg-slate-100 p-1" role="radiogroup" aria-label="잠그는 시간">
            {LOCK_AFTER.map((a) => (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={lock.after === a}
                onClick={() => setLockAfter(a)}
                className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${lock.after === a ? 'bg-white text-slate-900 shadow-card' : 'text-slate-500'}`}
              >
                {AFTER_LABEL[a]} 잠그기
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => start('change')}>
              비밀번호 바꾸기
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => start('off')}>
              잠금 끄기
            </Button>
          </div>
          <p className="mt-3 text-xs break-keep text-slate-400">비밀번호를 잊으면 찾을 수 없어서, 데이터를 지우고 초기화해야 해요. 백업을 해 두세요.</p>
        </>
      )}

      <Modal open={flow !== null} title={flow ? FLOW_TITLE[flow] : ''} onClose={() => setFlow(null)}>
        {flow && (
          <div className="flex justify-center pt-2 pb-2">
            <PinPad key={`${flow}-${step}`} title={stepTitle} subtitle={stepSub} error={error} disabled={busy} onComplete={(p) => void onPin(p)} />
          </div>
        )}
      </Modal>
    </section>
  )
}

import { Fingerprint, Grid3x3, KeyRound, Lock, LockOpen, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LOCK_AFTER, PASSWORD_MIN, loadLock, onLockChange, removeLock, setBiometric, setLockAfter, setSecret, verifySecret, type LockAfter, type LockKind } from '../../lib/appLock'
import { BIOMETRIC_REASON_TEXT, authenticateBiometric, biometricAvailable, type BiometricReason } from '../../platform/biometric'
import Button from '../common/Button'
import Modal from '../common/Modal'
import SecretPad from '../common/SecretPad'
import { useToast } from '../common/Toast'

type Flow = 'set' | 'change' | 'off'
type Step = 'current' | 'kind' | 'new' | 'confirm'

const AFTER_LABEL: Record<LockAfter, string> = { 0: '바로', 60: '1분 뒤', 300: '5분 뒤' }
const FLOW_TITLE: Record<Flow, string> = { set: '앱 잠금 켜기', change: '비밀번호 바꾸기', off: '앱 잠금 끄기' }
const KIND_LABEL: Record<LockKind, string> = { pin: '숫자 4자리', password: `${PASSWORD_MIN}자리 이상 비밀번호` }
const KINDS: { kind: LockKind; icon: LucideIcon; title: string; desc: string }[] = [
  { kind: 'pin', icon: Grid3x3, title: '숫자 4자리 (PIN)', desc: '숫자 패드로 빠르게 풀어요' },
  { kind: 'password', icon: KeyRound, title: `${PASSWORD_MIN}자리 이상 비밀번호`, desc: '영문, 숫자, 기호를 섞어 더 안전하게' },
]

/** 설정 > 앱 잠금: 잠금 방식(숫자 4자리 / 8자리 이상 비밀번호) 정하기, 바꾸기, 끄기, 지문, 돌아왔을 때 잠그는 시간 */
export default function AppLockCard() {
  const toast = useToast()
  const [lock, setLock] = useState(loadLock)
  const [flow, setFlow] = useState<Flow | null>(null)
  const [step, setStep] = useState<Step>('new')
  const [kind, setKind] = useState<LockKind>('pin')
  const [first, setFirst] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [bio, setBio] = useState<{ available: boolean; reason: BiometricReason } | null>(null)

  useEffect(() => onLockChange(() => setLock(loadLock())), [])
  useEffect(() => {
    void biometricAvailable().then(setBio)
  }, [])

  function start(f: Flow) {
    setFlow(f)
    setStep(f === 'set' ? 'kind' : 'current')
    setKind(f === 'set' ? 'pin' : (lock?.kind ?? 'pin'))
    setFirst('')
    setError(undefined)
  }

  function pickKind(k: LockKind) {
    setKind(k)
    setStep('new')
    setError(undefined)
  }

  async function onSecret(value: string) {
    setBusy(true)
    try {
      if (step === 'current') {
        if (!(await verifySecret(value))) return setError('지금 비밀번호가 달라요')
        setError(undefined)
        if (flow === 'off') {
          removeLock()
          setFlow(null)
          toast('앱 잠금을 껐어요')
        } else setStep('kind')
      } else if (step === 'new') {
        setFirst(value)
        setError(undefined)
        setStep('confirm')
      } else {
        if (value !== first) {
          setStep('new')
          setFirst('')
          return setError('두 번 입력한 비밀번호가 달라요. 처음부터 다시 정해 주세요')
        }
        await setSecret(kind, value)
        setFlow(null)
        toast(flow === 'set' ? '앱 잠금을 켰어요' : '비밀번호를 바꿨어요')
      }
    } catch (err) {
      toast(err instanceof Error && err.message ? err.message : '저장하지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function toggleBio(on: boolean) {
    if (!on) {
      setBiometric(false)
      return toast('지문 잠금 풀기를 껐어요')
    }
    const r = await authenticateBiometric('지문을 대면 켜져요')
    if (!r.ok) return r.error && toast(r.error, 'error')
    setBiometric(true)
    toast('이제 지문으로도 풀 수 있어요')
  }

  // 지금 단계에서 입력받는 것: 확인할 때는 지금 방식, 새로 정할 때는 고른 방식
  const padKind: LockKind = step === 'current' ? (lock?.kind ?? 'pin') : kind
  const isPw = padKind === 'password'
  const stepTitle = step === 'current' ? '지금 비밀번호' : step === 'new' ? (flow === 'change' ? '새 비밀번호' : '비밀번호 정하기') : '한 번 더 입력해 주세요'
  const stepSub =
    step === 'current'
      ? '확인을 위해 입력해 주세요'
      : step === 'new'
        ? isPw
          ? `${PASSWORD_MIN}자리 이상으로 정해 주세요`
          : '숫자 4자리를 정해 주세요'
        : '확인을 위해 같은 비밀번호를 다시 입력해 주세요'

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="bg-grad-soft flex size-10 shrink-0 items-center justify-center rounded-full text-brand-600">
          {lock ? <Lock className="size-5" aria-hidden /> : <LockOpen className="size-5" aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">앱 잠금 {lock && <span className="ml-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">켜짐</span>}</h2>
          <p className="mt-0.5 text-sm break-keep text-slate-500">
            {lock
              ? `${KIND_LABEL[lock.kind]}${lock.bio ? ' 또는 지문' : ''}으로 풀어요. 앱을 켤 때와 다른 앱에 갔다 돌아올 때 물어요.`
              : `숫자 4자리 또는 ${PASSWORD_MIN}자리 이상 비밀번호로 가계부, 일기를 다른 사람이 못 보게 잠가요.`}
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
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3">
            <Fingerprint className={`size-6 shrink-0 ${bio?.available ? 'text-brand-600' : 'text-slate-400'}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">지문으로 풀기</p>
              <p className="text-xs break-keep text-slate-500">{bio?.available ? '지문이 안 되면 비밀번호로 풀 수 있어요' : BIOMETRIC_REASON_TEXT[bio?.reason ?? 'unavailable']}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={lock.bio}
              aria-label="지문으로 풀기"
              disabled={!bio?.available && !lock.bio}
              onClick={() => void toggleBio(!lock.bio)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-40 ${lock.bio ? 'bg-grad' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition-all ${lock.bio ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

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
        {flow &&
          (step === 'kind' ? (
            <div className="pt-1 pb-2">
              <p className="mb-3 text-sm text-slate-500">어떤 방식으로 잠글까요?</p>
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="잠금 방식">
                {KINDS.map(({ kind: k, icon: Icon, title, desc }) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => pickKind(k)}
                    className="flex items-center gap-3 rounded-2xl bg-slate-100 p-4 text-left transition active:scale-[0.99] active:bg-slate-200"
                  >
                    <span className="bg-grad-soft flex size-11 shrink-0 items-center justify-center rounded-full text-brand-600">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900">
                        {title}
                        {flow === 'change' && lock?.kind === k && <span className="ml-1.5 text-xs font-semibold text-slate-400">지금 방식</span>}
                      </span>
                      <span className="block text-sm text-slate-500">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
              {bio?.available && <p className="mt-3 text-xs break-keep text-slate-400">정한 뒤에 설정에서 지문으로 풀기도 켤 수 있어요.</p>}
            </div>
          ) : (
            <div className="flex justify-center pt-2 pb-2">
              <SecretPad
                key={`${flow}-${step}-${padKind}`}
                kind={padKind}
                mode={step === 'current' ? 'current' : 'new'}
                title={stepTitle}
                subtitle={stepSub}
                error={error}
                disabled={busy}
                onComplete={(v) => void onSecret(v)}
              />
            </div>
          ))}
      </Modal>
    </section>
  )
}

import { Fingerprint, Lock } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadLock, onLockChange, removeLock, shouldRelock, verifySecret, waitAfterFails } from '../../lib/appLock'
import { afterSplash } from '../../lib/splashSignal'
import { forgetSyncBeforeWipe } from '../../lib/sync/account'
import { authenticateBiometric } from '../../platform/biometric'
import { backupRepo } from '../../repositories/backupRepo'
import Button from '../common/Button'
import SecretPad from '../common/SecretPad'
import { inputClass } from '../common/formStyles'

// 다시 켜도(새로 고침) 기다리는 시간을 못 건너뛰게 저장해 둔다
const FAIL_KEY = 'tidy-app-lock-fails'
function readFails(): { count: number; until: number } {
  try {
    const v = JSON.parse(localStorage.getItem(FAIL_KEY) ?? 'null') as { count: number; until: number } | null
    return v && typeof v.count === 'number' ? v : { count: 0, until: 0 }
  } catch {
    return { count: 0, until: 0 }
  }
}
function writeFails(v: { count: number; until: number } | null) {
  try {
    if (v) localStorage.setItem(FAIL_KEY, JSON.stringify(v))
    else localStorage.removeItem(FAIL_KEY)
  } catch {
    /* 저장 못 해도 잠금은 된다 */
  }
}

/**
 * 잠금 화면: 앱을 켤 때, 그리고 다른 앱에 갔다가 정한 시간이 지나 돌아오면 덮는다.
 * 시작 화면(사진)보다 아래에 깔려서, 시작 화면이 지나가면 바로 비밀번호를 묻는다.
 * 잠금 방식(숫자 4자리 / 8자리 이상 비밀번호)에 맞는 입력을 보여 주고,
 * 지문을 켜 두었으면 지문 창을 먼저 띄운다. 지문 창을 닫으면 비밀번호로 푼다.
 */
export default function LockScreen() {
  const [locked, setLocked] = useState(() => loadLock() != null)
  const [error, setError] = useState<string>()
  const [checking, setChecking] = useState(false)
  const [fails, setFails] = useState(readFails)
  const [now, setNow] = useState(() => Date.now())
  const [forgot, setForgot] = useState(false)
  const [word, setWord] = useState('')
  const [lock, setLock] = useState(loadLock)
  const [bioError, setBioError] = useState<string>()
  const hiddenAt = useRef<number | null>(null)
  // 지문 창이 떠 있는 동안 (폰에 따라 앱이 잠깐 가려진 것으로 쳐서, 풀자마자 다시 잠기지 않게)
  const bioBusy = useRef(false)

  const unlock = useCallback(() => {
    writeFails(null)
    setFails({ count: 0, until: 0 })
    setError(undefined)
    setBioError(undefined)
    hiddenAt.current = null
    setLocked(false)
  }, [])

  const tryBiometric = useCallback(async () => {
    if (bioBusy.current || !loadLock()?.bio) return
    bioBusy.current = true
    setBioError(undefined)
    const r = await authenticateBiometric()
    // 창이 닫히면서 생기는 '돌아옴' 신호를 넘기고 나서 풀어 준다
    setTimeout(() => (bioBusy.current = false), 1000)
    if (r.ok) unlock()
    else if (r.error) setBioError(r.error)
  }, [unlock])

  // 잠기면 (시작 화면이 지나간 뒤) 지문 창을 바로 띄운다
  useEffect(() => {
    if (!locked || !loadLock()?.bio) return
    return afterSplash(() => void tryBiometric())
  }, [locked, tryBiometric])

  // 다른 앱으로 가면 시각을 적어 두고, 돌아오면 잠글지 정한다
  useEffect(() => {
    const onVis = () => {
      const lock = loadLock()
      if (!lock || bioBusy.current) return
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now()
      else if (shouldRelock(hiddenAt.current, Date.now(), lock.after)) setLocked(true)
    }
    document.addEventListener('visibilitychange', onVis)
    const off = onLockChange(() => {
      setLock(loadLock())
      if (!loadLock()) setLocked(false)
    })
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      off()
    }
  }, [])

  // 기다리는 동안 남은 초를 센다
  const waitLeft = Math.max(0, Math.ceil((fails.until - now) / 1000))
  useEffect(() => {
    if (waitLeft <= 0) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [waitLeft])

  // 잠긴 동안 뒤 화면이 스크롤되지 않게
  useEffect(() => {
    if (!locked) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [locked])

  async function check(secret: string) {
    setChecking(true)
    const ok = await verifySecret(secret).catch(() => false)
    setChecking(false)
    if (ok) return unlock()
    const count = fails.count + 1
    const wait = waitAfterFails(count)
    const next = { count, until: wait ? Date.now() + wait * 1000 : 0 }
    writeFails(next)
    setFails(next)
    setNow(Date.now())
    setError(wait ? `${count}번 틀렸어요. 잠시 뒤에 다시 해 주세요` : `비밀번호가 달라요 (${count}번 틀림)`)
  }

  async function resetAll() {
    // 구글 로그인 중이면 먼저 클라우드와 끊는다 (클라우드 기록은 남겨서 다시 로그인하면 받을 수 있게)
    await forgetSyncBeforeWipe()
    await backupRepo.clearAll()
    writeFails(null)
    removeLock()
    setForgot(false)
    setLocked(false)
  }

  if (!locked) return null
  const kind = lock?.kind ?? 'pin'
  const ask = kind === 'password' ? '비밀번호를 입력해 주세요' : '비밀번호 4자리를 눌러 주세요'

  return (
    <div className="fixed inset-0 z-[55] flex flex-col items-center justify-center bg-slate-100 px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]" role="dialog" aria-modal="true" aria-label="앱 잠금">
      {forgot ? (
        <div className="card w-full max-w-sm p-6">
          <p className="text-lg font-extrabold">비밀번호를 잊으셨나요?</p>
          <p className="mt-2 text-sm leading-relaxed break-keep text-slate-600">
            비밀번호는 이 기기에만 있어서 찾을 수 없어요. 초기화하면 <b className="text-expense">가계부, 할 일, 일기, 스크랩이 모두 지워지고</b> 잠금이 풀려요. 백업 파일이 있으면 나중에 설정에서 다시 가져올 수 있어요.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-600" htmlFor="lock-reset-word">
            지우려면 <b>초기화</b> 라고 써 주세요
          </label>
          <input id="lock-reset-word" value={word} onChange={(e) => setWord(e.target.value)} className={`${inputClass()} mt-1`} autoComplete="off" />
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setForgot(false)}>
              돌아가기
            </Button>
            <Button variant="danger" className="flex-1" disabled={word.trim() !== '초기화'} onClick={() => void resetAll()}>
              모두 지우기
            </Button>
          </div>
        </div>
      ) : (
        <>
          <span className="bg-grad-soft mb-5 flex size-14 items-center justify-center rounded-full text-brand-600">
            <Lock className="size-6" aria-hidden />
          </span>
          <SecretPad
            kind={kind}
            title="Tidy 비밀번호"
            subtitle={waitLeft > 0 ? `${waitLeft}초 뒤에 다시 입력할 수 있어요` : (bioError ?? ask)}
            error={waitLeft > 0 ? undefined : error}
            disabled={checking || waitLeft > 0}
            onComplete={(v) => void check(v)}
          />
          {lock?.bio && (
            <button
              type="button"
              onClick={() => void tryBiometric()}
              className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-brand-700 shadow-card active:scale-[0.98]"
            >
              <Fingerprint className="size-5" aria-hidden />
              지문으로 풀기
            </button>
          )}
          <button type="button" onClick={() => setForgot(true)} className="mt-6 text-sm font-semibold text-slate-500 underline underline-offset-2">
            비밀번호를 잊었어요
          </button>
        </>
      )}
    </div>
  )
}

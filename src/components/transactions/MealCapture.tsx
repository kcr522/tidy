import { Camera, Clock, ExternalLink, ImagePlus, Loader2, MapPin, MapPinOff, Minus, Plus, UtensilsCrossed } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { MealError, priceLine, type MealGuess, type NearbyPlace } from '../../lib/ai/meal'
import { mealEngineFor } from '../../lib/ai/mealEngines'
import { useAiSettings } from '../../lib/ai/settings'
import { formatDateLabel, formatTimeLabel, formatWon } from '../../lib/format'
import { readPhotoInfo, shrinkPhoto, type PhotoInfo } from '../../lib/meal/photo'
import { mealMemo, suggestedAmount } from '../../lib/meal/record'
import { parseAmount } from '../../lib/validate'
import type { TransactionInput } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'

type Step =
  | { kind: 'pick' }
  | { kind: 'working' }
  | { kind: 'confirm'; guess: MealGuess }
  | { kind: 'edit'; reason?: string }

interface Props {
  onSave: (input: TransactionInput) => Promise<void> | void
}

/**
 * 음식 사진으로 지출 기록
 * 사진 고르기 → (찍은 때·위치 읽기) → AI가 음식·가게·메뉴판 가격 찾기 → "이 가격 맞아요?" → 기록
 */
export default function MealCapture({ onSave }: Props) {
  const [settings] = useAiSettings()
  const engine = mealEngineFor(settings)
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [preview, setPreview] = useState<string | null>(null)
  const [info, setInfo] = useState<PhotoInfo | null>(null)
  const [dish, setDish] = useState('')
  const [place, setPlace] = useState('')
  const [servings, setServings] = useState(1)
  const [amount, setAmount] = useState('')
  const [amountError, setAmountError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [nearby, setNearby] = useState<NearbyPlace[]>([])
  const abort = useRef<AbortController | null>(null)
  const inputId = useId()

  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function pick(file: File) {
    abort.current?.abort()
    const ctrl = new AbortController()
    abort.current = ctrl
    setPreview(URL.createObjectURL(file))
    const photo = await readPhotoInfo(file)
    setInfo(photo)
    if (!engine) {
      setStep({ kind: 'edit', reason: "AI 연결이 '기본'이라 음식과 가격은 직접 적어 주세요. 설정 > AI 연결에서 Claude로 바꿀 수 있어요." })
      return
    }
    setStep({ kind: 'working' })
    try {
      const image = await shrinkPhoto(file)
      const { guess, nearby } = await engine(
        { image, date: photo.date, time: photo.time, ...(photo.location ? { location: photo.location } : {}) },
        ctrl.signal,
      )
      if (ctrl.signal.aborted) return
      setDish(guess.dish)
      setPlace(guess.place ?? '')
      setServings(guess.servings)
      setNearby(nearby)
      const suggested = suggestedAmount(guess)
      setAmount(suggested === null ? '' : String(suggested))
      setStep(suggested === null ? { kind: 'edit', reason: `${priceLine(guess)}. 얼마였어요?` } : { kind: 'confirm', guess })
    } catch (err) {
      if (ctrl.signal.aborted) return
      const msg = err instanceof MealError ? err.message : 'AI에 연결하지 못했어요'
      setStep({ kind: 'edit', reason: `${msg}. 직접 적어 주세요.` })
    }
  }

  async function save() {
    if (!info) return
    const parsed = parseAmount(amount)
    if (!parsed.ok) {
      setAmountError(parsed.error)
      return
    }
    setSaving(true)
    try {
      await onSave({ type: 'EXPENSE', amount: parsed.value, category: '식비', date: info.date, time: info.time, memo: mealMemo(place, dish) })
    } finally {
      setSaving(false)
    }
  }

  /** 그릇 수를 바꾸면 메뉴판 가격 기준으로 금액도 바꾼다 */
  function changeServings(next: number, unit: number | null) {
    const n = Math.min(9, Math.max(1, next))
    setServings(n)
    if (unit !== null) setAmount(String(unit * n))
  }

  if (step.kind === 'pick') {
    return (
      <div className="space-y-4">
        <label
          htmlFor={inputId}
          className="tap flex cursor-pointer flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center hover:bg-slate-100"
        >
          <span className="bg-grad on-grad flex size-16 items-center justify-center rounded-full shadow-float">
            <ImagePlus className="size-7" aria-hidden />
          </span>
          <span className="text-lg font-extrabold">음식 사진 고르기</span>
          <span className="text-sm break-keep text-slate-500">사진에 들어 있는 시간과 위치로 어디서 뭘 먹었는지 찾아볼게요.</span>
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void pick(f)
          }}
        />
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] break-keep text-amber-800">
          아이폰은 사진을 고를 때 아래 <b>옵션</b>에서 <b>위치</b>를 켜야 위치가 같이 와요. 위치가 없어도 가게 이름을 직접 적을 수 있어요.
        </p>
      </div>
    )
  }

  const unit = step.kind === 'confirm' ? (step.guess.price ?? step.guess.guessPrice) : null

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        {preview && <img src={preview} alt="고른 음식 사진" className="size-24 shrink-0 rounded-2xl object-cover shadow-card" />}
        <div className="min-w-0 space-y-1.5 text-sm text-slate-600">
          {info && (
            <p className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0 text-slate-400" aria-hidden />
              {formatDateLabel(info.date)} {formatTimeLabel(info.time)}
              {!info.fromExif && <span className="text-slate-400">(파일 날짜)</span>}
            </p>
          )}
          {info && (
            <p className="flex items-center gap-1.5">
              {info.location ? (
                <>
                  <MapPin className="size-4 shrink-0 text-brand-600" aria-hidden />
                  사진에 위치가 있어요
                </>
              ) : (
                <>
                  <MapPinOff className="size-4 shrink-0 text-slate-400" aria-hidden />
                  사진에 위치가 없어요
                </>
              )}
            </p>
          )}
          {step.kind === 'confirm' && (
            <>
              <p className="flex items-center gap-1.5 text-base font-bold text-slate-900">
                <UtensilsCrossed className="size-4 shrink-0 text-brand-600" aria-hidden />
                {dish}
              </p>
              <p className="truncate font-semibold text-slate-800">
                📍 {place || '가게를 못 찾았어요'}
                {place && !step.guess.placeSure && <span className="ml-1 text-xs font-medium text-amber-600">(아마도)</span>}
              </p>
            </>
          )}
        </div>
      </div>

      {step.kind === 'working' && (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-5" role="status">
          <Loader2 className="size-5 animate-spin text-brand-600" aria-hidden />
          <div>
            <p className="font-bold">무엇을 먹었는지 보고 있어요</p>
            <p className="text-sm text-slate-500">근처 가게와 메뉴판 가격도 찾는 중이에요 (30초쯤 걸려요)</p>
          </div>
        </div>
      )}

      {step.kind === 'confirm' && (
        <div className="rounded-3xl bg-slate-50 p-5 text-center">
          <p className="text-sm font-semibold text-slate-500">{step.guess.price !== null ? '인터넷 메뉴판 가격' : '메뉴판은 못 찾았어요. 보통 이 정도래요'}</p>
          <p className="mt-1 text-3xl font-extrabold tracking-tight">{formatWon(Number(amount) || 0)}</p>
          {unit !== null && (
            <div className="mt-2 flex items-center justify-center gap-2 text-sm text-slate-600">
              <span>
                {formatWon(unit)} ×
              </span>
              <button type="button" className="rounded-full bg-white p-1.5 shadow-card" onClick={() => changeServings(servings - 1, unit)} aria-label="하나 빼기">
                <Minus className="size-3.5" aria-hidden />
              </button>
              <span className="w-4 font-bold">{servings}</span>
              <button type="button" className="rounded-full bg-white p-1.5 shadow-card" onClick={() => changeServings(servings + 1, unit)} aria-label="하나 더하기">
                <Plus className="size-3.5" aria-hidden />
              </button>
            </div>
          )}
          {(step.guess.priceNote || step.guess.priceUrl) && (
            <p className="mt-2 text-xs break-keep text-slate-500">
              {step.guess.priceNote}
              {step.guess.priceUrl && (
                <a href={step.guess.priceUrl} target="_blank" rel="noreferrer" className="ml-1 inline-flex items-center gap-0.5 font-semibold text-brand-700 underline">
                  출처 보기 <ExternalLink className="size-3" aria-hidden />
                </a>
              )}
            </p>
          )}
          <p className="mt-4 text-lg font-extrabold">이 가격 맞아요?</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => setStep({ kind: 'edit' })}>
              아니요, 고칠래요
            </Button>
            <Button onClick={save} disabled={saving}>
              맞아요, 기록
            </Button>
          </div>
        </div>
      )}

      {step.kind === 'edit' && (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          {step.reason && <p className="rounded-2xl bg-slate-50 px-4 py-3 text-sm break-keep text-slate-600">{step.reason}</p>}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-600">얼마였어요?</span>
            <input
              className={inputClass(amountError !== null)}
              inputMode="numeric"
              placeholder="예: 9,000"
              value={amount}
              autoFocus
              onChange={(e) => {
                setAmount(e.target.value)
                setAmountError(null)
              }}
              aria-invalid={amountError !== null}
            />
            {amountError && <span className="mt-1 block text-sm text-expense">{amountError}</span>}
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-600">가게</span>
            <input className={inputClass()} placeholder="예: 진미식당" value={place} onChange={(e) => setPlace(e.target.value)} />
          </label>
          {nearby.length > 0 && (
            <div className="-mt-1 flex flex-wrap gap-1.5" role="group" aria-label="근처 가게">
              {nearby.slice(0, 6).map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setPlace(p.name)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${place === p.name ? 'bg-grad on-grad' : 'bg-slate-100 text-slate-600'}`}
                >
                  {p.name} · {p.distance}m
                </button>
              ))}
            </div>
          )}
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-600">먹은 것</span>
            <input className={inputClass()} placeholder="예: 김치찌개" value={dish} onChange={(e) => setDish(e.target.value)} />
          </label>
          <Button type="submit" className="w-full" disabled={saving}>
            <Camera className="size-4" aria-hidden />
            기록하기
          </Button>
        </form>
      )}
    </div>
  )
}

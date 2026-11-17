import { ClipboardPaste, ImagePlus, Loader2, ScanText } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { refinePayments } from '../../lib/assistant/learn'
import { formatWon } from '../../lib/format'
import { parseBankText } from '../../lib/ocr/bankText'
import { recognizeText } from '../../lib/ocr/recognize'
import { merchantAliasRepo } from '../../repositories/merchantAliasRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'
import PaymentDraftCard, { type DraftRow } from './PaymentDraftCard'

type Row = DraftRow

type Step = { kind: 'pick' } | { kind: 'reading'; stage: string; ratio: number } | { kind: 'review'; rows: Row[]; balance: number | null; text: string }

interface Props {
  today: string
  /** 저장을 마치면 (저장한 개수) */
  onDone: (saved: number) => void
}

/**
 * 은행·카드 앱 캡처로 가계부 입력 (AI 없이, 기기 안 글자 인식)
 * 캡처 고르기(또는 붙여넣기) → 글자 읽기 → 날짜·금액·가게·카테고리 찾기 → 확인하고 저장
 */
export default function BankCapture({ today, onDone }: Props) {
  const [step, setStep] = useState<Step>({ kind: 'pick' })
  const [preview, setPreview] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileId = useId()

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])

  async function toRows(text: string) {
    const parsed = parseBankText(text, today)
    const [transactions, aliases] = await Promise.all([transactionRepo.listAll(), merchantAliasRepo.list()])
    const drafts = refinePayments(parsed.payments, transactions, aliases)
    const rows = drafts.map((d, i) => ({ ...d, key: i, checked: !d.duplicate, realName: '' }))
    setStep({ kind: 'review', rows, balance: parsed.balance, text })
  }

  async function readImage(file: File) {
    if (!file.type.startsWith('image/')) return setError('사진 파일을 골라 주세요')
    if (file.size > 15 * 1024 * 1024) return setError('15MB보다 작은 사진을 골라 주세요')
    setError(null)
    setPreview(URL.createObjectURL(file))
    setStep({ kind: 'reading', stage: '글자 인식 준비 중', ratio: 0 })
    try {
      const text = await recognizeText(file, (stage, ratio) =>
        setStep({ kind: 'reading', stage: stage === 'loading' ? '글자 인식 준비 중 (처음 한 번만 오래 걸려요)' : '글자 읽는 중', ratio }),
      )
      await toRows(text)
    } catch {
      setStep({ kind: 'pick' })
      setError('글자를 읽지 못했어요. 인터넷에 연결된 상태로 한 번 더 해 주세요 (처음 한 번은 인식 파일을 받아야 해요)')
    }
  }

  // 컴퓨터: Ctrl+V로 캡처 붙여넣기
  useEffect(() => {
    if (step.kind !== 'pick') return
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        void readImage(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  })

  function update(key: number, patch: Partial<Row> | ((r: Row) => Partial<Row>)) {
    setStep((s) => (s.kind === 'review' ? { ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)) } : s))
  }

  async function save() {
    if (step.kind !== 'review') return
    const picked = step.rows.filter((r) => r.checked)
    setSaving(true)
    try {
      for (const r of picked) {
        const id = await transactionRepo.add(r.input)
        const name = r.realName.trim()
        if (name) await transactionRepo.resolveMerchant(id, name, true)
      }
      onDone(picked.length)
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  if (step.kind === 'reading') {
    return (
      <div className="py-6 text-center">
        {preview && <img src={preview} alt="고른 캡처" className="mx-auto mb-5 max-h-56 rounded-2xl object-contain shadow-card" />}
        <Loader2 className="mx-auto size-7 animate-spin text-brand-500" aria-hidden />
        <p className="mt-3 text-[15px] font-semibold text-slate-700">{step.stage}</p>
        <div className="mx-auto mt-3 h-2 max-w-60 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={Math.round(step.ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="bg-grad h-full rounded-full transition-all" style={{ width: `${Math.max(5, step.ratio * 100)}%` }} />
        </div>
        <p className="mt-3 text-xs text-slate-400">사진은 이 기기 안에서만 읽고, 어디에도 보내지 않아요.</p>
      </div>
    )
  }

  if (step.kind === 'review') {
    const count = step.rows.filter((r) => r.checked).length
    return (
      <div>
        {step.rows.length === 0 ? (
          <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
            <ScanText className="mx-auto size-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-[15px] font-semibold text-slate-600">거래 내역을 찾지 못했어요</p>
            <p className="mt-1 text-xs text-slate-400">금액(예: -5,000원)이 보이는 은행·카드 앱 화면인지 확인해 주세요.</p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {step.rows.length}건을 찾았어요. 맞는지 확인하고 저장할 것만 골라 주세요.
              {step.balance !== null && <> 캡처의 잔액은 {formatWon(step.balance)}이에요.</>}
            </p>
            <ul className="space-y-2.5">
              {step.rows.map((r) => (
                <PaymentDraftCard key={r.key} row={r} onChange={(p) => update(r.key, p)} />
              ))}
            </ul>
          </>
        )}

        <details className="mt-4 text-xs text-slate-400">
          <summary className="cursor-pointer">읽은 글자 보기</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-slate-50 p-3 whitespace-pre-wrap">{step.text}</pre>
        </details>

        {error && <p className="mt-3 text-sm text-expense">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button variant="secondary" onClick={() => setStep({ kind: 'pick' })}>
            다시 고르기
          </Button>
          <Button className="flex-1" onClick={save} disabled={saving || count === 0}>
            {count}건 저장
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label
        htmlFor={fileId}
        className="flex cursor-pointer flex-col items-center rounded-3xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-9 text-center transition hover:border-brand-300 hover:bg-brand-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const f = e.dataTransfer.files[0]
          if (f) void readImage(f)
        }}
      >
        <span className="bg-grad on-grad flex size-14 items-center justify-center rounded-2xl shadow-float">
          <ImagePlus className="size-7" aria-hidden />
        </span>
        <span className="mt-3 text-[15px] font-bold text-slate-800">은행·카드 앱 캡처 고르기</span>
        <span className="mt-1 text-xs text-slate-500">거래 내역 화면이나 결제 알림을 캡처해서 올려 주세요. 컴퓨터는 Ctrl+V로 붙여넣어도 돼요.</span>
      </label>
      <input
        id={fileId}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) void readImage(f)
        }}
      />

      <div className="mt-5">
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <ClipboardPaste className="size-4" aria-hidden /> 또는 결제 알림 문자를 붙여넣기
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          placeholder={'예: 신한카드 승인 6,100원 11/08 08:41 스타벅스강남R점'}
          className={`${inputClass(false)} py-3`}
        />
        <Button variant="secondary" className="mt-2 w-full" disabled={!pasted.trim()} onClick={() => void toRows(pasted)}>
          글에서 찾기
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
      <p className="mt-4 text-center text-xs text-slate-400">AI 없이 이 기기 안에서 글자를 읽어요. 무료이고 사진은 어디에도 보내지 않아요.</p>
    </div>
  )
}

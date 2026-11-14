import { useLiveQuery } from 'dexie-react-hooks'
import { Coins } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { eulReul, formatDateLabel, formatNumber, formatWon } from '../../lib/format'
import { parseAmount } from '../../lib/validate'
import { recurringRepo } from '../../repositories/recurringRepo'
import Button from '../common/Button'
import Modal from '../common/Modal'
import { inputClass } from '../common/formStyles'
import { useToast } from '../common/Toast'

/**
 * 금액이 일정하지 않은 정기 내역(예: 월급)의 날이 되면 "월급을 입력해주세요" 창을 띄운다.
 * 적은 금액은 그날 가계부에 기록된다. "나중에"를 누르면 앱을 다시 열 때 또 물어본다.
 */
export default function AskAmountPrompt({ today }: { today: string }) {
  const asks = useLiveQuery(() => recurringRepo.dueAsks(today), [today])
  const [later, setLater] = useState<string[]>([])
  const ask = asks?.find((a) => !later.includes(`${a.rule.id}:${a.date}`))
  if (!ask || ask.rule.id == null) return null
  const key = `${ask.rule.id}:${ask.date}`
  return <AskAmountSheet key={key} id={ask.rule.id} name={ask.rule.memo || ask.rule.category} income={ask.rule.type === 'INCOME'} date={ask.date} today={today} onLater={() => setLater((l) => [...l, key])} />
}

interface SheetProps {
  id: number
  name: string
  income: boolean
  date: string
  today: string
  onLater: () => void
}

function AskAmountSheet({ id, name, income, date, today, onLater }: SheetProps) {
  const [amountText, setAmountText] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  async function record(amount: number | null) {
    setBusy(true)
    try {
      await recurringRepo.recordAsked(id, date, amount)
      if (amount != null) toast(`${name} ${formatWon(amount)}을 가계부에 ${income ? '수입' : '지출'}으로 기록했어요`)
    } catch {
      toast('기록하지 못했어요. 다시 시도해 주세요', 'error')
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const amount = parseAmount(amountText)
    if (!amount.ok) return setError(amount.error)
    void record(amount.value)
  }

  return (
    <Modal open title={`${name}${eulReul(name)} 입력해주세요`} onClose={onLater}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 text-brand-700">
          <Coins className="size-6 shrink-0" aria-hidden />
          <p className="text-sm">
            <b className="text-base">
              {date === today ? '오늘' : formatDateLabel(date)}은 {name} 날이에요
            </b>
            <br />
            이번에 {income ? '받은' : '나간'} 금액을 적으면 그날 가계부에 {income ? '수입' : '지출'}으로 기록돼요.
          </p>
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-600">{income ? '받은 금액' : '나간 금액'}</span>
          <div className="relative">
            <input
              autoFocus
              inputMode="numeric"
              value={amountText}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 10)
                setAmountText(digits ? formatNumber(Number(digits)) : '')
                setError(undefined)
              }}
              placeholder="0"
              className={`${inputClass(!!error)} pr-10 text-right text-xl font-bold`}
            />
            <span className="absolute top-1/2 right-4 -translate-y-1/2 text-slate-500">원</span>
          </div>
          {error && <span className="mt-1 block text-sm text-expense">{error}</span>}
        </label>
        <Button type="submit" className="w-full" disabled={busy}>
          가계부에 기록하기
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1 text-sm" onClick={onLater} disabled={busy}>
            나중에
          </Button>
          <Button variant="ghost" className="flex-1 text-sm" onClick={() => record(null)} disabled={busy}>
            이번엔 {income ? '안 받았어요' : '없었어요'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

import { Delete } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { evaluate, formatExpr, pressKey, toWon } from '../../lib/calc'
import { formatNumber } from '../../lib/format'
import { MAX_AMOUNT } from '../../lib/validate'

interface AmountCalculatorProps {
  /** 지금 금액칸에 적힌 값 ("15,000") — 계산을 여기서 시작한다 */
  initial: string
  /** 계산 결과를 금액칸에 넣는다 */
  onApply: (amount: number) => void
  onClose: () => void
}

const KEYS = ['C', '⌫', '÷', '×', '7', '8', '9', '−', '4', '5', '6', '+', '1', '2', '3', '=', '00', '0', '.'] as const

/** 키보드로도 누를 수 있게 (컴퓨터) */
const KEYBOARD: Record<string, string> = { '*': '×', x: '×', X: '×', '/': '÷', '-': '−', '+': '+', Backspace: '⌫', Escape: 'C', Delete: 'C', ',': '' }

/** 가계부 금액칸 아래에 펼쳐지는 간단 계산기 (사용자 요청 2026-11-20) */
export default function AmountCalculator({ initial, onApply, onClose }: AmountCalculatorProps) {
  const [expr, setExpr] = useState(() => initial.replace(/\D/g, ''))
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // 컴퓨터에서 바로 키보드로 칠 수 있게 (폰은 화면 키보드가 뜨지 않는다)
    panelRef.current?.focus({ preventScroll: true })
    panelRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])

  const value = evaluate(expr)
  const won = value === null ? null : toWon(value)
  const hasOp = /[+−×÷]/.test(expr)
  const error = expr && value === null && expr.includes('÷') ? '0으로 나눌 수 없어요' : won !== null && won < 1 ? '1원 이상이어야 넣을 수 있어요' : won !== null && won > MAX_AMOUNT ? '금액이 너무 커요' : ''
  const canApply = won !== null && won >= 1 && won <= MAX_AMOUNT

  function press(key: string) {
    if (key === '=') {
      if (won !== null) setExpr(String(won))
      return
    }
    setExpr((e) => pressKey(e, key))
  }

  function apply() {
    if (!canApply) return
    onApply(won)
    onClose()
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      apply()
      return
    }
    if (e.key === 'Escape' && expr === '') {
      e.preventDefault()
      onClose()
      return
    }
    const key = /^\d$/.test(e.key) || e.key === '.' || e.key === '=' ? e.key : KEYBOARD[e.key]
    if (key === undefined) return
    e.preventDefault()
    if (key) press(key)
  }

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      role="group"
      aria-label="계산기"
      className="rounded-2xl bg-slate-100 p-2 outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
    >
      {/* 식과 결과 */}
      <div className="mb-2 rounded-xl bg-white px-3 py-2 text-right" aria-live="polite">
        <div className="min-h-5 truncate text-sm text-slate-500">{expr ? formatExpr(expr) : '계산할 식을 눌러 주세요'}</div>
        <div className={`min-h-7 truncate text-xl font-bold ${error ? 'text-expense text-base leading-7' : 'text-slate-900'}`}>
          {error || (won !== null && (hasOp || expr) ? `${hasOp ? '= ' : ''}${formatNumber(won)}원` : '')}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {KEYS.map((k) => {
          const op = ['÷', '×', '−', '+', '='].includes(k)
          const fn = k === 'C' || k === '⌫'
          return (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              aria-label={k === '⌫' ? '한 글자 지우기' : k === 'C' ? '모두 지우기' : k}
              className={`min-h-11 rounded-xl text-lg font-semibold transition-colors active:scale-[0.97] ${
                k === '=' ? 'bg-brand-500 text-white' : op ? 'bg-brand-50 text-brand-600' : fn ? 'bg-slate-200 text-slate-600' : 'bg-white text-slate-900 shadow-card'
              }`}
            >
              {k === '⌫' ? <Delete size={20} className="mx-auto" aria-hidden /> : k}
            </button>
          )
        })}
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="min-h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          넣기
        </button>
      </div>
    </div>
  )
}

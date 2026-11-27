import { Plus, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { formatNumber } from '../../lib/format'
import { addWord, loadPayFilter, onPayFilterChange, payAppRows, removeApp, savePayFilter, type PayAppRow, type PayFilter } from '../../lib/payNotifyFilter'
import { listPayNotifications, listPayNotifyApps } from '../../platform/payNotify'
import Button from '../common/Button'
import { inputClass } from '../common/formStyles'
import PayAppPicker, { AppIcon } from './PayAppPicker'

/** 설정 > 결제 알림 > 기록하지 않을 알림: 낱말, 앱, 적은 금액, 입금 */
export default function PayFilterEditor() {
  const [filter, setFilter] = useState<PayFilter>(loadPayFilter)
  const [word, setWord] = useState('')
  const [min, setMin] = useState(() => (filter.minAmount ? formatNumber(filter.minAmount) : ''))
  useEffect(() => onPayFilterChange(() => setFilter(loadPayFilter())), [])
  const [picking, setPicking] = useState(false)
  const [rows, setRows] = useState<PayAppRow[] | null>(null)
  // 앱 목록(아이콘 포함)은 폰에서 읽는다. 옛 앱이면 모아 둔 결제 알림을 보낸 앱으로
  const loadApps = useCallback(() => {
    void Promise.all([listPayNotifyApps(), listPayNotifications()]).then(([apps, items]) => setRows(payAppRows(loadPayFilter(), apps, items)))
  }, [])
  useEffect(loadApps, [loadApps])
  const iconOf = (pkg: string) => rows?.find((r) => r.pkg === pkg)?.icon

  const save = (f: PayFilter) => {
    setFilter(f)
    savePayFilter(f)
  }
  function submitWord() {
    if (!word.trim()) return
    save(addWord(filter, word))
    setWord('')
  }

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="font-semibold text-slate-800">기록하지 않을 알림</h3>
      <p className="mt-0.5 text-xs break-keep text-slate-500">여기 걸리는 결제 알림은 모으지도, &lsquo;기록할까요?&rsquo; 알림을 띄우지도 않아요.</p>

      <p className="mt-3 text-sm font-medium text-slate-600">이 낱말이 있으면 빼기</p>
      <p className="text-xs text-slate-400">가게 이름이나 알림 글에 들어 있으면 빼요. 예: 회사카드, 교통, 스타벅스</p>
      <form
        className="mt-1.5 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          submitWord()
        }}
      >
        <input value={word} onChange={(e) => setWord(e.target.value.slice(0, 30))} placeholder="낱말 넣기" aria-label="뺄 낱말" className={`${inputClass(false)} min-h-10 flex-1 text-sm`} />
        <Button type="submit" variant="secondary" className="min-h-10 w-11 px-0!" disabled={!word.trim()} aria-label="낱말 더하기">
          <Plus className="size-4" aria-hidden />
        </Button>
      </form>
      {filter.words.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {filter.words.map((w) => (
            <Chip key={w} label={w} onRemove={() => save({ ...filter, words: filter.words.filter((x) => x !== w) })} />
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center gap-2">
        <p className="flex-1 text-sm font-medium text-slate-600">이 앱 알림은 빼기</p>
        <Button
          type="button"
          variant="secondary"
          className="min-h-9 px-3! text-sm"
          onClick={() => {
            loadApps()
            setPicking(true)
          }}
        >
          <Plus className="size-4" aria-hidden />앱 고르기
        </Button>
      </div>
      {filter.apps.length > 0 ? (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {filter.apps.map((a) => (
            <Chip key={a.pkg} label={a.name} icon={<AppIcon icon={iconOf(a.pkg)} small />} onRemove={() => save(removeApp(filter, a.pkg))} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-400">&lsquo;앱 고르기&rsquo;에서 카드 · 은행 · 페이 앱을 골라 빼요.</p>
      )}
      <PayAppPicker open={picking} onClose={() => setPicking(false)} filter={filter} rows={rows} onChange={save} />

      <label className="mt-4 flex items-center gap-2 text-sm">
        <span className="flex-1 font-medium whitespace-nowrap text-slate-600">이 금액보다 적으면 빼기</span>
        <input
          value={min}
          inputMode="numeric"
          placeholder="없음"
          aria-label="뺄 금액 기준"
          onChange={(e) => {
            const n = Number(e.target.value.replace(/\D/g, '').slice(0, 9))
            setMin(n ? formatNumber(n) : '')
            save({ ...filter, minAmount: n })
          }}
          className={`${inputClass(false)} min-h-10 max-w-28 text-right text-sm`}
        />
        <span className="text-slate-500">원</span>
      </label>

      <label className="mt-4 flex items-center gap-3">
        <span className="flex-1 text-sm">
          <span className="block font-medium text-slate-600">입금 알림은 빼기</span>
          <span className="block text-xs text-slate-400">월급 · 이체 받은 돈은 직접 적을 때</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={filter.skipDeposit}
          aria-label="입금 알림은 빼기"
          onClick={() => save({ ...filter, skipDeposit: !filter.skipDeposit })}
          className={`relative h-7 w-12 shrink-0 rounded-full transition ${filter.skipDeposit ? 'bg-grad' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow transition ${filter.skipDeposit ? 'left-[22px]' : 'left-0.5'}`} />
        </button>
      </label>
    </div>
  )
}

function Chip({ label, icon, onRemove }: { label: string; icon?: ReactNode; onRemove: () => void }) {
  return (
    <li className={`flex items-center gap-0.5 rounded-full bg-slate-100 py-1 pr-1 text-sm text-slate-700 ${icon ? 'pl-1.5' : 'pl-3'}`}>
      {icon && <span className="mr-1">{icon}</span>}
      {label}
      <button type="button" onClick={onRemove} className="tap rounded-full p-1 text-slate-400 hover:bg-slate-200" aria-label={`${label} 지우기`}>
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  )
}

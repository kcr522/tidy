import { FileSpreadsheet } from 'lucide-react'
import { useState } from 'react'
import type { Transaction } from '../../../db/types'
import { isSaving, isSpending } from '../../../lib/categories'
import { formatWon } from '../../../lib/format'
import { EXPORT_RANGES, exportFileName, pickForExport, spanOf, toCsv, type ExportRange } from '../../../lib/moneyExport'
import { isNativeApp } from '../../../platform/native'
import { saveTextFile } from '../../../platform/saveFile'
import Button from '../../common/Button'
import { inputClass } from '../../common/formStyles'
import { useToast } from '../../common/Toast'

/** ≡ 메뉴 > 엑셀로 내보내기: 기간을 골라 가계부 내역을 CSV(엑셀에서 바로 열림)로 저장 · 공유 */
export default function ExportPanel({ items, today }: { items: Transaction[]; today: string }) {
  const toast = useToast()
  const [range, setRange] = useState<ExportRange>('thisMonth')
  const [from, setFrom] = useState(today.slice(0, 8) + '01')
  const [to, setTo] = useState(today)
  const [withSaving, setWithSaving] = useState(true)
  const [busy, setBusy] = useState(false)

  const span = spanOf(range, today, { from, to })
  const rows = pickForExport(items, span, withSaving)
  const income = rows.reduce((s, t) => (t.type === 'INCOME' ? s + t.amount : s), 0)
  const expense = rows.reduce((s, t) => (isSpending(t) ? s + t.amount : s), 0)
  const saving = rows.reduce((s, t) => (isSaving(t) ? s + t.amount : s), 0)
  const native = isNativeApp()

  async function run() {
    setBusy(true)
    try {
      const name = exportFileName(range, span)
      await saveTextFile(name, toCsv(rows), 'text/csv;charset=utf-8')
      if (!native) toast(`${name} 파일을 내려받았어요`)
    } catch {
      toast('내보내지 못했어요. 다시 시도해 주세요', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">엑셀 · 구글 시트 · 넘버스에서 바로 열 수 있는 CSV 파일로 저장해요. 한글도 깨지지 않아요.</p>

      <div>
        <p className="mb-2 text-sm font-bold text-slate-700">기간</p>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="내보낼 기간">
          {EXPORT_RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={range === r.key}
              onClick={() => setRange(r.key)}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold ${range === r.key ? 'bg-grad on-grad shadow-float' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="mt-3 flex items-center gap-2">
            <input type="date" value={from} max="9999-12-31" onChange={(e) => setFrom(e.target.value)} className={inputClass()} aria-label="시작일" />
            <span className="shrink-0 text-slate-400">~</span>
            <input type="date" value={to} max="9999-12-31" onChange={(e) => setTo(e.target.value)} className={inputClass()} aria-label="끝일" />
          </div>
        )}
        {range !== 'custom' && range !== 'all' && (
          <p className="mt-2 text-xs text-slate-400">
            {span.from} ~ {span.to}
          </p>
        )}
      </div>

      <label className="flex items-center gap-2.5 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={withSaving} onChange={(e) => setWithSaving(e.target.checked)} className="size-5 accent-brand-600" />
        저축 내역도 넣기
      </label>

      <div className="rounded-3xl bg-slate-50 p-4">
        <p className="text-sm font-bold text-slate-900">{rows.length}건을 내보내요</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <Total label="수입" value={income} className="text-income" />
          <Total label="지출" value={expense} className="text-expense" />
          <Total label="저축" value={saving} className="text-saving" />
        </div>
        <p className="mt-3 text-xs text-slate-400">칸: 날짜 · 시각 · 구분(수입/지출/저축) · 카테고리 · 내용 · 결제 수단 · 금액</p>
      </div>

      <Button className="w-full" onClick={run} disabled={busy || rows.length === 0}>
        <FileSpreadsheet className="size-5" aria-hidden />
        {rows.length === 0 ? '이 기간에는 내역이 없어요' : native ? '파일 만들고 보내기' : 'CSV 파일 내려받기'}
      </Button>
      {native && <p className="text-center text-xs text-slate-400">공유 창에서 내 파일 · 드라이브 · 카카오톡 · 메일로 보낼 수 있어요</p>}
    </div>
  )
}

function Total({ label, value, className }: { label: string; value: number; className: string }) {
  return (
    <div className="rounded-2xl bg-white p-2">
      <p className="text-slate-500">{label}</p>
      <p className={`mt-0.5 font-bold ${className}`}>{formatWon(value)}</p>
    </div>
  )
}

import { Search, Smartphone } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addApp, removeApp, type PayAppRow, type PayFilter } from '../../lib/payNotifyFilter'
import Modal from '../common/Modal'
import Switch from '../common/Switch'
import { inputClass } from '../common/formStyles'

interface Props {
  open: boolean
  onClose: () => void
  filter: PayFilter
  rows: PayAppRow[] | null
  onChange: (f: PayFilter) => void
}

/** 설정 > 기록하지 않을 알림 > 앱 고르기: 결제 알림을 읽는 앱 목록에서 스위치로 빼기 */
export default function PayAppPicker({ open, onClose, filter, rows, onChange }: Props) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const k = q.replace(/\s+/g, '').toLowerCase()
    const list = (rows ?? []).map((r) => ({ ...r, blocked: filter.apps.some((a) => a.pkg === r.pkg) }))
    return k ? list.filter((r) => `${r.name}${r.pkg}`.replace(/\s+/g, '').toLowerCase().includes(k)) : list
  }, [rows, filter, q])
  const seen = shown.filter((r) => r.count > 0)
  const rest = shown.filter((r) => r.count === 0)

  const toggle = (r: PayAppRow) => onChange(r.blocked ? removeApp(filter, r.pkg) : addApp(filter, r.pkg, r.name))

  return (
    <Modal open={open} title="뺄 앱 고르기" onClose={onClose}>
      <p className="text-sm break-keep text-slate-500">켠 앱의 결제 알림은 모으지도, &lsquo;기록할까요?&rsquo; 알림을 띄우지도 않아요.</p>
      <label className="relative mt-3 block">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="앱 이름 찾기" aria-label="앱 이름 찾기" className={`${inputClass(false)} min-h-10 pl-9 text-sm`} />
      </label>

      {rows === null ? (
        <p className="py-8 text-center text-sm text-slate-400">앱 목록을 읽는 중…</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm break-keep text-slate-400">{q ? '맞는 앱이 없어요' : '아직 결제 알림을 읽을 앱이 없어요. 카드·은행·페이 앱을 깔면 여기 보여요.'}</p>
      ) : (
        <>
          {seen.length > 0 && <Group title="결제 알림이 온 앱" rows={seen} onToggle={toggle} />}
          {rest.length > 0 && <Group title={seen.length ? '폰에 있는 다른 카드 · 은행 · 페이 앱' : '폰에 있는 카드 · 은행 · 페이 앱'} rows={rest} onToggle={toggle} />}
        </>
      )}
    </Modal>
  )
}

function Group({ title, rows, onToggle }: { title: string; rows: PayAppRow[]; onToggle: (r: PayAppRow) => void }) {
  return (
    <section className="mt-4">
      <h3 className="mb-1 text-xs font-semibold text-slate-500">{title}</h3>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.pkg} className="flex items-center gap-3 py-2.5">
            <AppIcon icon={r.icon} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-slate-800">{r.name}</span>
              <span className="block truncate text-xs text-slate-400">{r.blocked ? '빼는 중' : r.count > 0 ? `결제 알림 ${r.count}건` : '알림 온 적 없음'}</span>
            </span>
            <Switch on={r.blocked} onClick={() => onToggle(r)} label={`${r.name} 알림 빼기`} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function AppIcon({ icon, small }: { icon?: string; small?: boolean }) {
  const size = small ? 'size-5 rounded-md' : 'size-9 rounded-xl'
  return icon ? (
    <img src={icon} alt="" className={`${size} shrink-0 object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center bg-slate-100 text-slate-400`}>
      <Smartphone className={small ? 'size-3' : 'size-4'} aria-hidden />
    </span>
  )
}

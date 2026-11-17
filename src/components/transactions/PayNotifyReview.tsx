import { BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { refinePayments } from '../../lib/assistant/learn'
import { formatTimeLabel } from '../../lib/format'
import type { PayCandidate } from '../../lib/payNotify'
import { removePayNotifications } from '../../platform/payNotify'
import { merchantAliasRepo } from '../../repositories/merchantAliasRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import PaymentDraftCard, { type DraftPatch, type DraftRow } from './PaymentDraftCard'

interface Row extends DraftRow {
  candidate: PayCandidate
}

interface Props {
  candidates: PayCandidate[]
  /** 결제가 아니어서 같이 지울 알림 id */
  skipped: string[]
  /** 저장(또는 버리기)을 마치면 (저장한 개수) */
  onDone: (saved: number) => void
  /** 나중에 하기 (알림은 그대로 둔다) */
  onLater: () => void
}

/**
 * 결제 알림 → 가계부 확인 화면. 자동으로 저장하지 않고, 체크한 것만 저장한다.
 * 가게 이름은 알려 준 이름(merchantAliases)과 전에 고른 카테고리·결제 수단으로 맞춘다 (refinePayments)
 */
export default function PayNotifyReview({ candidates, skipped, onDone, onLater }: Props) {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    Promise.all([transactionRepo.listAll(), merchantAliasRepo.list()]).then(([transactions, aliases]) => {
      if (!alive) return
      const drafts = refinePayments(
        candidates.map((c) => c.guess),
        transactions,
        aliases,
      )
      setRows(drafts.map((d, i) => ({ ...d, key: i, checked: !d.duplicate, realName: '', candidate: candidates[i] })))
    })
    return () => {
      alive = false
    }
    // 화면을 열 때 한 번만 (보는 동안 새 알림이 와도 고친 내용이 날아가지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key: number, patch: DraftPatch) {
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)))
  }

  async function finish(save: boolean) {
    if (!rows) return
    const picked = save ? rows.filter((r) => r.checked) : []
    setSaving(true)
    setError(null)
    try {
      for (const r of picked) {
        const id = await transactionRepo.add(r.input)
        const name = r.realName.trim()
        if (name) await transactionRepo.resolveMerchant(id, name, true)
      }
      // 이 화면에 보인 알림은 저장했든 안 했든 목록에서 지운다
      await removePayNotifications([...rows.flatMap((r) => r.candidate.ids), ...skipped])
      onDone(picked.length)
    } catch {
      setError('저장하지 못했어요. 다시 시도해 주세요')
    } finally {
      setSaving(false)
    }
  }

  if (!rows) return <p className="py-8 text-center text-sm text-slate-400">불러오는 중…</p>

  const count = rows.filter((r) => r.checked).length
  return (
    <div>
      {rows.length === 0 ? (
        <div className="rounded-2xl bg-slate-50 px-4 py-8 text-center">
          <BellRing className="mx-auto size-8 text-slate-300" aria-hidden />
          <p className="mt-2 text-[15px] font-semibold text-slate-600">기록할 결제 알림이 없어요</p>
          <p className="mt-1 text-xs text-slate-400">카드 결제 알림이 오면 여기에 모여요.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm break-keep text-slate-500">결제 알림 {rows.length}건을 찾았어요. 맞는지 확인하고 저장할 것만 골라 주세요.</p>
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <PaymentDraftCard key={r.key} row={r} onChange={(p) => update(r.key, p)} note={<SourceNote candidate={r.candidate} />} />
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">체크하지 않은 알림은 저장하지 않고 목록에서 지워요.</p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-expense">{error}</p>}
      <div className="mt-4 flex gap-2">
        {rows.length > 0 && (
          <Button variant="secondary" onClick={onLater} disabled={saving}>
            나중에
          </Button>
        )}
        <Button className="flex-1" onClick={() => void finish(count > 0)} disabled={saving}>
          {rows.length === 0 ? '닫기' : count > 0 ? `${count}건 저장` : '모두 버리기'}
        </Button>
      </div>
    </div>
  )
}

function SourceNote({ candidate }: { candidate: PayCandidate }) {
  const s = candidate.source
  const d = new Date(s.postedAt)
  const time = formatTimeLabel(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
  const body = `${s.title} ${s.text}`.replace(/\s+/g, ' ').trim()
  return (
    <details className="mt-2 text-[11px] text-slate-400">
      <summary className="cursor-pointer truncate">
        🔔 {s.app || '알림'} · {time}
        {candidate.ids.length > 1 && ` · 알림 ${candidate.ids.length}개를 하나로`}
      </summary>
      <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 break-all whitespace-pre-wrap">{body}</p>
    </details>
  )
}

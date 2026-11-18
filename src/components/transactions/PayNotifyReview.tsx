import { BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { refinePayments } from '../../lib/assistant/learn'
import { formatTimeLabel, formatWon } from '../../lib/format'
import type { PayCandidate } from '../../lib/payNotify'
import { addApp, addWord, loadPayFilter, savePayFilter } from '../../lib/payNotifyFilter'
import { removePayNotifications } from '../../platform/payNotify'
import { merchantAliasRepo } from '../../repositories/merchantAliasRepo'
import { payMethodRepo } from '../../repositories/payMethodRepo'
import { transactionRepo } from '../../repositories/transactionRepo'
import Button from '../common/Button'
import PaymentDraftCard, { type DraftPatch, type DraftRow } from './PaymentDraftCard'

interface Row extends DraftRow {
  candidate: PayCandidate
  /** "다시 묻지 않기"로 거르기에 더한 것 (되돌릴 때 쓴다) */
  muted: { kind: 'word' | 'app'; label: string } | null
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
    Promise.all([transactionRepo.listAll(), merchantAliasRepo.list(), payMethodRepo.list()]).then(([transactions, aliases, methods]) => {
      if (!alive) return
      const drafts = refinePayments(
        candidates.map((c) => c.guess),
        transactions,
        aliases,
        methods,
      )
      setRows(drafts.map((d, i) => ({ ...d, key: i, checked: !d.duplicate, realName: '', candidate: candidates[i], muted: null })))
    })
    return () => {
      alive = false
    }
    // 화면을 열 때 한 번만 (보는 동안 새 알림이 와도 고친 내용이 날아가지 않게)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function update(key: number, patch: DraftPatch<Row>) {
    setRows((rs) => rs && rs.map((r) => (r.key === key ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r)))
  }

  /** 이 가게(또는 앱) 알림은 앞으로 기록하지 않기. 다시 누르면 되돌린다 */
  function mute(r: Row, kind: 'word' | 'app') {
    const f = loadPayFilter()
    const { guess, source } = r.candidate
    if (r.muted) {
      const m = r.muted
      savePayFilter(m.kind === 'word' ? { ...f, words: f.words.filter((w) => w !== m.label) } : { ...f, apps: f.apps.filter((a) => a.pkg !== source.pkg) })
      update(r.key, { muted: null, checked: !r.duplicate })
      return
    }
    if (kind === 'word') savePayFilter(addWord(f, guess.merchant))
    else savePayFilter(addApp(f, source.pkg, source.app))
    update(r.key, { muted: { kind, label: kind === 'word' ? guess.merchant : source.app || '이 앱' }, checked: false })
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
          <p className="mb-2 text-sm break-keep text-slate-500">결제 · 입출금 알림 {rows.length}건을 찾았어요. 맞는지 확인하고 저장할 것만 골라 주세요.</p>
          <MoneyFlow rows={rows} />
          <ul className="space-y-2.5">
            {rows.map((r) => (
              <PaymentDraftCard key={r.key} row={r} onChange={(p) => update(r.key, p)} note={<SourceNote row={r} onMute={(kind) => mute(r, kind)} />} />
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

function SourceNote({ row, onMute }: { row: Row; onMute: (kind: 'word' | 'app') => void }) {
  const candidate = row.candidate
  const s = candidate.source
  const generic = /^(결제|입금)$/.test(candidate.guess.merchant)
  const d = new Date(s.postedAt)
  const time = formatTimeLabel(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
  const body = `${s.title} ${s.text}`.replace(/\s+/g, ' ').trim()
  if (row.muted)
    return (
      <p className="mt-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-500">
        <span className="min-w-0 flex-1">
          🚫 앞으로 &lsquo;{row.muted.label}&rsquo; {row.muted.kind === 'app' ? '알림은 모으지 않아요' : '결제는 묻지 않아요'}
        </span>
        <button type="button" onClick={() => onMute(row.muted!.kind)} className="shrink-0 font-semibold text-brand-600">
          되돌리기
        </button>
      </p>
    )
  return (
    <details className="mt-2 text-[11px] text-slate-400">
      <summary className="cursor-pointer truncate">
        🔔 {s.app || '알림'} · {time}
        {candidate.ids.length > 1 && ` · 알림 ${candidate.ids.length}개를 하나로`}
      </summary>
      <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 break-all whitespace-pre-wrap">{body}</p>
      {!row.muted && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {!generic && (
            <button type="button" onClick={() => onMute('word')} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">
              🚫 &lsquo;{candidate.guess.merchant}&rsquo; 다시 묻지 않기
            </button>
          )}
          <button type="button" onClick={() => onMute('app')} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 hover:bg-slate-200">
            🚫 {s.app || '이 앱'} 알림 빼기
          </button>
        </div>
      )}
    </details>
  )
}

/** 체크한 것 기준: 나간 돈 · 들어온 돈 합계 */
function MoneyFlow({ rows }: { rows: Row[] }) {
  const picked = rows.filter((r) => r.checked)
  const out = picked.filter((r) => r.input.type === 'EXPENSE').reduce((a, r) => a + r.input.amount, 0)
  const inc = picked.filter((r) => r.input.type === 'INCOME').reduce((a, r) => a + r.input.amount, 0)
  return (
    <div className="mb-3 grid grid-cols-2 gap-2 text-center">
      <p className="rounded-2xl bg-slate-50 py-2">
        <span className="block text-xs text-slate-500">나간 돈</span>
        <span className="text-[15px] font-bold text-expense">-{formatWon(out)}</span>
      </p>
      <p className="rounded-2xl bg-slate-50 py-2">
        <span className="block text-xs text-slate-500">들어온 돈</span>
        <span className="text-[15px] font-bold text-income">+{formatWon(inc)}</span>
      </p>
    </div>
  )
}

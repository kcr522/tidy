import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import Button from '../components/common/Button'
import ConfirmDialog from '../components/common/ConfirmDialog'
import EmptyState from '../components/common/EmptyState'
import Modal from '../components/common/Modal'
import PageHeader from '../components/common/PageHeader'
import { useToast } from '../components/common/Toast'
import MonthSummary from '../components/transactions/MonthSummary'
import TransactionForm from '../components/transactions/TransactionForm'
import TransactionList from '../components/transactions/TransactionList'
import type { Transaction } from '../db/types'
import { monthSummary } from '../lib/summary'
import { transactionRepo, type TransactionInput } from '../repositories/transactionRepo'

type Editor = { mode: 'add' } | { mode: 'edit'; item: Transaction } | null

/** 가계부 화면 (spec US1) */
export default function TransactionsPage() {
  // 화면을 연 시점의 이번 달
  const [thisMonth] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })
  const [ym, setYm] = useState(thisMonth)
  const [editor, setEditor] = useState<Editor>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const toast = useToast()

  const items = useLiveQuery(() => transactionRepo.listByMonth(ym.year, ym.month), [ym.year, ym.month])
  const summary = useMemo(() => monthSummary(items ?? []), [items])

  const moveMonth = (delta: number) =>
    setYm(({ year, month }) => {
      const d = new Date(year, month - 1 + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() + 1 }
    })
  const isThisMonth = ym.year === thisMonth.year && ym.month === thisMonth.month

  async function save(input: TransactionInput) {
    try {
      if (editor?.mode === 'edit' && editor.item.id != null) {
        await transactionRepo.update(editor.item.id, input)
        toast('수정했어요')
      } else {
        await transactionRepo.add(input)
        toast('저장했어요')
      }
      setEditor(null)
      // 다른 달 날짜로 저장했으면 그 달로 이동해서 보여 준다
      const [y, m] = input.date.split('-').map(Number)
      if (y !== ym.year || m !== ym.month) setYm({ year: y, month: m })
    } catch {
      // 입력 내용은 그대로 둔다 (Edge Cases: 저장 실패)
      toast('저장하지 못했어요. 다시 시도해 주세요', 'error')
    }
  }

  async function confirmDelete() {
    if (deleting?.id == null) return
    try {
      await transactionRepo.remove(deleting.id)
      toast('삭제했어요')
    } catch {
      toast('삭제하지 못했어요. 다시 시도해 주세요', 'error')
    }
    setDeleting(null)
    setEditor(null)
  }

  return (
    <>
      <PageHeader title="가계부" action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 내역 추가</Button>} />

      <MonthSummary
        year={ym.year}
        month={ym.month}
        summary={summary}
        onPrev={() => moveMonth(-1)}
        onNext={() => moveMonth(1)}
        onToday={isThisMonth ? undefined : () => setYm(thisMonth)}
      />

      {items === undefined ? null : items.length === 0 ? (
        <EmptyState
          icon="💳"
          title="첫 내역을 기록해 보세요"
          description="이 달에는 아직 기록이 없어요."
          action={<Button onClick={() => setEditor({ mode: 'add' })}>+ 내역 추가</Button>}
        />
      ) : (
        <TransactionList items={items} onSelect={(item) => setEditor({ mode: 'edit', item })} />
      )}

      <Modal open={editor !== null} title={editor?.mode === 'edit' ? '내역 수정' : '내역 추가'} onClose={() => setEditor(null)}>
        {editor && (
          <TransactionForm
            key={editor.mode === 'edit' ? editor.item.id : 'new'}
            initial={editor.mode === 'edit' ? editor.item : undefined}
            onSubmit={save}
            onDelete={editor.mode === 'edit' ? () => setDeleting(editor.item) : undefined}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title="내역 삭제"
        message="이 내역을 삭제할까요? 삭제하면 되돌릴 수 없어요."
        confirmLabel="삭제"
        danger
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  )
}

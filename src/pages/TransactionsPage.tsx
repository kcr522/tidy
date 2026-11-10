import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'

export default function TransactionsPage() {
  return (
    <>
      <PageHeader title="가계부" />
      <EmptyState icon="💳" title="첫 내역을 기록해 보세요" description="Day 2에 수입/지출 입력과 월별 내역이 여기에 들어가요." />
    </>
  )
}

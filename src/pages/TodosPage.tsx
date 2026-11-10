import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'

export default function TodosPage() {
  return (
    <>
      <PageHeader title="할 일" />
      <EmptyState icon="✅" title="할 일을 추가해 보세요" description="Day 3에 할 일 추가, 완료 체크, 오늘/전체 탭이 여기에 들어가요." />
    </>
  )
}

import EmptyState from '../components/common/EmptyState'
import PageHeader from '../components/common/PageHeader'

export default function BookmarksPage() {
  return (
    <>
      <PageHeader title="스크랩" />
      <EmptyState icon="🔖" title="나중에 볼 링크를 저장해 보세요" description="Day 4에 링크 저장과 카드 목록이 여기에 들어가요." />
    </>
  )
}

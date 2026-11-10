import { Link } from 'react-router-dom'
import EmptyState from '../components/common/EmptyState'

export default function NotFoundPage() {
  return (
    <EmptyState
      icon="🧭"
      title="페이지를 찾을 수 없어요"
      action={
        <Link to="/" className="font-semibold text-brand-700">
          대시보드로 가기
        </Link>
      }
    />
  )
}

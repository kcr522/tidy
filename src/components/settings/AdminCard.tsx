import { ChevronRight, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccount } from '../../hooks/useAccount'
import { checkAdmin } from '../../lib/admin/adminClient'

/** 설정 > 관리자 페이지 (서버가 관리자라고 답한 계정에만 보인다) */
export default function AdminCard() {
  const { user } = useAccount()
  const [admin, setAdmin] = useState(false)

  useEffect(() => {
    let alive = true
    setAdmin(false)
    if (user) void checkAdmin(user.uid).then((ok) => alive && setAdmin(ok))
    return () => {
      alive = false
    }
  }, [user])

  if (!admin) return null
  return (
    <Link to="/admin" className="card tap flex items-center gap-3 p-5">
      <ShieldCheck className="size-5 shrink-0 text-brand-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <h2 className="font-bold">관리자 페이지</h2>
        <p className="text-sm text-slate-500">사용자 목록 · AI 사용량 · 서버 버전</p>
      </div>
      <ChevronRight className="size-5 text-slate-400" aria-hidden />
    </Link>
  )
}

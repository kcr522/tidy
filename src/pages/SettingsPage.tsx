import { useLiveQuery } from 'dexie-react-hooks'
import PageHeader from '../components/common/PageHeader'
import { db } from '../db/database'

/** 설정 — 백업/가져오기/전체 삭제는 Day 7 (spec US7) */
export default function SettingsPage() {
  const counts = useLiveQuery(async () => ({
    transactions: await db.transactions.count(),
    todos: await db.todos.count(),
    bookmarks: await db.bookmarks.count(),
  }))

  return (
    <>
      <PageHeader title="설정" />
      <div className="space-y-4">
        <section className="rounded-3xl bg-brand-50 p-5 text-sm text-brand-700">
          🔒 데이터는 이 기기에만 저장돼요. 기기를 바꾸기 전에 꼭 백업하세요.
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-semibold">저장된 데이터</h2>
          <dl className="grid grid-cols-3 gap-3 text-center">
            <Stat label="가계부" value={counts?.transactions} />
            <Stat label="할 일" value={counts?.todos} />
            <Stat label="스크랩" value={counts?.bookmarks} />
          </dl>
        </section>

        <section className="card p-5">
          <h2 className="mb-1 font-semibold">백업</h2>
          <p className="text-sm text-slate-500">데이터 내보내기 / 가져오기 / 전체 삭제는 Day 7에 추가돼요.</p>
        </section>

        <p className="text-center text-xs text-slate-400">Tidy v{__APP_VERSION__}</p>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl bg-slate-50 py-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-xl font-bold">{value ?? '-'}</dd>
    </div>
  )
}

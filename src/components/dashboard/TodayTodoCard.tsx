import { ListChecks } from 'lucide-react'
import type { Todo } from '../../db/types'
import { todayProgress, todayTodos } from '../../lib/summary'
import TodoItem from '../todos/TodoItem'
import DashboardCard, { CardEmpty } from './DashboardCard'

const MAX_ITEMS = 5

interface TodayTodoCardProps {
  todos: Todo[]
  today: string
  onAdd: () => void
  onToggle: (todo: Todo) => void
  onSelect: (todo: Todo) => void
}

/** 할 일 카드: "오늘 할 일 (완료/전체)", 최대 5개, 바로 체크 (FR-052) */
export default function TodayTodoCard({ todos, today, onAdd, onToggle, onSelect }: TodayTodoCardProps) {
  const items = todayTodos(todos, today)
  const { done, total } = todayProgress(todos, today)
  const rest = items.length - MAX_ITEMS

  return (
    <DashboardCard to="/todos" icon={ListChecks} title={`오늘 할 일 (${done}/${total})`} addLabel="할 일 추가" onAdd={onAdd}>
      {items.length === 0 ? (
        <CardEmpty>오늘 할 일이 없어요. + 를 눌러 추가해 보세요.</CardEmpty>
      ) : (
        <>
          {total > 0 && (
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div className="h-full rounded-full bg-grad transition-all" style={{ width: `${(done / total) * 100}%` }} />
            </div>
          )}
          <ul className="-mx-3 divide-y divide-slate-100">
            {items.slice(0, MAX_ITEMS).map((t) => (
              <TodoItem key={t.id} todo={t} today={today} onToggle={() => onToggle(t)} onSelect={() => onSelect(t)} />
            ))}
          </ul>
          {rest > 0 && <p className="mt-2 text-center text-xs text-slate-400">외 {rest}개 더 있어요</p>}
        </>
      )}
    </DashboardCard>
  )
}

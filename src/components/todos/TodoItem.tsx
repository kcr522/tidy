import type { Todo } from '../../db/types'
import { formatDateLabel } from '../../lib/format'
import { isOverdue } from '../../lib/summary'
import { PRIORITY_LABEL } from './priority'

interface TodoItemProps {
  todo: Todo
  today: string
  onToggle: () => void
  onSelect: () => void
}

/** 할 일 한 줄: 체크박스, 취소선, 중요도 색, 기한 지남 (FR-021, FR-025) */
export default function TodoItem({ todo, today, onToggle, onSelect }: TodoItemProps) {
  const done = todo.isCompleted === 1
  const overdue = isOverdue(todo, today)
  const p = PRIORITY_LABEL[todo.priority]

  return (
    <li className="flex items-center gap-1 pr-2">
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`${todo.title} ${done ? '완료 취소' : '완료'}`}
        onClick={onToggle}
        className="flex min-h-12 shrink-0 items-center px-3"
      >
        <span
          className={`flex size-5 items-center justify-center rounded-md border-2 text-xs text-white transition-colors ${
            done ? 'border-brand-600 bg-brand-600' : 'border-slate-300 bg-white'
          }`}
        >
          {done && '✓'}
        </span>
      </button>
      <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 py-3 text-left">
        <span className={`size-2 shrink-0 rounded-full ${p.dot}`} title={`중요도 ${p.label}`} aria-label={`중요도 ${p.label}`} />
        <span className={`min-w-0 flex-1 truncate ${done ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{todo.title}</span>
        {overdue && <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">기한 지남</span>}
        {todo.dueDate && !overdue && (
          <span className={`shrink-0 text-xs ${todo.dueDate === today ? 'font-semibold text-brand-700' : 'text-slate-400'}`}>
            {todo.dueDate === today ? '오늘' : formatDateLabel(todo.dueDate)}
          </span>
        )}
        {overdue && todo.dueDate && <span className="shrink-0 text-xs text-red-400">{formatDateLabel(todo.dueDate)}</span>}
      </button>
    </li>
  )
}

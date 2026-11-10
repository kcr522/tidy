import type { Todo } from '../db/types'
import { parseDateKey } from './date'

/** 'HH:mm' 인지 */
export const isTime = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

/** 할 일 알림이 울릴 시각. 마감일과 알림 시각이 둘 다 있고 아직 안 끝낸 일만 */
export function todoAlarmAt(todo: Pick<Todo, 'dueDate' | 'remindAt' | 'isCompleted'>): Date | null {
  if (todo.isCompleted === 1 || !todo.dueDate || !isTime(todo.remindAt)) return null
  const [h, m] = todo.remindAt.split(':').map(Number)
  const d = parseDateKey(todo.dueDate)
  d.setHours(h, m, 0, 0)
  return d
}

/** 앞으로 울릴 알림 (가까운 순, 최대 max개). 폰은 예약할 수 있는 알림 수에 한도가 있다 */
export function upcomingTodoAlarms(todos: Todo[], now: Date, max = 50): { todo: Todo; at: Date }[] {
  return todos
    .map((todo) => ({ todo, at: todoAlarmAt(todo) }))
    .filter((x): x is { todo: Todo; at: Date } => x.at != null && x.todo.id != null && x.at.getTime() > now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, max)
}

/** 앱을 늦게 열었을 때 알려 줄 오늘 알림: 오늘 마감, 시각이 지났고, 아직 안 끝낸 일 */
export function missedTodayAlarms(todos: Todo[], now: Date): Todo[] {
  return todos.filter((t) => {
    const at = todoAlarmAt(t)
    return at != null && at.getTime() <= now.getTime() && at.toDateString() === now.toDateString()
  })
}

export const todoAlarmTitle = (t: Pick<Todo, 'title'>) => `⏰ ${t.title}`
export const todoAlarmBody = (t: Pick<Todo, 'remindAt'>) => `${t.remindAt}에 하기로 한 일이에요`

/** 12시간제 표시: 14:30 → 오후 2:30 */
export function timeLabel(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  return `${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}`
}

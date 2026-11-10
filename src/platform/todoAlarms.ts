import { Capacitor } from '@capacitor/core'
import type { Todo } from '../db/types'
import { missedTodayAlarms, todoAlarmTitle, todoAlarmBody, upcomingTodoAlarms } from '../lib/todoAlarms'
import { showWebNotification } from './alarms'

/**
 * 할 일 알림 (사용자 요청 2026-11-10: 리마인더가 시간에 맞춰 울리게)
 * - 폰 앱: 기기 알림 예약. 앱이 꺼져 있어도 울린다. 할 일을 바꾸거나 끝내면 다시 맞춘다.
 * - 웹/PWA: 앱이 열려 있는 동안 시간이 되면 알림을 띄운다. 늦게 열면 오늘 지난 알림을 한 번 알려 준다.
 */

/** 적금 알림 번호(적금 id × 10)와 겹치지 않게 */
const ID_BASE = 1_000_000

const FIRED_KEY = 'tidy:todo-alarm-fired'
function fired(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markFired(key: string) {
  const set = fired()
  set.add(key)
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-300)))
  } catch {
    /* 저장 못 해도 알림은 울린다 */
  }
}
const keyOf = (t: Todo) => `${t.id}:${t.dueDate}:${t.remindAt}`

async function scheduleNative(todos: Todo[], now: Date) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => (n.extra as { todoId?: number } | undefined)?.todoId != null)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  const list = upcomingTodoAlarms(todos, now).map(({ todo, at }) => ({
    id: ID_BASE + todo.id!,
    title: todoAlarmTitle(todo),
    body: todoAlarmBody(todo),
    extra: { todoId: todo.id },
    schedule: { at, allowWhileIdle: true },
  }))
  if (list.length) await LocalNotifications.schedule({ notifications: list })
}

/** 알림을 맞춘다. 할 일 목록이 바뀔 때마다 부른다. 돌려준 함수로 웹 타이머를 끈다 */
export function syncTodoAlarms(todos: Todo[], onRemind: (text: string) => void): () => void {
  const now = new Date()
  if (Capacitor.isNativePlatform()) {
    scheduleNative(todos, now).catch(() => onRemind('할 일 알림을 예약하지 못했어요'))
    return () => {}
  }

  const ring = (t: Todo) => {
    const key = keyOf(t)
    if (fired().has(key)) return
    markFired(key)
    void showWebNotification(todoAlarmTitle(t), todoAlarmBody(t))
    onRemind(todoAlarmTitle(t))
  }
  for (const t of missedTodayAlarms(todos, now)) ring(t)

  // 앱이 열려 있는 동안: 24시간 안에 울릴 알림만 타이머로 (나중 것은 다시 열 때 맞춘다)
  const timers = upcomingTodoAlarms(todos, now)
    .filter(({ at }) => at.getTime() - now.getTime() <= 24 * 60 * 60 * 1000)
    .map(({ todo, at }) => window.setTimeout(() => ring(todo), at.getTime() - now.getTime()))
  return () => timers.forEach((t) => window.clearTimeout(t))
}

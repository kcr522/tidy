import { Capacitor } from '@capacitor/core'
import type { Recurring } from '../db/types'
import { missedTodayRecurring, recurringAlarmBody, recurringAlarmTitle, upcomingRecurringAlarms } from '../lib/recurringAlarms'
import { showWebNotification } from './alarms'

/**
 * 정기 지출 · 구독 미리 알림 (사용자 요청 2026-11-27)
 * - 폰 앱: 기기 알림 예약. 앱이 꺼져 있어도 울린다. 앞으로 두세 달 치를 예약하고, 열 때마다 다시 맞춘다.
 * - 웹/PWA: 앱이 열려 있는 동안 시간이 되면 알림을 띄운다. 늦게 열면 오늘 지난 알림을 한 번 알려 준다.
 */

/** 적금(id × 10) · 할 일(1,000,000 + id) 알림 번호와 겹치지 않게 */
const ID_BASE = 2_000_000
/** 한 규칙이 예약하는 알림 수보다 크게 (id × 이 값 + 순번) */
const PER_RULE = 10

const FIRED_KEY = 'tidy:recurring-alarm-fired'
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

async function scheduleNative(rules: Recurring[], now: Date) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => (n.extra as { recurringId?: number } | undefined)?.recurringId != null)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  const seen = new Map<number, number>()
  const list = upcomingRecurringAlarms(rules, now).map(({ rule, at }) => {
    const n = seen.get(rule.id!) ?? 0
    seen.set(rule.id!, n + 1)
    return {
      id: ID_BASE + rule.id! * PER_RULE + n,
      title: recurringAlarmTitle(rule),
      body: recurringAlarmBody(rule),
      extra: { recurringId: rule.id },
      schedule: { at, allowWhileIdle: true },
    }
  })
  if (list.length) await LocalNotifications.schedule({ notifications: list })
}

/** 알림을 맞춘다. 정기 내역이 바뀔 때 · 날짜가 바뀔 때 부른다. 돌려준 함수로 웹 타이머를 끈다 */
export function syncRecurringAlarms(rules: Recurring[], onRemind: (text: string) => void): () => void {
  const now = new Date()
  if (Capacitor.isNativePlatform()) {
    scheduleNative(rules, now).catch(() => onRemind('정기 지출 알림을 예약하지 못했어요'))
    return () => {}
  }

  const ring = (rule: Recurring, due: string) => {
    const key = `${rule.id}:${due}:${rule.remindDays}`
    if (fired().has(key)) return
    markFired(key)
    void showWebNotification(recurringAlarmTitle(rule), recurringAlarmBody(rule))
    onRemind(recurringAlarmTitle(rule))
  }
  for (const { rule, due } of missedTodayRecurring(rules, now)) ring(rule, due)

  // 앱이 열려 있는 동안: 24시간 안에 울릴 알림만 타이머로 (나중 것은 다시 열 때 맞춘다)
  const timers = upcomingRecurringAlarms(rules, now)
    .filter(({ at }) => at.getTime() - now.getTime() <= 24 * 60 * 60 * 1000)
    .map(({ rule, due, at }) => window.setTimeout(() => ring(rule, due), at.getTime() - now.getTime()))
  return () => timers.forEach((t) => window.clearTimeout(t))
}

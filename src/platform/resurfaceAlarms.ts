import { Capacitor } from '@capacitor/core'
import type { Bookmark } from '../db/types'
import { toDateKey } from '../lib/date'
import { loadResurface, loadSnoozes, nextNotifyTimes, notifyBody, notifyTitle, pickResurface, planNotifications, resurfaceAnchor } from '../lib/scrap/resurface'
import { showWebNotification } from './alarms'

/**
 * 안 본 스크랩 다시 보기 알림 (사용자 요청 2026-11-27)
 * - 폰 앱: 다음 몇 번(NOTIFY_AHEAD)을 기기 알림으로 예약. 날마다 다른 스크랩 제목이 뜬다. 누르면 그 스크랩이 열린다
 * - 웹: 알릴 날 정한 시각이 지나서 앱을 열어 두면 한 번 알려 준다
 */

/** 적금(id×10) · 할 일(1,000,000+) · 정기 지출(2,000,000 + id×10)과 겹치지 않게 */
const ID_BASE = 900_000_000

const FIRED_KEY = 'tidy:scrap-resurface-fired'

async function scheduleNative(list: Bookmark[], now: Date) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => (n.extra as { resurfaceId?: number } | undefined)?.resurfaceId != null)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  const s = loadResurface()
  if (!s.notify) return
  const plan = planNotifications(list, nextNotifyTimes(now, s, resurfaceAnchor()), loadSnoozes())
  if (!plan.length) return
  await LocalNotifications.schedule({
    notifications: plan.map(({ at, item }, i) => ({
      id: ID_BASE + i,
      title: notifyTitle(),
      body: notifyBody(item),
      extra: { resurfaceId: item.id },
      schedule: { at, allowWhileIdle: true },
    })),
  })
}

/** 스크랩이나 설정이 바뀔 때마다 부른다. 돌려준 함수로 웹 타이머를 끈다 */
export function syncResurfaceAlarms(list: Bookmark[], onFail: (text: string) => void): () => void {
  const now = new Date()
  if (Capacitor.isNativePlatform()) {
    scheduleNative(list, now).catch(() => onFail('스크랩 알림을 예약하지 못했어요'))
    return () => {}
  }
  const s = loadResurface()
  if (!s.notify) return () => {}
  const ring = () => {
    const day = toDateKey(new Date())
    try {
      if (localStorage.getItem(FIRED_KEY) === day) return
      localStorage.setItem(FIRED_KEY, day)
    } catch {
      /* 저장 못 해도 알린다 */
    }
    const item = pickResurface(list, day, loadSnoozes())[0]
    if (item) void showWebNotification(notifyTitle(), notifyBody(item))
  }
  // 오늘이 알릴 날이고 시각이 지났으면 바로, 아직이면 그 시각에 (24시간 안만)
  const [next] = nextNotifyTimes(new Date(now.getTime() - s.every * 86400000), s, resurfaceAnchor(), s.every + 2).filter((at) => toDateKey(at) >= toDateKey(now))
  if (!next) return () => {}
  const wait = next.getTime() - now.getTime()
  if (wait <= 0) {
    ring()
    return () => {}
  }
  if (wait > 86400000) return () => {}
  const timer = window.setTimeout(ring, wait)
  return () => window.clearTimeout(timer)
}

/** 알림을 누르면 그 스크랩을 연다 (폰 앱) */
export function listenResurfaceTap(onOpen: (id: number) => void): () => void {
  if (!Capacitor.isNativePlatform()) return () => {}
  let remove: (() => void) | null = null
  let gone = false
  void import('@capacitor/local-notifications').then(async ({ LocalNotifications }) => {
    const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (e) => {
      const id = (e.notification.extra as { resurfaceId?: number } | undefined)?.resurfaceId
      if (typeof id === 'number') onOpen(id)
    })
    if (gone) void handle.remove()
    else remove = () => void handle.remove()
  })
  return () => {
    gone = true
    remove?.()
  }
}

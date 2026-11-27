import { Capacitor } from '@capacitor/core'
import { showWebNotification } from './alarms'

/**
 * 집중 타이머가 끝나면 알림 (사용자 요청 2026-11-27)
 * - 폰 앱: 기기 알림을 끝나는 시각에 예약한다. 앱을 닫아도 울린다
 * - 웹 · 컴퓨터: 창이 열려 있으면 위젯이 직접 알린다 (다른 탭을 보고 있으면 알림 창)
 */

/** 타이머 알림 번호 (다른 알림과 겹치지 않게 고정) */
const TIMER_ID = 970_001

export async function scheduleTimerAlarm(endAt: number | null): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.cancel({ notifications: [{ id: TIMER_ID }] })
    if (endAt == null || endAt <= Date.now()) return
    const p = await LocalNotifications.checkPermissions()
    if (p.display !== 'granted' && (await LocalNotifications.requestPermissions()).display !== 'granted') return
    await LocalNotifications.schedule({ notifications: [{ id: TIMER_ID, title: '⏰ 타이머가 끝났어요', body: '잠깐 쉬어 가요', schedule: { at: new Date(endAt), allowWhileIdle: true } }] })
  } catch {
    // 알림을 못 걸어도 위젯 안에서는 끝난 걸 보여 준다
  }
}

/** 웹: 창을 안 보고 있을 때만 알림 창 (보고 있으면 위젯이 흔들린다) */
export function notifyTimerDone(): void {
  navigator.vibrate?.([200, 100, 200])
  if (Capacitor.isNativePlatform()) return
  if (document.visibilityState !== 'visible') void showWebNotification('⏰ 타이머가 끝났어요', '잠깐 쉬어 가요')
}

/** 웹에서 알림 창을 쓰려면 한 번 허락받는다 (타이머를 처음 시작할 때) */
export function askWebNotify(): void {
  if (Capacitor.isNativePlatform() || typeof Notification === 'undefined') return
  if (Notification.permission === 'default') void Notification.requestPermission().catch(() => undefined)
}

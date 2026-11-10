import { Capacitor } from '@capacitor/core'
import type { LocalNotificationSchema } from '@capacitor/local-notifications'
import type { SavingsPlan } from '../db/types'
import { toDateKey } from '../lib/date'
import { formatWon } from '../lib/format'
import { isDueOn, nextAlarm } from '../lib/savings'
import { depositMemo } from '../repositories/savingsRepo'

/**
 * 적금 알림
 * - 폰 앱(Capacitor): 기기 알림 예약(@capacitor/local-notifications). 앱이 꺼져 있어도 울린다.
 * - 웹/PWA: 알림 예약 API가 없어서 앱(탭)이 열려 있는 동안 시간이 되면 알림을 띄운다.
 *   앱을 늦게 열면, 오늘 알림 시간이 지났고 아직 안 넣었을 때 한 번 알려 준다.
 */

export type AlarmPermission = 'granted' | 'denied' | 'default' | 'unsupported'

const isNative = () => Capacitor.isNativePlatform()

export async function alarmPermission(): Promise<AlarmPermission> {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const p = await LocalNotifications.checkPermissions()
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default'
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/** 알림 허용을 묻는다 (알림을 켤 때) */
export async function requestAlarmPermission(): Promise<AlarmPermission> {
  if (isNative()) {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const p = await LocalNotifications.requestPermissions()
    return p.display === 'granted' ? 'granted' : 'denied'
  }
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.requestPermission()
}

export const alarmTitle = (p: Pick<SavingsPlan, 'name'>) => `🐷 ${depositMemo(p)} 넣는 날이에요`
export const alarmBody = (p: Pick<SavingsPlan, 'amount' | 'autoDeposit'>) =>
  p.autoDeposit === 1 ? `오늘 ${formatWon(p.amount)}이 자동이체돼요. 통장 잔고를 확인해 주세요` : `오늘 ${formatWon(p.amount)} 넣고 습관을 체크해 주세요`

/** 화면에 알림을 띄운다 (웹) */
async function showWebNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    // PWA는 서비스 워커로 띄워야 폰 홈 화면 앱에서도 보인다
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification(title, { body, icon: '/icons/icon-192.png', tag: title })
    else new Notification(title, { body, icon: '/icons/icon-192.png', tag: title })
    return true
  } catch {
    return false
  }
}

// 이미 알린 알림 (적금 id + 날짜): 같은 날 두 번 울리지 않게
const FIRED_KEY = 'tidy:savings-alarm-fired'
function firedSet(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function markFired(key: string) {
  const set = firedSet()
  set.add(key)
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-200)))
  } catch {
    /* 저장 못 해도 알림은 울린다 */
  }
}

/** 폰 앱: 기기에 알림을 예약한다. id는 적금 id × 10 + 순번 */
async function scheduleNative(plans: SavingsPlan[], now: Date) {
  const { LocalNotifications } = await import('@capacitor/local-notifications')
  const pending = await LocalNotifications.getPending()
  const ours = pending.notifications.filter((n) => (n.extra as { savingsId?: number } | undefined)?.savingsId != null)
  if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) })
  const today = toDateKey(now)
  const list = plans
    .filter((p) => p.alarmOn === 1 && p.id != null && today < p.endDate)
    .flatMap((p): LocalNotificationSchema[] => {
      const [hour, minute] = p.alarmTime.split(':').map(Number)
      const s = p.schedule
      const base = { title: alarmTitle(p), body: alarmBody(p), extra: { savingsId: p.id } }
      // 매일·매주는 반복 알림 하나 (Capacitor 요일은 1(일) ~ 7(토))
      if (s.freq !== 'monthly') {
        const on = s.freq === 'daily' ? { hour, minute } : { weekday: (s.weekday ?? 0) + 1, hour, minute }
        return [{ ...base, id: p.id! * 10, schedule: { on, allowWhileIdle: true } }]
      }
      // 매달은 말일(30·31일) 때문에 다음 6번을 날짜로 하나씩 예약한다. 앱을 열 때마다 다시 채운다
      const out: LocalNotificationSchema[] = []
      let from = now
      for (let i = 0; i < 6; i++) {
        const at = nextAlarm(p, from)
        if (!at) break
        out.push({ ...base, id: p.id! * 10 + i, schedule: { at, allowWhileIdle: true } })
        from = new Date(at.getTime() + 60_000)
      }
      return out
    })
  if (list.length) await LocalNotifications.schedule({ notifications: list })
}

/**
 * 알림 예약을 맞춘다. 앱을 켤 때와 적금을 바꿀 때 부른다.
 * @param onRemind 웹에서 알림 시간이 됐을 때 앱 안에서도 알려 줄 함수 (토스트)
 * @returns 정리 함수 (웹 타이머 끄기)
 */
export function syncAlarms(plans: SavingsPlan[], isDone: (plan: SavingsPlan, date: string) => boolean, onRemind: (text: string) => void): () => void {
  const now = new Date()
  if (isNative()) {
    scheduleNative(plans, now).catch(() => onRemind('알림을 예약하지 못했어요'))
    return () => {}
  }

  const today = toDateKey(now)
  const active = plans.filter((p) => p.alarmOn === 1 && p.startDate <= today && today < p.endDate)

  // 늦게 열었을 때: 오늘이 넣는 날이고 알림 시간이 지났는데 아직 안 넣었으면 한 번 알려 준다
  for (const p of active) {
    const key = `${p.id}:${today}`
    const [h, m] = p.alarmTime.split(':').map(Number)
    const passed = now.getHours() * 60 + now.getMinutes() >= h * 60 + m
    if (isDueOn(p.schedule, today) && passed && !firedSet().has(key) && !isDone(p, today)) {
      markFired(key)
      void showWebNotification(alarmTitle(p), alarmBody(p))
      onRemind(alarmTitle(p))
    }
  }

  // 앱이 열려 있는 동안: 다음 알림 시각에 타이머 (24시간보다 멀면 나중에 다시 계산)
  const timers: number[] = []
  for (const p of plans.filter((x) => x.alarmOn === 1)) {
    const at = nextAlarm(p, now)
    if (!at) continue
    const wait = at.getTime() - now.getTime()
    if (wait > 24 * 60 * 60 * 1000) continue
    timers.push(
      window.setTimeout(() => {
        const key = `${p.id}:${toDateKey(at)}`
        if (firedSet().has(key)) return
        markFired(key)
        void showWebNotification(alarmTitle(p), alarmBody(p))
        onRemind(alarmTitle(p))
      }, wait),
    )
  }
  return () => timers.forEach((t) => window.clearTimeout(t))
}

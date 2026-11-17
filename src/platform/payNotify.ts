import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { PayNotification } from '../lib/payNotify'

/** 안드로이드 쪽 PayNotifyPlugin.java + PayNotifyService.java */
interface PayNotifyPlugin {
  /** granted: 알림 접근 권한이 켜져 있다. alert: "가계부에 기록할까요?" 알림을 띄운다 */
  status(): Promise<{ granted: boolean; alert: boolean }>
  openSettings(): Promise<void>
  setAlert(options: { on: boolean }): Promise<void>
  list(): Promise<{ items: PayNotification[] }>
  remove(options: { ids: string[] }): Promise<void>
  takeOpen(): Promise<{ open: boolean }>
  addListener(event: 'posted' | 'open', cb: () => void): Promise<PluginListenerHandle>
}

const PayNotify = registerPlugin<PayNotifyPlugin>('PayNotify')

/** 결제 알림 읽기는 안드로이드 앱에서만 (웹·아이폰은 다른 앱 알림을 읽을 수 없다) */
export const payNotifyAvailable = (): boolean => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('PayNotify')

export async function payNotifyStatus(): Promise<{ granted: boolean; alert: boolean } | null> {
  if (!payNotifyAvailable()) return null
  try {
    return await PayNotify.status()
  } catch {
    return null
  }
}

export async function openPayNotifySettings(): Promise<void> {
  if (payNotifyAvailable()) await PayNotify.openSettings()
}

export async function setPayNotifyAlert(on: boolean): Promise<void> {
  if (!payNotifyAvailable()) return
  await PayNotify.setAlert({ on })
  if (on) {
    // Android 13+: 앱이 알림을 띄우려면 한 번 허락받아야 한다
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.requestPermissions().catch(() => undefined)
  }
}

export async function listPayNotifications(): Promise<PayNotification[]> {
  if (!payNotifyAvailable()) return []
  try {
    return (await PayNotify.list()).items ?? []
  } catch {
    return []
  }
}

export async function removePayNotifications(ids: string[]): Promise<void> {
  if (!payNotifyAvailable() || ids.length === 0) return
  await PayNotify.remove({ ids })
}

/**
 * 새 결제 알림이 오거나(onChange) "기록할까요?" 알림을 눌러 앱을 열면(onOpen) 부른다.
 * 앱으로 돌아올 때(설정에서 권한을 켜고 오는 때 포함)도 onChange. 돌려주는 함수로 그만 듣는다
 */
export function listenPayNotify(onChange: () => void, onOpen: () => void): () => void {
  if (!payNotifyAvailable()) return () => undefined
  let stopped = false
  const handles: PluginListenerHandle[] = []
  const keep = (p: Promise<PluginListenerHandle>) =>
    p
      .then((h) => {
        if (stopped) h.remove()
        else handles.push(h)
      })
      .catch(() => undefined)
  keep(PayNotify.addListener('posted', onChange))
  keep(PayNotify.addListener('open', onOpen))
  PayNotify.takeOpen()
    .then((r) => r.open && onOpen())
    .catch(() => undefined)
  const onVisible = () => document.visibilityState === 'visible' && onChange()
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    stopped = true
    handles.forEach((h) => h.remove())
    document.removeEventListener('visibilitychange', onVisible)
  }
}

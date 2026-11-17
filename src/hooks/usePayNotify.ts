import { useCallback, useEffect, useState } from 'react'
import { buildCandidates, type PayCandidate } from '../lib/payNotify'
import { loadPayFilter, onPayFilterChange } from '../lib/payNotifyFilter'
import { listPayNotifications, listenPayNotify, payNotifyAvailable, payNotifyStatus } from '../platform/payNotify'

export interface PayNotifyState {
  /** 폰 앱(안드로이드)인가 */
  available: boolean
  /** 알림 접근 권한이 켜져 있다 (모르면 null) */
  granted: boolean | null
  alert: boolean
  candidates: PayCandidate[]
  /** 결제가 아니어서 버릴 알림 id */
  skipped: string[]
  refresh: () => void
}

/** 모아 둔 결제 알림 → 가계부 후보. 새 알림이 오거나 앱으로 돌아오면 다시 읽는다 */
export function usePayNotify(onOpen?: () => void): PayNotifyState {
  const available = payNotifyAvailable()
  const [granted, setGranted] = useState<boolean | null>(null)
  const [alert, setAlert] = useState(true)
  const [found, setFound] = useState<{ candidates: PayCandidate[]; skipped: string[] }>({ candidates: [], skipped: [] })

  const refresh = useCallback(() => {
    if (!available) return
    payNotifyStatus().then((s) => {
      setGranted(s?.granted ?? null)
      if (s) setAlert(s.alert)
    })
    listPayNotifications().then((items) => setFound(buildCandidates(items, loadPayFilter())))
  }, [available])

  // 거르기 규칙을 바꾸면 다시 거른다
  useEffect(() => onPayFilterChange(refresh), [refresh])

  useEffect(() => {
    refresh()
    return listenPayNotify(refresh, () => {
      refresh()
      onOpen?.()
    })
    // onOpen 은 처음 것만 쓴다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  return { available, granted, alert, ...found, refresh }
}

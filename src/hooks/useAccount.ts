import { useSyncExternalStore } from 'react'
import { accountState, subscribeAccount } from '../lib/sync/account'
import { onSyncInfo, syncInfo } from '../lib/sync/engine'

/** 구글 로그인 상태 */
export function useAccount() {
  return useSyncExternalStore(subscribeAccount, accountState)
}

/** 동기화 상태 (올리는 중, 못 올린 기록 수 등) */
export function useSyncInfo() {
  return useSyncExternalStore(onSyncInfo, syncInfo)
}

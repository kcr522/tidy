import { registerPlugin } from '@capacitor/core'
import { isNativeApp } from './native'

/**
 * 지문으로 앱 잠금 풀기 (안드로이드 앱의 BiometricPlugin).
 * 웹과 컴퓨터에서는 쓸 수 없어서 PIN 이나 비밀번호로만 푼다.
 */
export type BiometricReason = 'ok' | 'none' | 'not-enrolled' | 'unavailable' | 'web'

interface BiometricPlugin {
  available(): Promise<{ available: boolean; reason: BiometricReason }>
  authenticate(o: { title?: string; subtitle?: string; cancel?: string }): Promise<{ ok: boolean; cancelled?: boolean; error?: string }>
}
const Native = registerPlugin<BiometricPlugin>('Biometric')

export const BIOMETRIC_REASON_TEXT: Record<BiometricReason, string> = {
  ok: '',
  none: '이 폰에는 지문 센서가 없어요',
  'not-enrolled': '폰 설정에서 지문을 먼저 등록해 주세요',
  unavailable: '지금은 지문을 쓸 수 없어요',
  web: '지문은 안드로이드 앱에서만 쓸 수 있어요',
}

export async function biometricAvailable(): Promise<{ available: boolean; reason: BiometricReason }> {
  if (!isNativeApp()) return { available: false, reason: 'web' }
  try {
    return await Native.available()
  } catch {
    // 지문 기능이 없는 옛 버전 앱
    return { available: false, reason: 'unavailable' }
  }
}

/** 지문 창을 띄운다. 맞으면 true, 취소·실패면 false */
export async function authenticateBiometric(subtitle = '지문을 대 주세요'): Promise<{ ok: boolean; error?: string }> {
  if (!isNativeApp()) return { ok: false, error: BIOMETRIC_REASON_TEXT.web }
  try {
    const r = await Native.authenticate({ title: 'Tidy 잠금 풀기', subtitle, cancel: '비밀번호로 풀기' })
    return { ok: r.ok === true, error: r.cancelled ? undefined : r.error }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : '지문 확인 오류' }
  }
}

import { isNativeApp } from './native'

/**
 * 외부 링크 열기 (FR-035)
 * - 웹 / 컴퓨터 PWA: 새 탭(또는 기본 브라우저)
 * - 폰 앱(Capacitor): 앱 안 브라우저 창 (@capacitor/browser)
 */
export function openUrl(url: string): void {
  if (isNativeApp()) {
    void import('@capacitor/browser').then(({ Browser }) => Browser.open({ url }))
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

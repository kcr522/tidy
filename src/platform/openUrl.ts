/**
 * 외부 링크 열기 (FR-035)
 * - 웹 / 컴퓨터 PWA: 새 탭(또는 기본 브라우저)
 * - 폰 앱(Capacitor): Day 7에 @capacitor/browser 분기 추가
 */
export function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

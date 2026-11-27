import type { CapacitorConfig } from '@capacitor/cli'

/** 폰 앱 설정 (quickstart.md 4번). 웹 빌드 결과(dist)를 그대로 앱 안에 넣는다 */
const config: CapacitorConfig = {
  appId: 'com.kcr522.tidy',
  appName: 'Tidy',
  webDir: 'dist',
  backgroundColor: '#f2f4f6',
  android: {
    // 크롬 chrome://inspect 로 앱 화면 · 저장된 기록을 들여다보지 못하게 (보안 강화 2026-11-27)
    webContentsDebuggingEnabled: false,
  },
}

export default config

import type { CapacitorConfig } from '@capacitor/cli'

/** 폰 앱 설정 (quickstart.md 4번). 웹 빌드 결과(dist)를 그대로 앱 안에 넣는다 */
const config: CapacitorConfig = {
  appId: 'com.kcr522.tidy',
  appName: 'Tidy',
  webDir: 'dist',
  backgroundColor: '#f2f4f6',
}

export default config

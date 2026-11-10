import { Capacitor } from '@capacitor/core'

/** 폰 앱(Capacitor)으로 실행 중인가. 웹과 컴퓨터 PWA에서는 false */
export const isNativeApp = (): boolean => Capacitor.isNativePlatform()

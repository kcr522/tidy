#!/bin/bash
# 에뮬레이터에서 공유 창에 Tidy 가 뜨는지 찍어 보기 (임시)
set -x
OUT=docs/screenshots/x-share-ci
mkdir -p $OUT
n=0
shot() { n=$((n+1)); adb exec-out screencap -p > $OUT/$n-$1.png; adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml $OUT/$n-$1.xml >/dev/null 2>&1; }
tap_text() {
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb pull /sdcard/ui.xml ui.xml >/dev/null 2>&1
  xy=$(python3 - "$1" <<'PY'
import re,sys
s=open('ui.xml',encoding='utf-8').read()
for m in re.finditer(r'<node [^>]*>',s):
  t=m.group(0)
  tx=re.search(r' text="([^"]*)"',t).group(1); cd=re.search(r'content-desc="([^"]*)"',t).group(1)
  a=sys.argv[1]
  ok=(tx==a[1:] or cd==a[1:]) if a.startswith('=') else (a in tx or a in cd)
  if ok:
    b=list(map(int,re.findall(r'\d+',re.search(r'bounds="([^"]*)"',t).group(1))))
    print((b[0]+b[2])//2,(b[1]+b[3])//2); break
PY
)
  [ -n "$xy" ] && adb shell input tap $xy && return 0
  return 1
}
APK=android/app/build/outputs/apk/debug/app-debug.apk
TAPK=android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk
adb root; sleep 3; adb wait-for-device
adb shell "setprop persist.sys.locale ko-KR; setprop ctl.restart zygote"
sleep 8; adb wait-for-device
for i in $(seq 60); do [ "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1 ] && break; sleep 2; done
sleep 15
adb install -r -g $APK; adb install -r -t $TAPK
adb shell monkey -p com.kcr522.tidy -c android.intent.category.LAUNCHER 1
sleep 20
tap_text '허용' ; sleep 2
shot app-first
tap_text '로그인 없이' || { adb shell input swipe 540 1800 540 600 300; sleep 2; tap_text '로그인 없이'; } ; sleep 4
tap_text '나중에' ; sleep 2
tap_text '건너뛰기' ; sleep 3
shot app-ready
adb shell dumpsys shortcut > $OUT/shortcut-dump.txt 2>&1
adb shell input keyevent HOME; sleep 2
share() { adb shell am instrument -w -e class com.kcr522.tidy.ShareSheetLauncher com.kcr522.tidy.test/androidx.test.runner.AndroidJUnitRunner; sleep 6; }
share
shot share-sheet
tap_text 'Tidy에 스크랩' ; sleep 15
tap_text '허용' ; sleep 2
shot save-form
tap_text '=저장' ; sleep 12
shot after-save
tap_text '나중에' ; tap_text '안 올리기' ; sleep 3
shot scrap-list
adb shell input keyevent HOME; sleep 2
share
shot share-sheet-again
adb shell input keyevent BACK
adb logcat -d | grep -i -E 'tidy|chromium|Capacitor|Shortcut' | tail -300 > $OUT/logcat.txt
exit 0
